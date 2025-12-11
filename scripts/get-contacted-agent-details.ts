import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

async function main() {
  // Get full details from contacted_agents
  const doc = await db.collection('contacted_agents').doc('c0LoJO6XRDfetciyrkGt').get();
  const data = doc.data();

  console.log('=== Full contacted_agents record ===');
  console.log(JSON.stringify(data, null, 2));

  // Also get the agent_outreach_queue record
  console.log('\n=== Full agent_outreach_queue record ===');
  const queueDoc = await db.collection('agent_outreach_queue').doc('HTSC9UByiKiK8xvU922c').get();
  console.log(JSON.stringify(queueDoc.data(), null, 2));

  // Get zillow_imports record
  console.log('\n=== Full zillow_imports record ===');
  const importDoc = await db.collection('zillow_imports').doc('QsqoDvsVKwE8nBLD42cK').get();
  console.log(JSON.stringify(importDoc.data(), null, 2));
}

main().then(() => process.exit(0));
