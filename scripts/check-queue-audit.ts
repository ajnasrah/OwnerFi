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
  const q = (await db.collection('agent_outreach_queue').doc('B5pbCF4qJbiUImiphruD').get()).data()!;
  console.log('Queue doc fields for 1950 Johnson:');
  console.log(`  status: ${q.status}`);
  console.log(`  agentResponseAt: ${q.agentResponseAt?.toDate?.() || q.agentResponseAt}`);
  console.log(`  updatedAt: ${q.updatedAt?.toDate?.() || q.updatedAt}`);
  console.log(`  routedTo: ${q.routedTo}`);
  console.log(`  routedToDocId: ${q.routedToDocId || '(NOT SET — new webhook code did not run)'}`);
  console.log(`  resolvedVia: ${q.resolvedVia || '(NOT SET — new webhook code did not run)'}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
