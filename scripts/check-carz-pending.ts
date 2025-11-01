import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function main() {
  console.log('🔍 Checking CARZ stuck pending workflow\n');

  const doc = await db.collection('carz_workflow_queue').doc('wf_1761825629103_01yhldgou').get();
  const data = doc.data();

  if (!data) {
    console.log('❌ Workflow not found');
    return;
  }

  console.log('📄 Workflow Data:');
  console.log(JSON.stringify(data, null, 2));
}

main();
