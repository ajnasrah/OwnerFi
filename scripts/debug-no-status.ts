import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ApifyClient } from 'apify-client';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();
const apify = new ApifyClient({ token: process.env.APIFY_API_KEY! });

async function debug() {
  // 1. Check NO_STATUS and never-checked properties
  console.log('🔍 Checking problematic properties...\n');

  const snap = await db.collection('zillow_imports').get();

  const noStatus: Array<{id: string, address: string, url: string, zpid: string}> = [];
  const neverChecked: Array<{id: string, address: string, url: string, zpid: string, homeStatus: string}> = [];

  snap.forEach(doc => {
    const data = doc.data();
    const status = data.homeStatus;
    const lastCheck = data.lastStatusCheck;
    const address = data.fullAddress || data.streetAddress || 'Unknown';

    if (!status || status === 'NO_STATUS') {
      noStatus.push({
        id: doc.id,
        address,
        url: data.url || '',
        zpid: data.zpid || ''
      });
    }

    if (!lastCheck && data.url) {
      neverChecked.push({
        id: doc.id,
        address,
        url: data.url || '',
        zpid: data.zpid || '',
        homeStatus: status || 'undefined'
      });
    }
  });

  console.log(`📊 NO_STATUS properties: ${noStatus.length}`);
  console.log(`📊 Never-checked properties (with URL): ${neverChecked.length}`);

  // Show sample of NO_STATUS
  console.log('\n--- Sample NO_STATUS properties ---');
  noStatus.slice(0, 5).forEach(p => {
    console.log(`  ${p.address}`);
    console.log(`    URL: ${p.url || 'NO URL'}`);
    console.log(`    ZPID: ${p.zpid || 'NO ZPID'}`);
  });

  // Show sample of never-checked
  console.log('\n--- Sample never-checked properties ---');
  neverChecked.slice(0, 5).forEach(p => {
    console.log(`  ${p.address}`);
    console.log(`    Status: ${p.homeStatus}`);
    console.log(`    URL: ${p.url}`);
  });

  // Test Apify with a sample property to see what it returns
  if (neverChecked.length > 0) {
    console.log('\n--- Testing Apify with a sample property ---');
    const sample = neverChecked[0];
    console.log(`Testing: ${sample.address}`);
    console.log(`URL: ${sample.url}`);

    try {
      const run = await apify.actor('maxcopell/zillow-detail-scraper').call({
        startUrls: [{ url: sample.url }]
      });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();

      if (items.length === 0) {
        console.log('⚠️  Apify returned NO RESULTS for this URL');
        console.log('   This property might be off-market and Zillow removed the listing');
      } else {
        console.log('Apify result:');
        const item = items[0] as Record<string, unknown>;
        console.log(`  homeStatus: ${item.homeStatus}`);
        console.log(`  price: ${item.price}`);
        console.log(`  address: ${(item.address as {streetAddress?: string})?.streetAddress}`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Apify error:', error.message);
    }
  }
}

debug().catch(console.error);
