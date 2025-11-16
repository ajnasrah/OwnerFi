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

async function main() {
  console.log('🗑️  Cleaning up old unverified properties\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Find old properties from apify_search_scraper (these have NO descriptions)
  const oldProps = await db
    .collection('zillow_imports')
    .where('source', '==', 'apify_search_scraper')
    .get();

  console.log(`Found ${oldProps.size} old unverified properties\n`);

  if (oldProps.size === 0) {
    console.log('✅ No old properties to clean up!\n');
    return;
  }

  console.log('These properties have NO descriptions and cannot be filtered.');
  console.log('Deleting them now...\n');

  // Delete in batches of 500 (Firestore limit)
  let deleted = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of oldProps.docs) {
    batch.delete(doc.ref);
    batchCount++;

    if (batchCount >= 500) {
      await batch.commit();
      deleted += batchCount;
      console.log(`   Deleted ${deleted}/${oldProps.size}...`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    deleted += batchCount;
  }

  console.log(`\n✅ Deleted ${deleted} old unverified properties\n`);
  console.log('These will be replaced with verified properties from the queue.\n');
}

main().catch(console.error);
