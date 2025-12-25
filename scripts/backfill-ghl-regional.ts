/**
 * Backfill Script: Send unsent regional properties to GHL
 *
 * This script finds all regional properties (TN, AR, MS, etc.) that have
 * never been sent to GHL and sends them to the GHL webhook.
 *
 * Usage: npx -y dotenv-cli -e .env.local -- npx tsx scripts/backfill-ghl-regional.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

// GHL Webhook URL
const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/f13ea8d2-a22c-4365-9156-759d18147d4a';

// Regional states to include
const REGIONAL_STATES = ['TN', 'AR', 'MS', 'AL', 'KY'];

interface GHLPayload {
  zpid: number | string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  price: number;
  zestimate?: number;
  bedrooms?: number;
  bathrooms?: number;
  livingArea?: number;
  yearBuilt?: number;
  homeType?: string;
  description?: string;
  url: string;
  imgSrc?: string;
  source: string;
  scrapedAt: string;
  firebaseId: string;
}

async function sendToGHL(payload: GHLPayload): Promise<boolean> {
  try {
    const response = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`   ❌ GHL returned ${response.status} for ${payload.address}`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`   ❌ Error sending ${payload.address}:`, error.message);
    return false;
  }
}

async function backfillGHLRegional() {
  console.log('='.repeat(60));
  console.log('BACKFILL: Send Regional Properties to GHL');
  console.log('='.repeat(60));
  console.log(`Regional states: ${REGIONAL_STATES.join(', ')}`);
  console.log(`Webhook: ${GHL_WEBHOOK_URL.substring(0, 60)}...`);
  console.log('');

  // Find all regional properties that haven't been sent to GHL
  console.log('[STEP 1] Finding unsent regional properties...');

  const allRegional: Array<{ id: string; data: FirebaseFirestore.DocumentData }> = [];

  for (const state of REGIONAL_STATES) {
    const snapshot = await db.collection('properties')
      .where('state', '==', state)
      .where('isActive', '==', true)
      .get();

    // Filter to those not sent to GHL
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.sentToGHL) {
        allRegional.push({ id: doc.id, data });
      }
    });
  }

  console.log(`Found ${allRegional.length} regional properties not sent to GHL`);

  if (allRegional.length === 0) {
    console.log('\n✅ All regional properties have already been sent to GHL!');
    return;
  }

  // Group by state for logging
  const byState: Record<string, number> = {};
  allRegional.forEach(({ data }) => {
    const state = data.state || 'Unknown';
    byState[state] = (byState[state] || 0) + 1;
  });

  console.log('\nBy state:');
  Object.entries(byState).forEach(([state, count]) => {
    console.log(`  ${state}: ${count}`);
  });

  // Ask for confirmation
  console.log(`\n⚠️  About to send ${allRegional.length} properties to GHL.`);
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Send to GHL
  console.log('[STEP 2] Sending properties to GHL...');

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < allRegional.length; i++) {
    const { id, data } = allRegional[i];

    const payload: GHLPayload = {
      zpid: data.zpid || id.replace('zpid_', ''),
      address: data.fullAddress || data.streetAddress || data.address || '',
      city: data.city || '',
      state: data.state || '',
      zipcode: data.zipCode || data.zipcode || '',
      price: data.price || 0,
      zestimate: data.estimate || data.zestimate,
      bedrooms: data.bedrooms || data.beds,
      bathrooms: data.bathrooms || data.baths,
      livingArea: data.squareFoot || data.sqft,
      yearBuilt: data.yearBuilt,
      homeType: data.homeType || data.propertyType,
      description: data.description,
      url: data.url || data.zillowUrl || `https://www.zillow.com/homedetails/${data.zpid}_zpid/`,
      imgSrc: data.firstPropertyImage || data.imgSrc,
      source: 'backfill-regional',
      scrapedAt: new Date().toISOString(),
      firebaseId: id,
    };

    const success = await sendToGHL(payload);

    if (success) {
      sent++;

      // Mark as sent in Firestore
      await db.collection('properties').doc(id).update({
        sentToGHL: true,
        sentToGHLAt: new Date(),
        isRegional: true,
      });

      if ((i + 1) % 10 === 0) {
        console.log(`   Progress: ${i + 1}/${allRegional.length} (${sent} sent, ${failed} failed)`);
      }
    } else {
      failed++;
    }

    // Rate limiting - small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('BACKFILL COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total: ${allRegional.length}`);
  console.log(`Sent: ${sent}`);
  console.log(`Failed: ${failed}`);
}

backfillGHLRegional().catch(console.error);
