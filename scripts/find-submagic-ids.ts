/**
 * Find Submagic Project IDs from Firestore for stuck workflows
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const STUCK_WORKFLOWS = [
  { id: 'wf_1760828445197_y6oxnrtn5', brand: 'carz' },
  { id: 'wf_1760839244657_khc1z13hl', brand: 'carz' },
  { id: 'wf_1760820968954_2wjjgqu0a', brand: 'ownerfi' },
  { id: 'wf_1760828448052_h24n6amot', brand: 'ownerfi' },
];

async function main() {
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  // Initialize Firebase Admin
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  const db = getFirestore();

  console.log('🔍 Fetching full workflow data from Firestore...\n');

  for (const wf of STUCK_WORKFLOWS) {
    const collectionName = wf.brand === 'carz' ? 'carz_workflow_queue' : 'ownerfi_workflow_queue';

    try {
      const docRef = db.collection(collectionName).doc(wf.id);
      const doc = await docRef.get();

      if (!doc.exists) {
        console.log(`❌ ${wf.brand.toUpperCase()}: ${wf.id} - NOT FOUND in Firestore`);
        continue;
      }

      const data = doc.data();

      console.log(`📄 ${wf.brand.toUpperCase()}: ${wf.id}`);
      console.log(`   Title: ${data?.articleTitle || 'N/A'}`);
      console.log(`   Status: ${data?.status}`);
      console.log(`   Submagic Project ID: ${data?.submagicProjectId || data?.submagicVideoId || 'NOT FOUND'}`);
      console.log(`   Final Video URL: ${data?.finalVideoUrl || 'NOT FOUND'}`);
      console.log(`   HeyGen Video ID: ${data?.heygenVideoId || 'NOT FOUND'}`);
      console.log(`   Created: ${data?.createdAt ? new Date(data.createdAt).toISOString() : 'N/A'}`);
      console.log(`   Updated: ${data?.updatedAt ? new Date(data.updatedAt).toISOString() : 'N/A'}`);
      console.log(`   All fields: ${Object.keys(data || {}).join(', ')}`);
      console.log();
    } catch (error) {
      console.error(`❌ Error fetching ${wf.id}:`, error);
    }
  }
}

main().catch(console.error);
