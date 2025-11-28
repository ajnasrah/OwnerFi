import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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
const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

const BATCH_SIZE = 25; // Apify batch size
const MAX_BATCHES = 10; // Safety limit - can be increased

async function backfillRentEstimates() {
  console.log('=== BACKFILLING RENT ESTIMATES FOR CASH_HOUSES ===\n');

  // Get all cash_houses without rentEstimate
  const snap = await db.collection('cash_houses').get();
  const needsBackfill: Array<{ id: string; zpid: string; url: string; address: string }> = [];

  snap.docs.forEach(doc => {
    const data = doc.data();
    // Only backfill if missing rentEstimate AND has a valid Zillow URL
    if ((!data.rentEstimate || data.rentEstimate === 0) && data.url && data.url.includes('zillow.com')) {
      needsBackfill.push({
        id: doc.id,
        zpid: String(data.zpid || doc.id), // zpid stored as doc ID
        url: data.url,
        address: data.address || 'Unknown',
      });
    }
  });

  console.log(`Found ${needsBackfill.length} properties needing rent estimates`);
  console.log(`Total in collection: ${snap.size}`);
  console.log(`Already have rent estimates: ${snap.size - needsBackfill.length}\n`);

  if (needsBackfill.length === 0) {
    console.log('✅ All properties already have rent estimates!');
    return;
  }

  // Process in batches
  const batches = Math.min(Math.ceil(needsBackfill.length / BATCH_SIZE), MAX_BATCHES);
  let totalUpdated = 0;
  let totalFailed = 0;

  for (let batchNum = 0; batchNum < batches; batchNum++) {
    const start = batchNum * BATCH_SIZE;
    const batchItems = needsBackfill.slice(start, start + BATCH_SIZE);

    console.log(`\n📦 Processing batch ${batchNum + 1}/${batches} (${batchItems.length} properties)`);

    const urls = batchItems.map(item => ({ url: item.url }));

    try {
      // Run Apify detail scraper
      console.log('🚀 Starting Apify scraper...');
      const run = await client.actor('maxcopell/zillow-detail-scraper').call({
        startUrls: urls,
      }, { waitSecs: 300 });

      if (run.status !== 'SUCCEEDED') {
        console.error(`❌ Apify run failed: ${run.status}`);
        totalFailed += batchItems.length;
        continue;
      }

      // Get results
      const { items } = await client.dataset(run.defaultDatasetId!).listItems();
      console.log(`📥 Received ${items.length} results from Apify`);

      // Create a map of ZPID to rent estimate (more reliable than URL matching)
      const rentByZpid = new Map<string, { rentEstimate: number; annualTax: number; hoa: number }>();
      for (const item of items as any[]) {
        const zpid = String(item.zpid); // Convert to string for consistent matching
        if (zpid && zpid !== 'undefined') {
          const rentData = {
            rentEstimate: item.rentZestimate || 0,
            annualTax: (Array.isArray(item.taxHistory) && item.taxHistory.find((t: any) => t.taxPaid)?.taxPaid) || 0,
            hoa: item.monthlyHoaFee || 0,
          };
          rentByZpid.set(zpid, rentData);
          console.log(`  [Apify] ZPID ${zpid}: rent=$${item.rentZestimate || 0}/mo`);
        }
      }
      console.log(`  [Map] Created ${rentByZpid.size} ZPID entries`);

      // Also create URL map as fallback
      const rentByUrl = new Map<string, { rentEstimate: number; annualTax: number; hoa: number }>();
      for (const item of items as any[]) {
        const url = item.url || item.hdpUrl;
        if (url) {
          rentByUrl.set(url, {
            rentEstimate: item.rentZestimate || 0,
            annualTax: (Array.isArray(item.taxHistory) && item.taxHistory.find((t: any) => t.taxPaid)?.taxPaid) || 0,
            hoa: item.monthlyHoaFee || 0,
          });
        }
      }

      // Update Firestore
      const updateBatch = db.batch();
      let batchUpdates = 0;

      for (const item of batchItems) {
        // Try ZPID first, then URL
        const zpidKey = String(item.zpid);
        let data = rentByZpid.get(zpidKey);
        const foundByZpid = !!data;
        if (!data || data.rentEstimate === 0) {
          data = rentByUrl.get(item.url);
        }

        if (data && data.rentEstimate > 0) {
          updateBatch.update(db.collection('cash_houses').doc(item.id), {
            rentEstimate: data.rentEstimate,
            annualTaxAmount: data.annualTax,
            hoa: data.hoa,
            rentBackfilledAt: new Date(),
          });
          batchUpdates++;
          console.log(`  ✓ ${item.address}: $${data.rentEstimate}/mo rent`);
        } else {
          console.log(`  ✗ ${item.address}: No rent estimate on Zillow`);
        }
      }

      if (batchUpdates > 0) {
        await updateBatch.commit();
        totalUpdated += batchUpdates;
        console.log(`✅ Updated ${batchUpdates} properties in this batch`);
      }

    } catch (error: any) {
      console.error(`❌ Batch ${batchNum + 1} failed:`, error.message);
      totalFailed += batchItems.length;
    }

    // Small delay between batches
    if (batchNum < batches - 1) {
      console.log('⏳ Waiting 5s before next batch...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log('\n========================================');
  console.log(`✅ BACKFILL COMPLETE`);
  console.log(`   Updated: ${totalUpdated} properties`);
  console.log(`   Failed: ${totalFailed} properties`);
  console.log(`   Remaining without rent: ${needsBackfill.length - totalUpdated}`);
  console.log('========================================\n');
}

backfillRentEstimates().catch(console.error);
