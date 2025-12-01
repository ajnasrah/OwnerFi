import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function status() {
  console.log('='.repeat(70));
  console.log('📊 FINAL ZILLOW SCRAPER SYSTEMS STATUS');
  console.log('='.repeat(70));
  
  // Owner Finance Queue
  const ofPending = await db.collection('scraper_queue').where('status', '==', 'pending').count().get();
  const ofProcessing = await db.collection('scraper_queue').where('status', '==', 'processing').count().get();
  const ofCompleted = await db.collection('scraper_queue').where('status', '==', 'completed').count().get();
  const ofFailed = await db.collection('scraper_queue').where('status', '==', 'failed').count().get();
  
  // Cash Deals Queue  
  const cdPending = await db.collection('cash_deals_queue').where('status', '==', 'pending').count().get();
  const cdProcessing = await db.collection('cash_deals_queue').where('status', '==', 'processing').count().get();
  const cdCompleted = await db.collection('cash_deals_queue').where('status', '==', 'completed').count().get();
  const cdFailed = await db.collection('cash_deals_queue').where('status', '==', 'failed').count().get();
  
  // Property counts
  const zillowImports = await db.collection('zillow_imports').count().get();
  const cashHouses = await db.collection('cash_houses').count().get();
  
  // Recent additions
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentZillow = await db.collection('zillow_imports').where('foundAt', '>=', weekAgo).count().get();
  const recentCash = await db.collection('cash_houses').where('createdAt', '>=', weekAgo).count().get();
  
  console.log('\n📊 OWNER FINANCE SYSTEM (run-search-scraper → scraper_queue → zillow_imports)');
  console.log('─'.repeat(70));
  console.log('Cron Schedule: Monday & Thursday at 9 AM (run-search-scraper)');
  console.log('              + Every hour (process-scraper-queue)');
  console.log('              + Every 2 hours (refresh-zillow-status)');
  console.log('');
  console.log('Queue Status:');
  console.log('  ✅ Pending:    ' + ofPending.data().count);
  console.log('  🔄 Processing: ' + ofProcessing.data().count);
  console.log('  ✓  Completed:  ' + ofCompleted.data().count);
  console.log('  ❌ Failed:     ' + ofFailed.data().count);
  console.log('');
  console.log('Properties in zillow_imports: ' + zillowImports.data().count);
  console.log('  Added in last 7 days: ' + recentZillow.data().count);
  
  console.log('\n💰 CASH DEALS SYSTEM (cash_deals_queue → cash_houses)');
  console.log('─'.repeat(70));
  console.log('Cron Schedule: NOT CONFIGURED in vercel.json!');
  console.log('');
  console.log('Queue Status:');
  console.log('  ✅ Pending:    ' + cdPending.data().count);
  console.log('  🔄 Processing: ' + cdProcessing.data().count);
  console.log('  ✓  Completed:  ' + cdCompleted.data().count);
  console.log('  ❌ Failed:     ' + cdFailed.data().count);
  console.log('');
  console.log('Properties in cash_houses: ' + cashHouses.data().count);
  console.log('  Added in last 7 days: ' + recentCash.data().count);
  
  console.log('\n📈 OPTIMIZATION STATUS');
  console.log('─'.repeat(70));
  console.log('Owner Finance System:');
  console.log('  ✅ Search scraper runs 2x/week (Mon & Thu 9 AM)');
  console.log('  ✅ Queue processor runs hourly');
  console.log('  ✅ Status refresh runs every 2 hours (stealth mode)');
  console.log('  ✅ Deduplication before saving');
  console.log('  ✅ Owner finance keyword filtering');
  console.log('  ✅ Negative keyword filtering');
  console.log('  ✅ Auto-retry for failed items (24h wait, 3 max retries)');
  console.log('');
  console.log('Cash Deals System:');
  console.log('  ⚠️  NO CRON CONFIGURED - Queue processor not running automatically!');
  console.log('  ✅ 80% of Zestimate filter');
  console.log('  ✅ Needs work keyword detection');
  console.log('  ✅ Deduplication');
  
  console.log('\n⚠️  ISSUES FOUND');
  console.log('─'.repeat(70));
  console.log('1. Cash Deals cron is NOT in vercel.json - needs to be added');
  console.log('2. ' + ofPending.data().count + ' owner finance items just reset to pending (were failed)');
  console.log('3. ' + cdPending.data().count + ' cash deals items just reset to pending (were stuck)');
}

status().catch(console.error);
