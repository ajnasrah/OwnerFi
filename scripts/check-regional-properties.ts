import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

async function checkRegionalProperties() {
  console.log('=== REGIONAL (CASH DEAL) PROPERTIES ANALYSIS ===\n');

  // Get all active properties
  const allActive = await db.collection('properties')
    .where('isActive', '==', true)
    .get();

  console.log('Total active properties:', allActive.size);

  // Categorize
  let ownerFinanceOnly = 0;
  let cashDealOnly = 0;
  let both = 0;
  let neither = 0;

  // Regional states (AR, TN, MS area)
  const regionalStates = ['TN', 'AR', 'MS', 'AL', 'KY', 'MO'];
  const byState: Record<string, { total: number; cashDeal: number; ownerFinance: number }> = {};

  allActive.forEach(doc => {
    const data = doc.data();
    const isOF = data.isOwnerFinance === true;
    const isCD = data.isCashDeal === true;
    const state = data.state || 'Unknown';

    // Initialize state counter
    if (!byState[state]) {
      byState[state] = { total: 0, cashDeal: 0, ownerFinance: 0 };
    }
    byState[state].total++;

    if (isOF && isCD) {
      both++;
      byState[state].cashDeal++;
      byState[state].ownerFinance++;
    } else if (isOF) {
      ownerFinanceOnly++;
      byState[state].ownerFinance++;
    } else if (isCD) {
      cashDealOnly++;
      byState[state].cashDeal++;
    } else {
      neither++;
    }
  });

  console.log('\n=== BY DEAL TYPE (ALL ACTIVE) ===');
  console.log('Owner Finance only:', ownerFinanceOnly);
  console.log('Cash Deal only:', cashDealOnly);
  console.log('Both:', both);
  console.log('Neither:', neither);

  console.log('\n=== REGIONAL STATES (Cash Deal Focus) ===');
  regionalStates.forEach(state => {
    const stats = byState[state];
    if (stats) {
      console.log(`${state}: ${stats.total} total | ${stats.cashDeal} cash deals | ${stats.ownerFinance} owner finance`);
    }
  });

  console.log('\n=== TOP 10 STATES BY CASH DEAL COUNT ===');
  const sortedStates = Object.entries(byState)
    .sort((a, b) => b[1].cashDeal - a[1].cashDeal)
    .slice(0, 10);

  sortedStates.forEach(([state, stats]) => {
    console.log(`${state}: ${stats.cashDeal} cash deals (${stats.total} total)`);
  });

  // Check last 7 days for cash deals added
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  console.log('\n=== CASH DEALS ADDED (Last 7 Days) ===');

  const recentCashDeals = await db.collection('properties')
    .where('isCashDeal', '==', true)
    .where('createdAt', '>=', sevenDaysAgo)
    .get();

  console.log('Total cash deals added:', recentCashDeals.size);

  // Group by day
  const byDay: Record<string, number> = {};
  recentCashDeals.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.() || new Date();
    const dayKey = createdAt.toISOString().slice(0, 10);
    byDay[dayKey] = (byDay[dayKey] || 0) + 1;
  });

  Object.entries(byDay).sort().forEach(([day, count]) => {
    console.log(`${day}: ${count} cash deals`);
  });

  // Recent cash deals that are NOT owner finance (pure regional)
  const pureRegional = await db.collection('properties')
    .where('isCashDeal', '==', true)
    .where('isOwnerFinance', '==', false)
    .where('createdAt', '>=', sevenDaysAgo)
    .get();

  console.log('\n=== PURE CASH DEALS (Not Owner Finance) - Last 7 Days ===');
  console.log('Count:', pureRegional.size);

  // Sample
  console.log('\nSample (last 5):');
  let count = 0;
  pureRegional.forEach(doc => {
    if (count >= 5) return;
    const data = doc.data();
    console.log(`- ${data.fullAddress || data.streetAddress}`);
    console.log(`  Price: $${data.price?.toLocaleString()} | Zestimate: $${data.estimate?.toLocaleString() || 'N/A'}`);
    console.log(`  % of ARV: ${data.percentOfArv || 'N/A'}%`);
    count++;
  });
}

checkRegionalProperties().catch(console.error);
