import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function fullDiagnosis() {
  console.log('═'.repeat(70));
  console.log('              FULL ZILLOW SCRAPER SYSTEM DIAGNOSIS');
  console.log('═'.repeat(70));

  // ========================================
  // SECTION 1: COLLECTIONS OVERVIEW
  // ========================================
  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    1. COLLECTIONS OVERVIEW                          │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  // Count all collections
  const zillowImportsSnap = await db.collection('zillow_imports').count().get();
  const cashHousesSnap = await db.collection('cash_houses').count().get();
  const scraperQueueSnap = await db.collection('scraper_queue').count().get();
  const cashDealsQueueSnap = await db.collection('cash_deals_queue').count().get();

  console.log('\nTotal Documents:');
  console.log(`  zillow_imports:    ${zillowImportsSnap.data().count}`);
  console.log(`  cash_houses:       ${cashHousesSnap.data().count}`);
  console.log(`  scraper_queue:     ${scraperQueueSnap.data().count}`);
  console.log(`  cash_deals_queue:  ${cashDealsQueueSnap.data().count}`);

  // ========================================
  // SECTION 2: SCRAPER QUEUE STATUS
  // ========================================
  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    2. SCRAPER QUEUE (Owner Finance)                  │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  const sqPending = await db.collection('scraper_queue').where('status', '==', 'pending').count().get();
  const sqProcessing = await db.collection('scraper_queue').where('status', '==', 'processing').count().get();
  const sqCompleted = await db.collection('scraper_queue').where('status', '==', 'completed').count().get();
  const sqFailed = await db.collection('scraper_queue').where('status', '==', 'failed').count().get();
  const sqPermFailed = await db.collection('scraper_queue').where('status', '==', 'permanently_failed').count().get();

  console.log('\nQueue Status:');
  console.log(`  pending:            ${sqPending.data().count}`);
  console.log(`  processing:         ${sqProcessing.data().count}`);
  console.log(`  completed:          ${sqCompleted.data().count}`);
  console.log(`  failed:             ${sqFailed.data().count}`);
  console.log(`  permanently_failed: ${sqPermFailed.data().count}`);

  // Sources in queue
  const sqSampleDocs = await db.collection('scraper_queue').limit(5000).get();
  const sqSources = new Map<string, number>();
  sqSampleDocs.docs.forEach(doc => {
    const src = doc.data().source || 'unknown';
    sqSources.set(src, (sqSources.get(src) || 0) + 1);
  });

  console.log('\nQueue Sources (sample of 5000):');
  [...sqSources.entries()].sort((a, b) => b[1] - a[1]).forEach(([src, count]) => {
    console.log(`  ${src}: ${count}`);
  });

  // ========================================
  // SECTION 3: CASH DEALS QUEUE STATUS
  // ========================================
  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    3. CASH DEALS QUEUE                               │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  const cdqPending = await db.collection('cash_deals_queue').where('status', '==', 'pending').count().get();
  const cdqProcessing = await db.collection('cash_deals_queue').where('status', '==', 'processing').count().get();
  const cdqCompleted = await db.collection('cash_deals_queue').where('status', '==', 'completed').count().get();
  const cdqFailed = await db.collection('cash_deals_queue').where('status', '==', 'failed').count().get();

  console.log('\nQueue Status:');
  console.log(`  pending:     ${cdqPending.data().count}`);
  console.log(`  processing:  ${cdqProcessing.data().count}`);
  console.log(`  completed:   ${cdqCompleted.data().count}`);
  console.log(`  failed:      ${cdqFailed.data().count}`);

  // ========================================
  // SECTION 4: RECENT ACTIVITY
  // ========================================
  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    4. RECENT ACTIVITY (Last 7 Days)                  │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Recent zillow_imports
  const recentZillow = await db.collection('zillow_imports')
    .where('importedAt', '>=', sevenDaysAgo)
    .get();

  const zillowByDay = new Map<string, number>();
  recentZillow.docs.forEach(doc => {
    const d = doc.data();
    const date = d.importedAt?.toDate?.() || new Date(d.importedAt);
    const key = date.toISOString().substring(0, 10);
    zillowByDay.set(key, (zillowByDay.get(key) || 0) + 1);
  });

  console.log('\nzillow_imports (owner finance):');
  if (zillowByDay.size === 0) {
    console.log('  No imports in last 7 days!');
  } else {
    [...zillowByDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).forEach(([day, count]) => {
      console.log(`  ${day}: ${count}`);
    });
  }

  // Recent cash_houses
  const recentCash = await db.collection('cash_houses')
    .where('importedAt', '>=', sevenDaysAgo)
    .get();

  const cashByDay = new Map<string, number>();
  recentCash.docs.forEach(doc => {
    const d = doc.data();
    const date = d.importedAt?.toDate?.() || new Date(d.importedAt);
    const key = date.toISOString().substring(0, 10);
    cashByDay.set(key, (cashByDay.get(key) || 0) + 1);
  });

  console.log('\ncash_houses:');
  if (cashByDay.size === 0) {
    console.log('  No imports in last 7 days!');
  } else {
    [...cashByDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).forEach(([day, count]) => {
      console.log(`  ${day}: ${count}`);
    });
  }

  // ========================================
  // SECTION 5: FAILURE ANALYSIS
  // ========================================
  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    5. FAILURE ANALYSIS                               │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  const failedDocs = await db.collection('scraper_queue')
    .where('status', '==', 'failed')
    .limit(1000)
    .get();

  const failReasons = new Map<string, number>();
  failedDocs.docs.forEach(doc => {
    const reason = doc.data().failureReason || 'No reason';
    failReasons.set(reason, (failReasons.get(reason) || 0) + 1);
  });

  console.log('\nTop Failure Reasons:');
  [...failReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([reason, count]) => {
    console.log(`  ${count}x: ${reason.substring(0, 60)}`);
  });

  // ========================================
  // SECTION 6: CRON SCHEDULE
  // ========================================
  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    6. CRON SCHEDULE (Property Related)               │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  console.log('\n  Cron Job                        Schedule              Description');
  console.log('  ───────────────────────────────────────────────────────────────────');
  console.log('  run-search-scraper              0 11 * * *            Daily 11AM UTC - Find owner finance URLs');
  console.log('  process-scraper-queue           0 * * * *             Hourly - Scrape & filter owner finance');
  console.log('  search-cash-deals               0 10 * * 1,4          Mon/Thu 10AM - Find cash deal URLs');
  console.log('  process-cash-deals-queue        30 */2 * * *          Every 2hrs - Scrape & filter cash deals');
  console.log('  refresh-zillow-status           0 * * * *             Hourly - Check listing status');

  // ========================================
  // SECTION 7: FLOW DIAGRAM
  // ========================================
  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    7. CURRENT SYSTEM FLOW                            │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  console.log(`
  OWNER FINANCE PIPELINE:
  ───────────────────────
  Zillow Search (owner finance keywords in att param)
        │
        ▼
  run-search-scraper (daily 11AM)
        │ extracts URLs
        ▼
  scraper_queue [source: search_cron]
        │
        ▼
  process-scraper-queue (hourly, 100/batch)
        │ calls Apify detail scraper
        │ checks owner finance filter
        │ checks negative keywords
        │
        ├── PASSES → zillow_imports
        │
        └── FAILS → DISCARDED ❌ (not sent to cash deals)


  CASH DEALS PIPELINE (SEPARATE):
  ────────────────────────────────
  Zillow Search (regional, no owner finance filter)
        │
        ▼
  search-cash-deals (Mon/Thu 10AM)
        │ extracts URLs
        ▼
  cash_deals_queue [source: cash_deals_search_cron]
        │
        ▼
  process-cash-deals-queue (every 2hrs, 25/batch)
        │ calls Apify detail scraper
        │ checks: price < 80% Zestimate OR needsWork
        │
        ├── PASSES → cash_houses
        │
        └── FAILS → DISCARDED
  `);

  // ========================================
  // SECTION 8: IDENTIFIED ISSUES
  // ========================================
  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                    8. IDENTIFIED ISSUES                              │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  const issues: string[] = [];

  // Check for backed up queue
  const pendingCount = sqPending.data().count;
  if (pendingCount > 500) {
    issues.push(`[CRITICAL] ${pendingCount} items backed up in scraper_queue`);
  }

  // Check for zero completions
  const completedCount = sqCompleted.data().count;
  if (completedCount === 0) {
    issues.push('[CRITICAL] Zero completed items in scraper_queue - processing never succeeds');
  }

  // Check for high failure rate
  const failedCount = sqFailed.data().count;
  if (failedCount > pendingCount * 0.2) {
    issues.push(`[WARNING] High failure rate: ${failedCount} failed vs ${pendingCount} pending`);
  }

  // Check for manual_import source
  const manualImportCount = sqSources.get('manual_import_11k') || 0;
  if (manualImportCount > 0) {
    issues.push(`[CRITICAL] ${manualImportCount} items from 'manual_import_11k' clogging queue`);
  }

  // Check for no recent imports
  if (zillowByDay.size === 0) {
    issues.push('[CRITICAL] No zillow_imports in last 7 days');
  }

  // Check for disconnected pipelines
  issues.push('[DESIGN] Owner finance and cash deals are SEPARATE pipelines - no cross-filtering');

  if (issues.length > 0) {
    console.log('\n');
    issues.forEach(issue => console.log(`  ⚠️  ${issue}`));
  } else {
    console.log('\n  ✅ No critical issues detected');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('                         END OF DIAGNOSIS');
  console.log('═'.repeat(70));

  process.exit(0);
}

fullDiagnosis();
