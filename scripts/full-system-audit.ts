/**
 * Full System Audit - Check for any issues with properties
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

interface PropertyData {
  fullAddress?: string;
  address?: string;
  city?: string;
  state?: string;
  isActive?: boolean;
  isOwnerFinance?: boolean;
  ownerFinanceVerified?: boolean;
  source?: string;
  homeStatus?: string;
  offMarketReason?: string;
  createdAt?: { toDate?: () => Date };
  matchedKeywords?: string[];
}

async function fullAudit() {
  console.log('\n' + '='.repeat(60));
  console.log('  FULL SYSTEM AUDIT');
  console.log('='.repeat(60) + '\n');

  // =====================
  // 1. COLLECTION COUNTS
  // =====================
  console.log('--- 1. COLLECTION COUNTS ---\n');

  const collections = ['properties', 'zillow_imports', 'scraper_queue', 'agent_outreach_queue'];

  for (const coll of collections) {
    const count = await db.collection(coll).count().get();
    console.log(`  ${coll}: ${count.data().count} documents`);
  }

  // =====================
  // 2. PROPERTIES BREAKDOWN
  // =====================
  console.log('\n--- 2. PROPERTIES COLLECTION BREAKDOWN ---\n');

  const allProps = await db.collection('properties').get();

  let active = 0;
  let inactive = 0;
  let ownerFinance = 0;
  let notOwnerFinance = 0;
  const sourceBreakdown: Record<string, number> = {};
  const inactiveReasons: Record<string, number> = {};
  const inactiveManual: Array<{ id: string; address: string; source: string; reason: string }> = [];

  allProps.docs.forEach((doc: { id: string; data: () => PropertyData }) => {
    const data = doc.data();

    if (data.isActive) active++;
    else inactive++;

    if (data.isOwnerFinance || data.ownerFinanceVerified) ownerFinance++;
    else notOwnerFinance++;

    const source = data.source || 'unknown';
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;

    if (!data.isActive && data.offMarketReason) {
      inactiveReasons[data.offMarketReason] = (inactiveReasons[data.offMarketReason] || 0) + 1;
    }

    // Track inactive manual properties
    const manualSources = ['manual-add-v2', 'manual-add', 'admin-upload', 'manual', 'bookmarklet'];
    if (!data.isActive && manualSources.includes(source)) {
      inactiveManual.push({
        id: doc.id,
        address: data.fullAddress || data.address || 'Unknown',
        source,
        reason: data.offMarketReason || 'Unknown',
      });
    }
  });

  console.log(`  Total properties: ${allProps.size}`);
  console.log(`  Active: ${active}`);
  console.log(`  Inactive: ${inactive}`);
  console.log(`  Owner Finance: ${ownerFinance}`);
  console.log(`  Not Owner Finance: ${notOwnerFinance}`);

  console.log('\n  By Source:');
  Object.entries(sourceBreakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([source, count]) => {
      console.log(`    ${source}: ${count}`);
    });

  if (Object.keys(inactiveReasons).length > 0) {
    console.log('\n  Inactive Reasons:');
    Object.entries(inactiveReasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`    "${reason}": ${count}`);
      });
  }

  // =====================
  // 3. PROBLEM DETECTION
  // =====================
  console.log('\n--- 3. PROBLEM DETECTION ---\n');

  // Check for inactive manual properties (should be 0 after fix)
  if (inactiveManual.length > 0) {
    console.log(`  ⚠️  ISSUE: ${inactiveManual.length} manually-added properties are INACTIVE:`);
    inactiveManual.forEach(p => {
      console.log(`      - ${p.address} (${p.source}): ${p.reason}`);
    });
  } else {
    console.log('  ✅ No inactive manually-added properties');
  }

  // Check for properties with isOwnerFinance but not isActive
  const ownerFinanceInactive = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .where('isActive', '==', false)
    .get();

  if (ownerFinanceInactive.size > 0) {
    console.log(`\n  ⚠️  ISSUE: ${ownerFinanceInactive.size} owner-finance properties are INACTIVE`);
    ownerFinanceInactive.docs.slice(0, 5).forEach((doc: { data: () => PropertyData }) => {
      const d = doc.data();
      console.log(`      - ${d.fullAddress || d.address}: ${d.offMarketReason || 'No reason'}`);
    });
    if (ownerFinanceInactive.size > 5) {
      console.log(`      ... and ${ownerFinanceInactive.size - 5} more`);
    }
  } else {
    console.log('  ✅ All owner-finance properties are active');
  }

  // Check for stuck scraper queue items
  const stuckQueue = await db.collection('scraper_queue')
    .where('status', '==', 'processing')
    .get();

  if (stuckQueue.size > 0) {
    console.log(`\n  ⚠️  ISSUE: ${stuckQueue.size} items stuck in "processing" status in scraper_queue`);
  } else {
    console.log('  ✅ No stuck items in scraper_queue');
  }

  // Check for pending queue items
  const pendingQueue = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .get();

  if (pendingQueue.size > 0) {
    console.log(`\n  ℹ️  INFO: ${pendingQueue.size} items pending in scraper_queue`);
  }

  // =====================
  // 4. RECENT ACTIVITY
  // =====================
  console.log('\n--- 4. RECENT ACTIVITY (Last 24 hours) ---\n');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Recent properties added
  const recentProps = await db.collection('properties')
    .where('createdAt', '>=', oneDayAgo)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  console.log(`  Properties added in last 24h: ${recentProps.size}`);
  if (recentProps.size > 0) {
    console.log('  Recent additions:');
    recentProps.docs.forEach((doc: { data: () => PropertyData }) => {
      const d = doc.data();
      const status = d.isActive ? '✅ Active' : '❌ Inactive';
      console.log(`    ${status} | ${d.fullAddress || d.address} | Source: ${d.source}`);
    });
  }

  // =====================
  // 5. ZILLOW IMPORTS CHECK
  // =====================
  console.log('\n--- 5. ZILLOW IMPORTS STATUS ---\n');

  const zillowImports = await db.collection('zillow_imports').count().get();
  console.log(`  Total zillow_imports: ${zillowImports.data().count}`);

  // Check if zillow_imports have ownerFinanceVerified
  const verifiedImports = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .count()
    .get();
  console.log(`  With ownerFinanceVerified=true: ${verifiedImports.data().count}`);

  // =====================
  // 6. FINAL SUMMARY
  // =====================
  console.log('\n' + '='.repeat(60));
  console.log('  AUDIT SUMMARY');
  console.log('='.repeat(60) + '\n');

  const issues: string[] = [];

  if (inactiveManual.length > 0) {
    issues.push(`${inactiveManual.length} manually-added properties incorrectly inactive`);
  }
  if (ownerFinanceInactive.size > 0) {
    issues.push(`${ownerFinanceInactive.size} owner-finance properties inactive`);
  }
  if (stuckQueue.size > 0) {
    issues.push(`${stuckQueue.size} stuck items in scraper queue`);
  }

  if (issues.length === 0) {
    console.log('  ✅ NO ISSUES FOUND - System is healthy!\n');
  } else {
    console.log('  ⚠️  ISSUES FOUND:\n');
    issues.forEach(issue => console.log(`    - ${issue}`));
    console.log('');
  }

  console.log(`  Total Active Properties: ${active}`);
  console.log(`  Total Owner Finance Properties: ${ownerFinance}`);
  console.log('');
}

fullAudit()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
