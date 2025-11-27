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

// The 3 datasets from the big runs
const DATASETS_TO_RECOVER = [
  '9i1qNYmg5zsel8m0W',   // 13,693 results - 17:27
  'XDYWAO3Jqx5qpeSjp',   // 13,687 results - 17:29
  'I19aymvYMfvgzj1y5',   // 11,424 results - 17:36 (aborted)
];

/**
 * Batch check for existing URLs in a collection
 * Uses Firestore 'in' operator (max 10 items per query)
 */
async function batchCheckExistingUrls(
  collectionName: string,
  urls: string[]
): Promise<Set<string>> {
  const existingUrls = new Set<string>();

  for (let i = 0; i < urls.length; i += 10) {
    const batch = urls.slice(i, i + 10);
    const snapshot = await db
      .collection(collectionName)
      .where('url', 'in', batch)
      .select()
      .get();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.url) existingUrls.add(data.url);
    });
  }

  return existingUrls;
}

async function recoverDataset(datasetId: string): Promise<{ added: number; skipped: number }> {
  console.log(`\n📥 Fetching dataset ${datasetId}...`);

  // Fetch all items from dataset
  const allItems: any[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}&offset=${offset}`
    );
    const items = await res.json();

    if (!Array.isArray(items) || items.length === 0) break;

    allItems.push(...items);
    offset += limit;

    process.stdout.write(`\r   Fetched ${allItems.length} items...`);

    if (items.length < limit) break;
  }

  console.log(`\n   Total items: ${allItems.length}`);

  // Extract URLs
  const itemsWithUrls = allItems
    .filter(item => item.detailUrl)
    .map(item => ({
      url: item.detailUrl,
      address: item.address || '',
      price: item.price || '',
      zpid: item.zpid || null,
    }));

  console.log(`   Items with URLs: ${itemsWithUrls.length}`);

  const allUrls = itemsWithUrls.map(item => item.url);

  // Batch check for duplicates
  console.log(`   Checking for duplicates (batched)...`);
  const [urlsInQueue, urlsInImports] = await Promise.all([
    batchCheckExistingUrls('scraper_queue', allUrls),
    batchCheckExistingUrls('zillow_imports', allUrls),
  ]);

  console.log(`   Already in queue: ${urlsInQueue.size}`);
  console.log(`   Already scraped: ${urlsInImports.size}`);

  // Filter to new URLs only
  const newItems = itemsWithUrls.filter(item =>
    !urlsInQueue.has(item.url) && !urlsInImports.has(item.url)
  );

  console.log(`   New URLs to add: ${newItems.length}`);

  // Add to queue in batches
  const BATCH_SIZE = 500;
  let added = 0;

  for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
    const batchItems = newItems.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const item of batchItems) {
      const docRef = db.collection('scraper_queue').doc();
      batch.set(docRef, {
        url: item.url,
        address: item.address,
        price: item.price,
        zpid: item.zpid,
        status: 'pending',
        addedAt: new Date(),
        source: 'recovered_apify',
      });
      added++;
    }

    await batch.commit();
    console.log(`   Committed batch: ${Math.min(i + BATCH_SIZE, newItems.length)}/${newItems.length}`);
  }

  return { added, skipped: itemsWithUrls.length - newItems.length };
}

async function main() {
  console.log('🔄 RECOVERING DATA FROM APIFY DATASETS');
  console.log('=====================================\n');

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const datasetId of DATASETS_TO_RECOVER) {
    try {
      const result = await recoverDataset(datasetId);
      totalAdded += result.added;
      totalSkipped += result.skipped;
    } catch (error) {
      console.error(`❌ Error recovering ${datasetId}:`, error);
    }
  }

  console.log('\n=====================================');
  console.log('✅ RECOVERY COMPLETE');
  console.log(`   Total added to queue: ${totalAdded}`);
  console.log(`   Total skipped (duplicates): ${totalSkipped}`);
  console.log('\n📌 Next: Run process-scraper-queue to scrape details and apply filters');
}

main().catch(console.error);
