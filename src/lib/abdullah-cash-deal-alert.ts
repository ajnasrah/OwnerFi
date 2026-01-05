/**
 * Abdullah's Personal Cash Deal Alert System
 *
 * Sends SMS to 9018319661 when cash deals under 80% zestimate are found
 * Simplified payload: street address, asking price, zestimate, zillow link
 */

import { fetchWithTimeout, ServiceTimeouts } from './fetch-with-timeout';

// Environment config with fallbacks
const ABDULLAH_WEBHOOK_URL = process.env.ABDULLAH_CASH_DEAL_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/aa08fea6-993d-4cb2-91a1-712624c7667e';
const ABDULLAH_PHONE = process.env.ABDULLAH_PHONE || '9018319661';

export interface CashDealAlert {
  streetAddress: string;
  askingPrice: number;
  zestimate: number;
  zillowLink: string;
}

/**
 * Send a single cash deal alert
 */
export async function sendCashDealAlert(deal: CashDealAlert): Promise<boolean> {
  try {
    const payload = {
      phone: ABDULLAH_PHONE,
      streetAddress: deal.streetAddress,
      askingPrice: deal.askingPrice,
      zestimate: deal.zestimate,
      zillowLink: deal.zillowLink,
      percentOfZestimate: Math.round((deal.askingPrice / deal.zestimate) * 100),
    };

    const response = await fetchWithTimeout(ABDULLAH_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: ServiceTimeouts.GHL,
      retries: 2,
      retryDelay: 1000,
    });

    if (!response.ok) {
      console.error(`[ABDULLAH-ALERT] Failed: ${response.status}`);
      return false;
    }

    console.log(`[ABDULLAH-ALERT] Sent: ${deal.streetAddress} @ ${payload.percentOfZestimate}% of zestimate`);
    return true;
  } catch (error: any) {
    console.error(`[ABDULLAH-ALERT] Error:`, error.message);
    return false;
  }
}

/**
 * Send multiple cash deal alerts
 */
export async function sendCashDealAlerts(deals: CashDealAlert[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const deal of deals) {
    const success = await sendCashDealAlert(deal);
    if (success) sent++;
    else failed++;

    // Small delay between requests
    await new Promise(r => setTimeout(r, 200));
  }

  return { sent, failed };
}
