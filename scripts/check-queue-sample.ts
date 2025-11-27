import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
const APIFY_TOKEN = process.env.APIFY_API_KEY!;

async function checkProperties() {
  console.log('=== CHECKING PROPERTIES FROM APIFY DATA ===\n');

  // Get sample URLs from the queue
  const queueSnap = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .where('source', '==', 'recovered_apify')
    .limit(5)
    .get();

  console.log(`Checking ${queueSnap.size} sample properties from queue...\n`);

  // The queue only has URLs - we need to check the original Apify data
  // Let's fetch from one of the datasets
  const datasetRes = await fetch(
    `https://api.apify.com/v2/datasets/9i1qNYmg5zsel8m0W/items?token=${APIFY_TOKEN}&limit=10`
  );
  const items = await datasetRes.json();

  console.log('=== SAMPLE PROPERTIES FROM APIFY DATASET ===\n');

  for (const item of items.slice(0, 5)) {
    console.log(`Address: ${item.address || 'N/A'}`);
    console.log(`Price: $${item.price?.toLocaleString() || 'N/A'}`);
    console.log(`Status: ${item.statusText || item.statusType || 'N/A'}`);
    console.log(`Beds/Baths: ${item.beds || '?'}bd / ${item.baths || '?'}ba`);
    console.log(`URL: ${item.detailUrl?.substring(0, 60)}...`);

    // Check if flexFieldText or any field mentions owner finance
    const hasOwnerFinanceInFlex = item.flexFieldText?.toLowerCase().includes('owner') ||
                                   item.flexFieldText?.toLowerCase().includes('financ');

    console.log(`Flex Text: ${item.flexFieldText || 'N/A'}`);
    console.log(`Has OF in flex: ${hasOwnerFinanceInFlex ? 'YES' : 'NO'}`);
    console.log('---');
  }

  // Note: The search results don't have full descriptions
  // The description is only available after detail scraping
  console.log('\n⚠️  NOTE: Search results only have basic info (address, price, status)');
  console.log('   Full descriptions are scraped by process-scraper-queue');
  console.log('   Owner finance filter is applied during detail scraping');
}

checkProperties().catch(console.error);
