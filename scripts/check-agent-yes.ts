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
  // Check all agent_yes and recent imports
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  console.log('=== All agent_yes in queue ===');
  const agentYes = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_yes')
    .get();

  console.log('Total agent_yes:', agentYes.size);
  agentYes.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${d.address} - Response: ${d.agentResponseAt?.toDate?.() || 'N/A'}`);
  });

  console.log('\n=== zillow_imports with source=agent_outreach ===');
  const imports = await db.collection('zillow_imports')
    .where('source', '==', 'agent_outreach')
    .get();

  console.log('Total:', imports.size);
  imports.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${d.streetAddress} - Imported: ${d.importedAt?.toDate?.()}`);
  });

  console.log('\n=== Recent zillow_imports (last hour) ===');
  const recent = await db.collection('zillow_imports')
    .where('importedAt', '>', oneHourAgo)
    .orderBy('importedAt', 'desc')
    .limit(10)
    .get();

  console.log('Count:', recent.size);
  recent.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${d.streetAddress || d.fullAddress} - Source: ${d.source} - ${d.importedAt?.toDate?.()}`);
  });
}

main().then(() => process.exit(0));
