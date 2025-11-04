#!/usr/bin/env npx tsx

import { config } from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

const app = initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
});

const db = getFirestore(app);

const BROKEN_IDS = [
  'wf_1761681720844_dkty8o8sl',
  'wf_1761681717327_0rqnnwtrz',
  'wf_1761681713687_w3tqnggmj',
  'wf_1761681709784_q7ad5hhu9'
];

async function deleteWorkflows() {
  console.log(`🗑️  Deleting ${BROKEN_IDS.length} broken workflows...`);

  for (const id of BROKEN_IDS) {
    try {
      await db.collection('abdullah_workflow_queue').doc(id).delete();
      console.log(`   ✅ Deleted ${id}`);
    } catch (error) {
      console.log(`   ❌ Failed to delete ${id}:`, error);
    }
  }

  console.log('\n✅ Done!');
  process.exit(0);
}

deleteWorkflows();
