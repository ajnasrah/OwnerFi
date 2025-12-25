/**
 * Retry Script: Send remaining unsent regional properties to GHL
 * Uses longer delay (500ms) to avoid rate limiting
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

const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/f13ea8d2-a22c-4365-9156-759d18147d4a';
const REGIONAL_STATES = ['TN', 'AR', 'MS', 'AL', 'KY'];
const DELAY_MS = 500; // Longer delay to avoid rate limiting

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

async function sendToGHL(payload: GHLPayload, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(GHL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return true;
      }

      if (response.status === 429) {
        // Rate limited - wait longer and retry
        console.log(`   ⏳ Rate limited, waiting 2s before retry ${attempt}/${retries}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      console.error(`   ❌ GHL returned ${response.status} for ${payload.address}`);
      return false;
    } catch (error: any) {
      if (attempt < retries) {
        console.log(`   ⏳ Retry ${attempt}/${retries} for ${payload.address}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      console.error(`   ❌ Error sending ${payload.address}:`, error.message);
      return false;
    }
  }
  return false;
}

async function retryGHLRegional() {
  console.log('='.repeat(60));
  console.log('RETRY: Send Remaining Regional Properties to GHL');
  console.log('='.repeat(60));
  console.log(`Delay between requests: ${DELAY_MS}ms`);
  console.log('');

  // Find unsent regional properties
  const allUnsent: Array<{ id: string; data: FirebaseFirestore.DocumentData }> = [];

  for (const state of REGIONAL_STATES) {
    const snapshot = await db.collection('properties')
      .where('state', '==', state)
      .where('isActive', '==', true)
      .get();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.sentToGHL) {
        allUnsent.push({ id: doc.id, data });
      }
    });
  }

  console.log(`Found ${allUnsent.length} unsent regional properties\n`);

  if (allUnsent.length === 0) {
    console.log('✅ All regional properties have been sent to GHL!');
    return;
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < allUnsent.length; i++) {
    const { id, data } = allUnsent[i];

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
      source: 'retry-regional',
      scrapedAt: new Date().toISOString(),
      firebaseId: id,
    };

    const success = await sendToGHL(payload);

    if (success) {
      sent++;
      await db.collection('properties').doc(id).update({
        sentToGHL: true,
        sentToGHLAt: new Date(),
        isRegional: true,
      });
    } else {
      failed++;
    }

    if ((i + 1) % 10 === 0 || i === allUnsent.length - 1) {
      console.log(`Progress: ${i + 1}/${allUnsent.length} (${sent} sent, ${failed} failed)`);
    }

    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  console.log('\n' + '='.repeat(60));
  console.log('RETRY COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total: ${allUnsent.length}`);
  console.log(`Sent: ${sent}`);
  console.log(`Failed: ${failed}`);
}

retryGHLRegional().catch(console.error);
