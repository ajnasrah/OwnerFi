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

async function check() {
  console.log('🔍 Checking for properties with failure tracking...\n');

  const snap = await db.collection('zillow_imports').get();

  const withFailures: Array<{address: string, failures: number, note: string, url: string}> = [];
  const testUrls: string[] = [];

  snap.forEach(doc => {
    const data = doc.data();
    const failures = data.consecutiveNoResults || 0;

    if (failures > 0) {
      withFailures.push({
        address: data.fullAddress || data.streetAddress || 'Unknown',
        failures,
        note: data.lastStatusCheckNote || '',
        url: data.url || ''
      });

      // Collect URLs for testing
      if (testUrls.length < 5 && data.url) {
        testUrls.push(data.url);
      }
    }
  });

  console.log(`📊 Properties with failure tracking: ${withFailures.length}`);
  console.log('\n--- Properties with 1+ failures ---');
  withFailures.slice(0, 15).forEach(p => {
    console.log(`  ${p.address}`);
    console.log(`    Failures: ${p.failures}/3`);
    console.log(`    Note: ${p.note}`);
  });

  // Test a batch of these URLs with Apify to see what's happening
  if (testUrls.length > 0) {
    console.log('\n--- Testing failed URLs with Apify ---');
    console.log(`Testing ${testUrls.length} URLs...`);

    try {
      const run = await apify.actor('maxcopell/zillow-detail-scraper').call({
        startUrls: testUrls.map(url => ({ url }))
      });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();

      console.log(`\nApify returned ${items.length} results for ${testUrls.length} URLs`);

      if (items.length === 0) {
        console.log('\n⚠️  ALL URLs returned no results - these properties are likely off-market!');
      } else {
        items.forEach((item: Record<string, unknown>, i: number) => {
          console.log(`\nResult ${i + 1}:`);
          console.log(`  ZPID: ${item.zpid}`);
          console.log(`  Status: ${item.homeStatus}`);
          console.log(`  Address: ${(item.address as {streetAddress?: string})?.streetAddress}`);
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Apify error:', error.message);
    }
  }

  // Also spot check a few random FOR_SALE properties to verify Apify is working
  console.log('\n--- Spot checking random FOR_SALE properties ---');
  const forSaleProps = snap.docs
    .filter(d => d.data().homeStatus === 'FOR_SALE' && d.data().url)
    .slice(0, 3);

  if (forSaleProps.length > 0) {
    const spotCheckUrls = forSaleProps.map(d => d.data().url);

    try {
      const run = await apify.actor('maxcopell/zillow-detail-scraper').call({
        startUrls: spotCheckUrls.map(url => ({ url }))
      });

      const { items } = await apify.dataset(run.defaultDatasetId).listItems();

      console.log(`Spot check: ${items.length}/${spotCheckUrls.length} returned results`);

      items.forEach((item: Record<string, unknown>) => {
        console.log(`  ${(item.address as {streetAddress?: string})?.streetAddress}: ${item.homeStatus}`);
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Apify error:', error.message);
    }
  }
}

check().catch(console.error);
