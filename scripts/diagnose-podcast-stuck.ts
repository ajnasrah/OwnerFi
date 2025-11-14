/**
 * Diagnose stuck podcast workflows
 */

import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore();

async function diagnose() {
  console.log('🔍 Diagnosing stuck podcast workflows...\n');

  const snapshot = await db.collection('podcast_workflow_queue')
    .where('status', '==', 'heygen_processing')
    .limit(10)
    .get();

  console.log(`Found ${snapshot.size} workflows\n`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const workflowId = doc.id;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 Workflow: ${workflowId}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Status: ${data.status}`);
    console.log(`Episode: ${data.episodeTitle || 'Unknown'}`);
    console.log(`Created: ${new Date(data.createdAt).toISOString()}`);
    console.log(`Updated: ${data.updatedAt ? new Date(data.updatedAt).toISOString() : 'Never'}`);
    console.log(`\nFields:`);
    console.log(`  heygenVideoId: ${data.heygenVideoId || 'MISSING'}`);
    console.log(`  heygenVideoUrl: ${data.heygenVideoUrl || 'MISSING'}`);
    console.log(`  script: ${data.script ? 'Present' : 'MISSING'}`);
    console.log(`  error: ${data.error || 'None'}`);

    console.log(`\nFull data:`, JSON.stringify(data, null, 2));
    console.log('');
  }

  console.log('\n✅ Diagnosis complete');
}

diagnose().catch(console.error);
