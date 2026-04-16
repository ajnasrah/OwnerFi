import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function main() {
  // Find by address in Bessemer AL
  const snap = await db.collection('properties').where('city', '==', 'Bessemer').where('state', '==', 'AL').get();
  for (const doc of snap.docs) {
    const d = doc.data();
    const addr = (d.address || d.streetAddress || '').toLowerCase();
    if (!addr.includes('2224 exeter')) continue;

    console.log(`=== PROPERTIES DOC: ${doc.id} ===`);
    console.log(`  address: ${d.address}`);
    console.log(`  isActive: ${d.isActive}`);
    console.log(`  homeStatus: ${d.homeStatus}`);
    console.log(`  status: ${d.status}`);
    console.log(`  isOwnerfinance: ${d.isOwnerfinance}`);
    console.log(`  dealTypes: ${JSON.stringify(d.dealTypes)}`);
    console.log(`  source: ${d.source}`);
    console.log(`  ownerFinanceVerified: ${d.ownerFinanceVerified}`);
    console.log(`  agentConfirmedOwnerfinance: ${d.agentConfirmedOwnerfinance}`);
    console.log(`  agentConfirmedAt: ${d.agentConfirmedAt?.toDate?.() || d.agentConfirmedAt}`);
    console.log(`  originalQueueId: ${d.originalQueueId}`);
    console.log(`  zpid: ${d.zpid}`);
    console.log(`  createdAt: ${d.createdAt?.toDate?.() || d.createdAt}`);
    console.log(`  lastStatusCheck: ${d.lastStatusCheck?.toDate?.() || d.lastStatusCheck}`);
    console.log(`  primaryImage: ${d.primaryImage ? 'YES' : 'NO'}`);

    // Check queue doc
    if (d.originalQueueId) {
      const q = (await db.collection('agent_outreach_queue').doc(d.originalQueueId).get()).data();
      if (q) {
        console.log(`\n=== QUEUE DOC: ${d.originalQueueId} ===`);
        console.log(`  status: ${q.status}`);
        console.log(`  agentResponse: ${q.agentResponse}`);
        console.log(`  agentResponseAt: ${q.agentResponseAt?.toDate?.() || q.agentResponseAt}`);
        console.log(`  routedTo: ${q.routedTo}`);
        console.log(`  agentNote: ${q.agentNote}`);
        console.log(`  updatedAt: ${q.updatedAt?.toDate?.() || q.updatedAt}`);
        console.log(`  ghlOpportunityId: ${q.ghlOpportunityId}`);
      }
    }
  }

  // Also check queue for any Exeter entries (in case of multiple)
  console.log('\n\n=== ALL QUEUE DOCS WITH 2224 EXETER ===');
  const qSnap = await db.collection('agent_outreach_queue').where('city', '==', 'Bessemer').where('state', '==', 'AL').get();
  for (const doc of qSnap.docs) {
    const d = doc.data();
    const addr = (d.address || '').toLowerCase();
    if (!addr.includes('2224 exeter')) continue;
    console.log(`  ${doc.id}: status=${d.status} response=${d.agentResponse} routed=${d.routedTo} at=${d.agentResponseAt?.toDate?.() || d.agentResponseAt}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
