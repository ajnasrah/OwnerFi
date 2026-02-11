/**
 * Investor Deal Alert System
 *
 * Sends SMS alerts to subscribed investor buyers when deals are found
 * below their configured ARV threshold.
 *
 * Uses a SEPARATE GHL webhook from Abdullah's personal alerts.
 * Deduplicates via Firestore 'deal_alert_claims' collection.
 */

import { fetchWithTimeout, ServiceTimeouts } from './fetch-with-timeout';
import { getFirebaseAdmin } from './scraper-v2/firebase-admin';
import * as admin from 'firebase-admin';

const INVESTOR_ALERT_WEBHOOK_URL = process.env.INVESTOR_DEAL_ALERT_WEBHOOK_URL || '';

export interface InvestorDealInfo {
  streetAddress: string;
  askingPrice: number;
  zestimate: number;
  zpid?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface SubscribedBuyer {
  id: string;
  phone: string;
  firstName: string;
  arvThreshold: number;
  dealAlertNotifiedPropertyIds: string[];
}

/**
 * Query all active deal alert subscribers
 */
async function getActiveSubscribers(): Promise<SubscribedBuyer[]> {
  const { db } = getFirebaseAdmin();

  const snapshot = await db.collection('buyerProfiles')
    .where('dealAlertSubscription.status', '==', 'active')
    .where('isInvestor', '==', true)
    .get();

  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      if (!data.phone) return null;
      if (data.smsNotifications === false) return null;
      return {
        id: doc.id,
        phone: data.phone,
        firstName: data.firstName || 'Investor',
        arvThreshold: data.arvThreshold || 85,
        dealAlertNotifiedPropertyIds: data.dealAlertNotifiedPropertyIds || [],
      };
    })
    .filter(Boolean) as SubscribedBuyer[];
}

/**
 * Deduplication: claim a notification slot using Firestore transaction
 */
async function claimNotification(buyerId: string, dealId: string): Promise<boolean> {
  const { db } = getFirebaseAdmin();
  const claimId = `deal_alert_${buyerId}_${dealId}`;
  const claimRef = db.collection('deal_alert_claims').doc(claimId);

  try {
    return await db.runTransaction(async (transaction) => {
      const claimDoc = await transaction.get(claimRef);
      if (claimDoc.exists) return false;

      transaction.set(claimRef, {
        buyerId,
        dealId,
        claimedAt: new Date(),
      });
      return true;
    });
  } catch {
    return false;
  }
}

/**
 * Send deal alert to a single subscriber via GHL webhook
 */
async function sendAlertToSubscriber(
  buyer: SubscribedBuyer,
  deal: InvestorDealInfo
): Promise<boolean> {
  if (!INVESTOR_ALERT_WEBHOOK_URL) {
    console.error('[INVESTOR-ALERT] No webhook URL configured (INVESTOR_DEAL_ALERT_WEBHOOK_URL)');
    return false;
  }

  const percentOfArv = Math.round((deal.askingPrice / deal.zestimate) * 100);

  // Build OwnerFi property link
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
  const addressSlug = (deal.streetAddress || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const citySlug = (deal.city || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const stateSlug = (deal.state || '').toLowerCase().replace(/[^a-z]+/g, '');
  const slugBase = `${addressSlug}-${citySlug}-${stateSlug}`.replace(/--+/g, '-').replace(/^-+|-+$/g, '');
  const ownerfiLink = deal.zpid ? `${baseUrl}/property/${slugBase}_${deal.zpid}?ref=deal-alert` : `${baseUrl}/dashboard/investor`;

  const payload = {
    phone: buyer.phone,
    firstName: buyer.firstName,
    streetAddress: deal.streetAddress,
    askingPrice: deal.askingPrice,
    zestimate: deal.zestimate,
    percentOfZestimate: percentOfArv,
    ownerfiLink,
    city: deal.city || '',
    state: deal.state || '',
    zipCode: deal.zipCode || '',
  };

  try {
    const response = await fetchWithTimeout(INVESTOR_ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: ServiceTimeouts.GHL,
      retries: 2,
      retryDelay: 1000,
    });

    if (!response.ok) {
      console.error(`[INVESTOR-ALERT] GHL webhook failed for ${buyer.id}: ${response.status}`);
      return false;
    }

    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[INVESTOR-ALERT] Error sending to ${buyer.id}:`, message);
    return false;
  }
}

/**
 * Main entry point: Send investor deal alerts for a batch of cash deals
 *
 * Called from the scraper run after Abdullah's alerts (Step 7.5).
 * For each deal, finds all subscribers whose ARV threshold would include it,
 * deduplicates, and sends via GHL.
 */
export async function sendInvestorDealAlerts(
  deals: InvestorDealInfo[]
): Promise<{ totalSent: number; totalFailed: number; subscribersNotified: number }> {
  if (!INVESTOR_ALERT_WEBHOOK_URL) {
    console.log('[INVESTOR-ALERT] Webhook URL not configured, skipping');
    return { totalSent: 0, totalFailed: 0, subscribersNotified: 0 };
  }

  const subscribers = await getActiveSubscribers();
  console.log(`[INVESTOR-ALERT] Found ${subscribers.length} active subscribers for ${deals.length} deals`);

  if (subscribers.length === 0) {
    return { totalSent: 0, totalFailed: 0, subscribersNotified: 0 };
  }

  let totalSent = 0;
  let totalFailed = 0;
  const notifiedBuyers = new Set<string>();
  const { db } = getFirebaseAdmin();

  for (const deal of deals) {
    if (!deal.zestimate || deal.zestimate <= 0) continue;
    const percentOfArv = Math.round((deal.askingPrice / deal.zestimate) * 100);
    // Generate a stable deal ID from zpid or address
    const addrFallback = deal.streetAddress?.replace(/\s+/g, '_');
    const dealId = deal.zpid || addrFallback;
    if (!dealId) continue; // Skip deals with no identifiable ID

    for (const buyer of subscribers) {
      // Check if this deal is below the buyer's threshold
      if (percentOfArv >= buyer.arvThreshold) continue;

      // In-memory dedup check
      if (buyer.dealAlertNotifiedPropertyIds.includes(dealId)) continue;

      // Firestore transaction dedup
      const claimed = await claimNotification(buyer.id, dealId);
      if (!claimed) continue;

      // Send alert
      const success = await sendAlertToSubscriber(buyer, deal);
      if (success) {
        totalSent++;
        notifiedBuyers.add(buyer.id);

        // Track in buyer profile (non-blocking)
        db.collection('buyerProfiles').doc(buyer.id).update({
          dealAlertNotifiedPropertyIds: admin.firestore.FieldValue.arrayUnion(dealId),
        }).catch((err) => {
          console.warn(`[INVESTOR-ALERT] Failed to track notification for ${buyer.id}:`, err);
        });
      } else {
        totalFailed++;
      }

      // Rate limit: 200ms between sends
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`[INVESTOR-ALERT] Complete: ${totalSent} sent, ${totalFailed} failed, ${notifiedBuyers.size} buyers notified`);
  return { totalSent, totalFailed, subscribersNotified: notifiedBuyers.size };
}
