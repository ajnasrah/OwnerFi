/**
 * Check if we have workflows with Late post IDs
 */

import { getAdminDb } from '../src/lib/firebase-admin';

async function checkLateData() {
  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('❌ Firebase Admin not initialized');
    return;
  }

  const collections = [
    { name: 'carz_workflow_queue', brand: 'Carz' },
    { name: 'ownerfi_workflow_queue', brand: 'OwnerFi' },
    { name: 'podcast_workflow_queue', brand: 'Podcast' },
    { name: 'vassdistro_workflow_queue', brand: 'VassDistro' },
    { name: 'abdullah_workflow_queue', brand: 'Abdullah' },
  ];

  console.log('📊 Checking workflows with Late post IDs...\n');

  let totalWithLateIds = 0;
  let totalWorkflows = 0;

  for (const { name, brand } of collections) {
    try {
      // Check workflows with Late post IDs
      const withLateId = await (adminDb as any)
        .collection(name)
        .where('latePostId', '!=', null)
        .limit(10)
        .get();

      // Check total workflows
      const total = await (adminDb as any)
        .collection(name)
        .limit(100)
        .get();

      totalWithLateIds += withLateId.size;
      totalWorkflows += total.size;

      console.log(`${brand}:`);
      console.log(`  ✓ ${withLateId.size} workflows with Late post IDs`);
      console.log(`  ✓ ${total.size} total workflows (showing first 100)`);

      // Show sample workflow with Late ID
      if (!withLateId.empty) {
        const sample = withLateId.docs[0].data();
        console.log(`  Sample workflow: ${sample.latePostId}`);
        console.log(`    Status: ${sample.status || 'N/A'}`);
        console.log(`    Created: ${sample.createdAt ? new Date(sample.createdAt).toLocaleDateString() : 'N/A'}`);
      }
      console.log('');
    } catch (error) {
      console.error(`  ❌ Error checking ${brand}:`, error);
    }
  }

  console.log('═══════════════════════════════════════');
  console.log(`Total workflows with Late IDs: ${totalWithLateIds}`);
  console.log(`Total workflows checked: ${totalWorkflows}`);
  console.log('═══════════════════════════════════════\n');

  if (totalWithLateIds === 0) {
    console.log('⚠️  No workflows found with Late post IDs.');
    console.log('   This means analytics sync won\'t have any data to pull.');
    console.log('   Make sure your workflows are posting to Late.dev successfully.\n');
  } else {
    console.log('✅ You can now sync analytics data from Late.dev!');
    console.log('   Click "Sync Analytics Data" in the dashboard or run:');
    console.log('   npx tsx scripts/collect-analytics-data.ts\n');
  }

  // Check if workflow_analytics collection has any data
  const analyticsSnap = await (adminDb as any)
    .collection('workflow_analytics')
    .limit(5)
    .get();

  console.log(`📈 Current analytics records: ${analyticsSnap.size}`);
  if (analyticsSnap.empty) {
    console.log('   (Empty - need to sync data first)');
  } else {
    console.log('   Sample analytics:');
    analyticsSnap.docs.slice(0, 3).forEach((doc: any) => {
      const data = doc.data();
      console.log(`   - ${data.brand}: ${data.totalViews || 0} views, ${(data.overallEngagementRate || 0).toFixed(2)}% engagement`);
    });
  }
}

checkLateData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
