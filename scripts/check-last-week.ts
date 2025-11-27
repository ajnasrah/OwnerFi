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

async function getLastWeekStats() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Get zillow_imports from last week
  const zillowImports = await db.collection('zillow_imports')
    .where('createdAt', '>=', oneWeekAgo)
    .orderBy('createdAt', 'desc')
    .get();

  // Get agent_outreach_queue from last week
  const agentOutreach = await db.collection('agent_outreach_queue')
    .where('addedAt', '>=', oneWeekAgo)
    .orderBy('addedAt', 'desc')
    .get();

  // Get scraper_queue pending
  const scraperQueue = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .get();

  // Get cash_deals from last week
  const cashDeals = await db.collection('cash_deals')
    .where('createdAt', '>=', oneWeekAgo)
    .orderBy('createdAt', 'desc')
    .get();

  console.log('=== LAST 7 DAYS STATS ===\n');

  console.log('📥 zillow_imports (owner finance properties):');
  console.log('   Total added:', zillowImports.size);

  if (zillowImports.size > 0) {
    console.log('\n   Recent properties:');
    zillowImports.docs.slice(0, 10).forEach((doc, i) => {
      const d = doc.data();
      const date = d.createdAt?.toDate?.() || new Date(d.createdAt);
      console.log(`   ${i+1}. ${d.address || 'No address'} - $${d.price?.toLocaleString() || '?'} (${date.toLocaleDateString()})`);
    });
  }

  console.log('\n💰 cash_deals:');
  console.log('   Total added:', cashDeals.size);

  console.log('\n📋 agent_outreach_queue (MLS outreach):');
  console.log('   Total added:', agentOutreach.size);

  // Count by deal type
  let cashDealCount = 0;
  let potentialOF = 0;
  agentOutreach.docs.forEach(doc => {
    const d = doc.data();
    if (d.dealType === 'cash_deal') cashDealCount++;
    else potentialOF++;
  });
  console.log('   Cash deals:', cashDealCount);
  console.log('   Potential owner finance:', potentialOF);

  if (agentOutreach.size > 0) {
    console.log('\n   Recent outreach properties:');
    agentOutreach.docs.slice(0, 5).forEach((doc, i) => {
      const d = doc.data();
      const date = d.addedAt?.toDate?.() || new Date(d.addedAt);
      console.log(`   ${i+1}. ${d.address || 'No address'} - $${d.price?.toLocaleString() || '?'} (${d.dealType}) - ${d.agentName || 'Unknown agent'}`);
    });
  }

  console.log('\n⏳ scraper_queue (pending URLs to scrape):');
  console.log('   Pending:', scraperQueue.size);
}

getLastWeekStats().catch(console.error);
