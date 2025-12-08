import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ApifyClient } from 'apify-client';

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

async function analyzeFailed() {
  console.log('='.repeat(80));
  console.log('ANALYZING FAILED QUEUE ITEMS');
  console.log('='.repeat(80));

  // Get failed items
  const failed = await db.collection('scraper_queue')
    .where('status', '==', 'failed')
    .limit(30)
    .get();

  console.log(`\nTotal failed items in sample: ${failed.size}\n`);

  // Group by failure reason
  const byReason: Record<string, number> = {};
  const sampleUrls: string[] = [];

  failed.docs.forEach(doc => {
    const d = doc.data();
    const reason = d.failureReason || 'Unknown';
    byReason[reason] = (byReason[reason] || 0) + 1;

    if (sampleUrls.length < 5) {
      sampleUrls.push(d.url);
    }
  });

  console.log('FAILURE REASONS:');
  Object.entries(byReason).forEach(([reason, count]) => {
    console.log(`  ${reason}: ${count}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('SAMPLE FAILED PROPERTIES (checking actual Zillow listings)');
  console.log('='.repeat(80));

  // For each sample URL, let's fetch from Apify to see the actual property data
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

  for (const url of sampleUrls.slice(0, 3)) {
    console.log(`\n--- Checking: ${url.substring(0, 70)}... ---`);

    try {
      // Run the detail scraper for this single URL
      const input = { startUrls: [{ url }] };
      const run = await client.actor('maxcopell/zillow-detail-scraper').call(input, { waitSecs: 120 });
      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      if (items.length > 0) {
        const item = items[0] as any;
        console.log('Address:', item.address || 'N/A');
        console.log('Price:', item.price || 'N/A');
        console.log('ZPID:', item.zpid || 'N/A');
        console.log('Home Status:', item.homeStatus || 'N/A');
        console.log('Description length:', item.description?.length || 0);

        // Check if description has owner financing keywords
        const desc = item.description || '';
        const hasOwnerFinance = /owner\s*(may\s*|will\s*|can\s*)?financ/i.test(desc);
        const hasSellerFinance = /seller\s*(may\s*|will\s*|can\s*)?financ/i.test(desc);
        const hasRentToOwn = /rent[\s-]+to[\s-]+own/i.test(desc);
        const hasLeaseOption = /lease[\s-]*option|lease[\s-]*purchase/i.test(desc);

        console.log('\nKeyword Detection:');
        console.log('  owner financing:', hasOwnerFinance);
        console.log('  seller financing:', hasSellerFinance);
        console.log('  rent to own:', hasRentToOwn);
        console.log('  lease option/purchase:', hasLeaseOption);

        if (desc) {
          console.log('\nDescription preview (first 500 chars):');
          console.log(desc.substring(0, 500) + '...');
        } else {
          console.log('\n⚠️ NO DESCRIPTION AVAILABLE');
        }
      } else {
        console.log('⚠️ No data returned from Apify');
      }
    } catch (e: any) {
      console.log('Error fetching:', e.message);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
}

analyzeFailed()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
