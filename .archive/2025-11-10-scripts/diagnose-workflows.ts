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

async function diagnoseWorkflows() {
  console.log('🔍 Checking recent workflows...\n');

  const workflowsRef = db.collection('workflows');

  // Get all recent workflows without complex query
  const recentWorkflows = await workflowsRef
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  if (recentWorkflows.empty) {
    console.log('No workflows found');
    return;
  }

  const stuckWorkflows = recentWorkflows.docs.filter(doc =>
    doc.data().status === 'heygen_processing'
  );

  console.log(`Total recent workflows: ${recentWorkflows.size}`);
  console.log(`Stuck at heygen_processing: ${stuckWorkflows.length}\n`);

  if (stuckWorkflows.length === 0) {
    console.log('✅ No workflows stuck at heygen_processing\n');
  } else {
    console.log(`⚠️  Found ${stuckWorkflows.length} stuck workflows:\n`);

    for (const doc of stuckWorkflows) {
      const data = doc.data();
      console.log(`Workflow ID: ${doc.id}`);
      console.log(`Title: ${data.article?.title || 'N/A'}`);
      console.log(`Created: ${data.createdAt?.toDate().toISOString()}`);
      console.log(`Status: ${data.status}`);
      console.log(`HeyGen Video ID: ${data.heygenVideoId || 'N/A'}`);
      console.log(`Submagic Job ID: ${data.submagicJobId || 'N/A'}`);

      // Check if there's a corresponding video-exports record
      if (data.heygenVideoId) {
        const exportDoc = await db.collection('video-exports').doc(data.heygenVideoId).get();
        if (exportDoc.exists) {
          const exportData = exportDoc.data();
          console.log(`Export Status: ${exportData?.status || 'N/A'}`);
          console.log(`Export URL: ${exportData?.videoUrl ? 'Present' : 'Missing'}`);
          console.log(`Export Download URL: ${exportData?.downloadUrl ? 'Present' : 'Missing'}`);
        } else {
          console.log('⚠️  No video-exports record found');
        }
      }

      console.log('---\n');
    }
  }

  // Show status breakdown
  const statusCounts: Record<string, number> = {};
  recentWorkflows.docs.forEach(doc => {
    const status = doc.data().status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('\n📊 Status breakdown (last 20 workflows):');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`${status}: ${count}`);
  });
}

diagnoseWorkflows().catch(console.error).finally(() => process.exit(0));
