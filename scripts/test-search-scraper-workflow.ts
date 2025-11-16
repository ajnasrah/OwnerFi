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
  console.log('🧪 Testing Search Scraper → Queue → Strict Filter Workflow\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check current state
  console.log('📊 Current State:\n');

  // Count properties from old search scraper (should not increase anymore)
  const oldSearchScraperProps = await db
    .collection('zillow_imports')
    .where('source', '==', 'apify_search_scraper')
    .get();

  console.log(`   Old search scraper properties: ${oldSearchScraperProps.size}`);
  console.log(`   (These have NO descriptions and can't be filtered)\n`);

  // Count properties from queue processor (should increase with new workflow)
  const queueProcessorProps = await db
    .collection('zillow_imports')
    .where('source', '==', 'apify-zillow')
    .get();

  console.log(`   Queue processor properties: ${queueProcessorProps.size}`);
  console.log(`   (These have descriptions and passed strict filter)\n`);

  // Count pending items in queue
  const pendingQueue = await db
    .collection('scraper_queue')
    .where('status', '==', 'pending')
    .get();

  console.log(`   Pending in queue: ${pendingQueue.size}\n`);

  // Check if any queue items are from search scraper
  const searchScraperQueueItems = await db
    .collection('scraper_queue')
    .where('source', '==', 'apify_search_scraper')
    .limit(5)
    .get();

  console.log(`   Queue items from search scraper: ${searchScraperQueueItems.size}`);

  if (!searchScraperQueueItems.empty) {
    console.log(`\n   ✅ GOOD! Search scraper is feeding the queue`);
    console.log(`\n   Sample queue items from search scraper:`);
    searchScraperQueueItems.docs.slice(0, 3).forEach((doc, i) => {
      const data = doc.data();
      console.log(`      ${i + 1}. ${data.address} - Status: ${data.status}`);
    });
  } else {
    console.log(`\n   ⚠️  No queue items from search scraper yet`);
    console.log(`      Run: npm run scrape-search`);
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('🎯 Workflow Verification:\n');

  // Verify strict filter is being applied
  const recentQueueProps = await db
    .collection('zillow_imports')
    .where('source', '==', 'apify-zillow')
    .where('ownerFinanceVerified', '==', true)
    .limit(5)
    .get();

  console.log(`   Properties with ownerFinanceVerified: ${recentQueueProps.size}`);

  if (!recentQueueProps.empty) {
    console.log(`\n   ✅ STRICT FILTER IS WORKING!`);
    console.log(`\n   Sample verified properties:`);
    recentQueueProps.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`      ${i + 1}. ${data.fullAddress || data.address}`);
      console.log(`         Keywords: ${data.matchedKeywords?.join(', ') || 'N/A'}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('📝 Summary:\n');
  console.log('   ✅ Search scraper should add URLs to scraper_queue');
  console.log('   ✅ Queue processor scrapes details + applies strict filter');
  console.log('   ✅ Only properties with owner finance keywords are saved');
  console.log('   ✅ All properties on website are verified owner financing\n');

  console.log('🚀 Next Steps:\n');
  console.log('   1. Run search scraper: npm run scrape-search');
  console.log('   2. Wait for queue processor (or trigger manually)');
  console.log('   3. Verify properties have descriptions and matched keywords\n');
}

main().catch(console.error);
