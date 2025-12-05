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
  console.log('🔍 Checking Queue Status\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check queue status
  const pending = await db.collection('scraper_queue').where('status', '==', 'pending').get();
  const processing = await db.collection('scraper_queue').where('status', '==', 'processing').get();
  const completed = await db.collection('scraper_queue').where('status', '==', 'completed').get();
  const failed = await db.collection('scraper_queue').where('status', '==', 'failed').get();

  console.log('📊 Queue Status:');
  console.log(`   Pending:    ${pending.size}`);
  console.log(`   Processing: ${processing.size}`);
  console.log(`   Completed:  ${completed.size}`);
  console.log(`   Failed:     ${failed.size}\n`);

  // Check how many from test_search_scraper source
  const testSearchScraper = await db
    .collection('scraper_queue')
    .where('source', '==', 'test_search_scraper')
    .get();

  console.log(`📋 Items from search scraper test: ${testSearchScraper.size}\n`);

  // Group by status
  const byStatus: any = {};
  testSearchScraper.docs.forEach(doc => {
    const status = doc.data().status;
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  console.log('   Breakdown:');
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`     ${status}: ${count}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════\n');

  console.log('💡 EXPLANATION:\n');
  console.log('   The queue processor processes 25 items at a time (batch limit)');
  console.log(`   You have ${pending.size} pending items`);
  console.log(`   This requires ${Math.ceil(pending.size / 25)} more runs to process all\n`);

  if (pending.size > 0) {
    console.log('🚀 Want to process the remaining items?');
    console.log('   Run: npx tsx scripts/trigger-queue-processor.ts\n');
    console.log(`   Or run it ${Math.ceil(pending.size / 25)} times to process all pending items\n`);
  }
}

main().catch(console.error);
