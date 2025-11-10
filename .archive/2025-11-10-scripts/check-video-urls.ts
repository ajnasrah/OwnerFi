import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

async function checkVideoUrls() {
  console.log('🔍 Checking video URLs in database...\n');

  const brands = ['carz_workflow_queue', 'ownerfi_workflow_queue', 'vassdistro_workflow_queue', 'abdullah_workflow_queue'];

  for (const collection of brands) {
    console.log(`\n📂 ${collection}:`);

    const snapshot = await db.collection(collection)
      .where('status', 'in', ['posting', 'completed', 'failed'])
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();

    if (snapshot.empty) {
      console.log('   No recent workflows found');
      continue;
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();
      console.log(`\n   Workflow: ${doc.id}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Created: ${data.createdAt ? new Date(data.createdAt).toISOString() : 'N/A'}`);
      console.log(`   Final Video URL: ${data.finalVideoUrl || 'NOT SET'}`);
      console.log(`   Late Post ID: ${data.latePostId || 'NOT SET'}`);

      if (data.finalVideoUrl) {
        // Test URL
        try {
          const response = await fetch(data.finalVideoUrl, { method: 'HEAD' });
          console.log(`   URL Status: ${response.status} ${response.statusText}`);
          if (!response.ok) {
            console.log(`   ❌ VIDEO NOT ACCESSIBLE!`);
          }
        } catch (error) {
          console.log(`   ❌ URL Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }
    }
  }
}

checkVideoUrls().catch(console.error).finally(() => process.exit(0));
