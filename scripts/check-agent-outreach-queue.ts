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

async function checkQueue() {
  // Check agent outreach queue
  const queue = await db.collection('agent_outreach_queue').get();
  const byStatus: Record<string, number> = { pending: 0, processing: 0, sent_to_ghl: 0, failed: 0 };

  queue.docs.forEach(doc => {
    const status = doc.data().status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  console.log('\n📊 AGENT OUTREACH QUEUE STATUS:');
  console.log('Total in queue:', queue.size);
  console.log('By status:', JSON.stringify(byStatus, null, 2));

  // Check most recent additions
  const recent = await db.collection('agent_outreach_queue')
    .orderBy('addedAt', 'desc')
    .limit(3)
    .get();

  console.log('\nMost recent additions:');
  recent.docs.forEach(doc => {
    const d = doc.data();
    console.log('  -', d.address, '|', d.addedAt?.toDate?.()?.toISOString() || 'no date');
  });

  // Check most recent sent to GHL
  const recentSent = await db.collection('agent_outreach_queue')
    .where('status', '==', 'sent_to_ghl')
    .orderBy('sentToGHLAt', 'desc')
    .limit(3)
    .get();

  if (!recentSent.empty) {
    console.log('\nMost recent sent to GHL:');
    recentSent.docs.forEach(doc => {
      const d = doc.data();
      console.log('  -', d.address, '|', d.sentToGHLAt?.toDate?.()?.toISOString() || 'no date');
    });
  } else {
    console.log('\n⚠️  NO properties sent to GHL yet!');
  }

  process.exit(0);
}

checkQueue().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
