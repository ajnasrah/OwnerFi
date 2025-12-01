import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function checkRecentActivity() {
  // Check for any properties that have agent_yes status
  console.log('=== Properties with agent_yes status ===');
  const yesSnapshot = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_yes')
    .get();

  console.log('Total agent_yes:', yesSnapshot.size);
  yesSnapshot.forEach(doc => {
    const d = doc.data();
    console.log('  -', d.address, '|', d.city);
  });

  // Check recent zillow_imports from agent_outreach
  console.log('');
  console.log('=== zillow_imports from agent_outreach ===');
  const importsSnapshot = await db.collection('zillow_imports')
    .where('source', '==', 'agent_outreach')
    .get();

  console.log('Total from agent_outreach:', importsSnapshot.size);
  importsSnapshot.forEach(doc => {
    const d = doc.data();
    console.log('  -', d.address, '|', d.city, '|', d.agentConfirmedOwnerFinance ? 'Confirmed' : '');
  });

  // Check for properties updated recently (within last 24 hours)
  console.log('');
  console.log('=== Recently updated in agent_outreach_queue (any status change) ===');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentSnapshot = await db.collection('agent_outreach_queue')
    .where('updatedAt', '>=', yesterday)
    .get();

  console.log('Updated in last 24h:', recentSnapshot.size);
  recentSnapshot.forEach(doc => {
    const d = doc.data();
    console.log('  -', d.address, '|', d.status, '|', d.agentResponse || 'no response');
  });
}

checkRecentActivity().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
