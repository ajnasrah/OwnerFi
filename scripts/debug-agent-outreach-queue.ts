import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function debugQueue() {
  console.log('=== AGENT OUTREACH QUEUE DEBUG ===\n');

  const snapshot = await db.collection('agent_outreach_queue').get();
  console.log('Total items in queue: ' + snapshot.size);

  // Count by status
  const statusCounts: Record<string, number> = {};
  const recentByStatus: Record<string, any[]> = {};

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const status = data.status || 'unknown';

    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (!recentByStatus[status]) recentByStatus[status] = [];
    if (recentByStatus[status].length < 3) {
      recentByStatus[status].push({
        id: doc.id,
        address: data.address,
        addedAt: data.addedAt?.toDate?.()?.toISOString() || 'unknown',
        sentToGHLAt: data.sentToGHLAt?.toDate?.()?.toISOString() || null,
        errorMessage: data.errorMessage || null,
      });
    }
  }

  console.log('\nBy status:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('\n=== SAMPLES BY STATUS ===\n');

  Object.entries(recentByStatus).forEach(([status, samples]) => {
    console.log(`\n--- ${status.toUpperCase()} ---`);
    samples.forEach((s, i) => {
      console.log(`${i + 1}. ${s.address}`);
      console.log(`   ID: ${s.id}`);
      console.log(`   Added: ${s.addedAt}`);
      if (s.sentToGHLAt) console.log(`   Sent to GHL: ${s.sentToGHLAt}`);
      if (s.errorMessage) console.log(`   Error: ${s.errorMessage}`);
    });
  });

  // Check pending items
  console.log('\n=== PENDING ITEMS DETAIL ===');
  const pending = await db
    .collection('agent_outreach_queue')
    .where('status', '==', 'pending')
    .limit(5)
    .get();

  if (pending.empty) {
    console.log('No pending items found');
  } else {
    console.log(`Found ${pending.size} pending items (showing first 5):`);
    pending.docs.forEach((doc, i) => {
      const data = doc.data();
      console.log(`\n${i + 1}. ${data.address}`);
      console.log(`   Agent: ${data.agentName} - ${data.agentPhone}`);
      console.log(`   Deal type: ${data.dealType}`);
      console.log(`   Added: ${data.addedAt?.toDate?.()?.toISOString()}`);
    });
  }

  // Check GHL webhook URL
  console.log('\n=== GHL CONFIG ===');
  const webhookUrl = process.env.GHL_AGENT_OUTREACH_WEBHOOK_URL;
  console.log('GHL_AGENT_OUTREACH_WEBHOOK_URL:', webhookUrl ? 'SET' : 'NOT SET');
  if (webhookUrl) {
    console.log('URL preview:', webhookUrl.substring(0, 50) + '...');
  }
}

debugQueue()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
