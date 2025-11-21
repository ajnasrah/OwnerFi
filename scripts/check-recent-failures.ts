import admin from 'firebase-admin';

if (admin.apps.length === 0) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

async function checkRecentFailures() {
  console.log('\n🔍 Checking recent workflow failures across all brands...\n');

  const brands = [
    'THE JEEP RECON EV',
    'TECH INSIDER',
    'GREEN LIVING',
    'TRAVEL VIBES',
    'FITNESS GURU'
  ];

  try {
    // Get all social media workflows from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const workflowsSnapshot = await db.collection('social_media_workflows')
      .where('createdAt', '>=', oneDayAgo.toISOString())
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    console.log(`📊 Found ${workflowsSnapshot.size} workflows in the last 24 hours\n`);

    const failedWorkflows: any[] = [];
    const successfulWorkflows: any[] = [];

    workflowsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status === 'failed') {
        failedWorkflows.push({ id: doc.id, ...data });
      } else if (data.status === 'completed') {
        successfulWorkflows.push({ id: doc.id, ...data });
      }
    });

    console.log(`✅ Successful: ${successfulWorkflows.length}`);
    console.log(`❌ Failed: ${failedWorkflows.length}\n`);

    if (failedWorkflows.length > 0) {
      console.log('📋 FAILED WORKFLOWS:\n');

      const errorCounts: { [key: string]: number } = {};

      failedWorkflows.slice(0, 20).forEach((workflow, index) => {
        const error = workflow.error || 'Unknown error';
        errorCounts[error] = (errorCounts[error] || 0) + 1;

        console.log(`${index + 1}. ${workflow.brandName || 'Unknown Brand'}`);
        console.log(`   Title: ${workflow.title || 'No title'}`);
        console.log(`   Status: ${workflow.status}`);
        console.log(`   Error: ${error}`);
        console.log(`   Created: ${workflow.createdAt}`);
        console.log(`   Updated: ${workflow.updatedAt || 'N/A'}`);
        console.log('');
      });

      console.log('\n📊 ERROR SUMMARY:\n');
      Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([error, count]) => {
          console.log(`  ${count}x: ${error}`);
        });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkRecentFailures();
