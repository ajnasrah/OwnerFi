import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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

async function analyzeQueue() {
  // Get sample of queue items
  const queue = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .orderBy('addedAt', 'desc')
    .limit(20)
    .get();

  console.log('=== SCRAPER QUEUE ANALYSIS ===\n');

  console.log('Most recent pending items:');
  queue.docs.forEach((doc, i) => {
    const d = doc.data();
    const date = d.addedAt?.toDate?.() || 'Unknown';
    console.log(`${i+1}. ${d.address || d.url?.substring(0,50) || 'No address'}`);
    console.log(`   Added: ${date}`);
    console.log(`   Source: ${d.source || 'unknown'}`);
  });

  // Count by source
  const allPending = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .select('source', 'addedAt')
    .get();

  const sources: Record<string, number> = {};
  const dates: Record<string, number> = {};

  allPending.docs.forEach(doc => {
    const d = doc.data();
    const src = d.source || 'unknown';
    sources[src] = (sources[src] || 0) + 1;

    const date = d.addedAt?.toDate?.();
    if (date) {
      const dateKey = date.toLocaleDateString();
      dates[dateKey] = (dates[dateKey] || 0) + 1;
    }
  });

  console.log('\n=== BY SOURCE ===');
  Object.entries(sources).sort((a,b) => b[1]-a[1]).forEach(([src, count]) => {
    console.log(`  ${src}: ${count.toLocaleString()}`);
  });

  console.log('\n=== BY DATE ===');
  Object.entries(dates).sort((a,b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).slice(0,10).forEach(([date, count]) => {
    console.log(`  ${date}: ${count.toLocaleString()}`);
  });

  // Check total in zillow_imports (all time)
  const totalImports = await db.collection('zillow_imports').count().get();
  console.log('\n=== TOTALS (ALL TIME) ===');
  console.log(`  zillow_imports: ${totalImports.data().count.toLocaleString()}`);

  const totalCashDeals = await db.collection('cash_deals').count().get();
  console.log(`  cash_deals: ${totalCashDeals.data().count.toLocaleString()}`);

  const totalOutreach = await db.collection('agent_outreach_queue').count().get();
  console.log(`  agent_outreach_queue: ${totalOutreach.data().count.toLocaleString()}`);
}

analyzeQueue();
