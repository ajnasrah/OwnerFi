import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

if (getApps().length === 0) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function checkFailures() {
  console.log('=== Carz Inc Workflow Failures ===\n');

  // Get last 50 workflows
  const workflowsRef = db.collection('carz_workflow_queue');
  const recentWorkflows = await workflowsRef
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const workflows = recentWorkflows.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Count by status
  const statusCounts: Record<string, number> = {};
  workflows.forEach((w: any) => {
    statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
  });

  console.log('Status breakdown (last 50 workflows):\n');
  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      const percentage = ((count / workflows.length) * 100).toFixed(1);
      console.log(`  ${status}: ${count} (${percentage}%)`);
    });

  // Show failed workflows
  const failed = workflows.filter((w: any) => w.status === 'failed');

  console.log(`\n=== Failed Workflows (${failed.length}) ===\n`);

  if (failed.length === 0) {
    console.log('✅ No failed workflows in last 50!\n');
  } else {
    // Group by error type
    const errorGroups: Record<string, any[]> = {};

    failed.forEach((w: any) => {
      const errorKey = w.error?.substring(0, 100) || 'Unknown error';
      if (!errorGroups[errorKey]) {
        errorGroups[errorKey] = [];
      }
      errorGroups[errorKey].push(w);
    });

    console.log('Error types:\n');
    Object.entries(errorGroups)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([error, wfs]) => {
        console.log(`${wfs.length}x: ${error}`);
        console.log(`   Latest: ${wfs[0].id.substring(0, 20)}...`);
        console.log('');
      });
  }

  // Check for missing workflows (expected vs actual)
  const last7Days = workflows.filter((w: any) => {
    const created = w.createdAt;
    if (!created) return false;

    let time = 0;
    if (typeof created === 'number') {
      time = created;
    } else if (created instanceof Timestamp) {
      time = created.toMillis();
    } else if (created.toDate) {
      time = created.toDate().getTime();
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return time > sevenDaysAgo;
  });

  console.log('=== Last 7 Days Analysis ===\n');
  console.log(`Total workflows: ${last7Days.length}`);
  console.log(`Expected: ${7 * 5} (5 per day × 7 days)`);
  console.log(`Success rate: ${((last7Days.filter((w: any) => w.status === 'completed').length / last7Days.length) * 100).toFixed(1)}%`);
  console.log(`Missing workflows: ${35 - last7Days.length}\n`);

  // Check if cron might be skipping runs
  if (last7Days.length < 30) {
    console.log('⚠️  WARNING: Fewer workflows than expected!');
    console.log('   Possible causes:');
    console.log('   1. Cron job not running on schedule');
    console.log('   2. No articles available to process');
    console.log('   3. Budget limits preventing workflow creation');
  }
}

checkFailures().catch(console.error);
