import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = admin.firestore();

async function checkQueues() {
  // Check agent_outreach_queue
  const outreachQueue = await db.collection('agent_outreach_queue').get();
  const outreachByStatus: Record<string, number> = {};
  outreachQueue.docs.forEach(doc => {
    const status = doc.data().status || 'unknown';
    outreachByStatus[status] = (outreachByStatus[status] || 0) + 1;
  });

  console.log('📋 AGENT OUTREACH QUEUE:');
  console.log('   Total:', outreachQueue.size);
  console.log('   By status:', JSON.stringify(outreachByStatus));

  // Check contacted_agents
  const contacted = await db.collection('contacted_agents').count().get();
  console.log('\n📞 CONTACTED AGENTS:', contacted.data().count);

  // Check zillow_imports (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentImports = await db.collection('zillow_imports')
    .where('foundAt', '>=', weekAgo)
    .count()
    .get();
  console.log('\n🏠 ZILLOW IMPORTS (last 7 days):', recentImports.data().count);

  // Check how many zillow_imports have NOT been sent to GHL
  const notSentToGHL = await db.collection('zillow_imports')
    .where('sentToGHL', '!=', true)
    .limit(100)
    .get();
  console.log('\n📤 ZILLOW IMPORTS NOT SENT TO GHL:', notSentToGHL.size, '(limited to 100)');

  // Check recent additions to agent_outreach_queue
  const recentOutreach = await db.collection('agent_outreach_queue')
    .orderBy('addedAt', 'desc')
    .limit(5)
    .get();

  if (!recentOutreach.empty) {
    console.log('\n🕐 RECENT OUTREACH QUEUE ENTRIES:');
    recentOutreach.docs.forEach(doc => {
      const data = doc.data();
      const addedAt = data.addedAt?.toDate?.() || 'unknown';
      console.log('  -', data.address, '|', data.status, '|', addedAt);
    });
  }

  // Check scraper_queue
  const scraperQueue = await db.collection('scraper_queue').get();
  const scraperByStatus: Record<string, number> = {};
  scraperQueue.docs.forEach(doc => {
    const status = doc.data().status || 'unknown';
    scraperByStatus[status] = (scraperByStatus[status] || 0) + 1;
  });

  console.log('\n📋 SCRAPER QUEUE (zillow owner finance):');
  console.log('   Total:', scraperQueue.size);
  console.log('   By status:', JSON.stringify(scraperByStatus));

  process.exit(0);
}

checkQueues().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
