import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '../src/lib/typesense/client';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function main() {
  const id = 'zpid_35107520';
  console.log(`=== 3234 Oakridge Dr (${id}) ===\n`);

  const p = await db.collection('properties').doc(id).get();
  console.log(`Firestore properties/${id}: ${p.exists ? 'EXISTS' : 'DELETED'}`);
  if (p.exists) {
    const d = p.data()!;
    console.log(`  isActive: ${d.isActive}`);
    console.log(`  isOwnerfinance: ${d.isOwnerfinance}`);
    console.log(`  dealTypes: ${JSON.stringify(d.dealTypes)}`);
    console.log(`  homeStatus: ${d.homeStatus}`);
    console.log(`  source: ${d.source}`);
    console.log(`  agentConfirmedAt: ${d.agentConfirmedAt?.toDate?.() || d.agentConfirmedAt}`);
    console.log(`  agentConfirmedOwnerfinance: ${d.agentConfirmedOwnerfinance}`);
  }

  // Check queue
  const qSnap = await db.collection('agent_outreach_queue').where('zpid', '==', '35107520').get();
  const qSnapNum = await db.collection('agent_outreach_queue').where('zpid', '==', 35107520).get();
  const all = [...qSnap.docs, ...qSnapNum.docs];
  console.log(`\nQueue docs for zpid 35107520: ${all.length}`);
  for (const doc of all) {
    const d = doc.data();
    console.log(`  ${doc.id}:`);
    console.log(`    address: ${d.address}`);
    console.log(`    status: ${d.status}`);
    console.log(`    agentResponse: ${d.agentResponse}`);
    console.log(`    routedTo: ${d.routedTo}`);
    console.log(`    agentResponseAt: ${d.agentResponseAt?.toDate?.() || d.agentResponseAt}`);
    console.log(`    updatedAt: ${d.updatedAt?.toDate?.() || d.updatedAt}`);
  }

  // Typesense
  const ts = getTypesenseAdminClient()!;
  try {
    const t: any = await ts.collections(TYPESENSE_COLLECTIONS.PROPERTIES).documents(id).retrieve();
    console.log(`\nTypesense: EXISTS — isActive=${t.isActive} dealType=${t.dealType}`);
  } catch (e: any) {
    console.log(`\nTypesense: DELETED`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
