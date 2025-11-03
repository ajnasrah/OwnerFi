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

async function findLastSuccess() {
  console.log('🔍 Finding last successful Late post...\n');

  const brands = ['carz_workflow_queue', 'ownerfi_workflow_queue', 'abdullah_workflow_queue'];

  let lastSuccess: any = null;

  for (const collection of brands) {
    const snapshot = await db.collection(collection)
      .where('status', '==', 'completed')
      .where('latePostId', '!=', null)
      .orderBy('latePostId')
      .orderBy('completedAt', 'desc')
      .limit(5)
      .get();

    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.latePostId && data.completedAt) {
          console.log(`✅ ${collection}:`);
          console.log(`   Workflow: ${doc.id}`);
          console.log(`   Completed: ${new Date(data.completedAt).toISOString()}`);
          console.log(`   Late Post ID: ${data.latePostId}`);
          console.log(`   Title: ${data.articleTitle || 'N/A'}\n`);

          if (!lastSuccess || data.completedAt > lastSuccess.completedAt) {
            lastSuccess = { ...data, collection, workflowId: doc.id };
          }
        }
      }
    }
  }

  if (lastSuccess) {
    console.log('\n📅 MOST RECENT SUCCESSFUL POST:');
    console.log(`   Collection: ${lastSuccess.collection}`);
    console.log(`   Workflow: ${lastSuccess.workflowId}`);
    console.log(`   Completed: ${new Date(lastSuccess.completedAt).toISOString()}`);
    console.log(`   Late Post ID: ${lastSuccess.latePostId}`);
    console.log(`   Hours ago: ${((Date.now() - lastSuccess.completedAt) / 3600000).toFixed(1)}`);
  } else {
    console.log('❌ NO SUCCESSFUL LATE POSTS FOUND');
    console.log('This suggests Late posting has NEVER worked or index is missing');
  }
}

findLastSuccess().catch(console.error).finally(() => process.exit(0));
