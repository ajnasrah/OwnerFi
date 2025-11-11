/**
 * Check workflows stuck at submagic_processing status
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';

const BRANDS = ['carz', 'ownerfi', 'vassdistro', 'podcast', 'benefit', 'abdullah'];

async function checkStuckSubmagicWorkflows() {
  console.log('🔍 Checking for workflows stuck at submagic_processing...\n');

  const allStuck: any[] = [];

  for (const brand of BRANDS) {
    const collectionName = brand === 'podcast' ? 'podcast_workflow_queue' :
                          brand === 'benefit' ? 'benefit_workflow_queue' :
                          `${brand}_workflow_queue`;

    try {
      const qSnapshot = await getDocs(
        query(
          collection(db, collectionName),
          where('status', '==', 'submagic_processing'),
          orderBy('updatedAt', 'asc'),
          firestoreLimit(20)
        )
      );

      if (qSnapshot.size > 0) {
        console.log(`\n📦 ${brand.toUpperCase()}: ${qSnapshot.size} workflows stuck`);
        console.log('━'.repeat(80));

        qSnapshot.forEach(doc => {
          const data = doc.data();
          const submagicId = data.submagicVideoId || data.submagicProjectId;
          const timestamp = data.statusChangedAt || data.updatedAt || 0;
          const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);
          const createdAt = new Date(data.createdAt || 0).toLocaleString();

          console.log(`\nWorkflow: ${doc.id}`);
          console.log(`  Created: ${createdAt}`);
          console.log(`  Stuck for: ${stuckMinutes} minutes`);
          console.log(`  Submagic ID: ${submagicId || 'MISSING'}`);
          console.log(`  Video Index: ${data.videoIndex ?? 'NOT SET'}`);
          console.log(`  Title: ${data.title || 'N/A'}`);

          allStuck.push({
            brand,
            workflowId: doc.id,
            submagicId,
            stuckMinutes,
            createdAt: data.createdAt,
            videoIndex: data.videoIndex,
            title: data.title
          });
        });
      }
    } catch (error) {
      console.error(`❌ Error checking ${brand}:`, error instanceof Error ? error.message : error);
    }
  }

  // Check property_videos
  try {
    const qSnapshot = await getDocs(
      query(
        collection(db, 'property_videos'),
        where('status', '==', 'submagic_processing'),
        orderBy('updatedAt', 'asc'),
        firestoreLimit(20)
      )
    );

    if (qSnapshot.size > 0) {
      console.log(`\n📦 PROPERTY: ${qSnapshot.size} videos stuck`);
      console.log('━'.repeat(80));

      qSnapshot.forEach(doc => {
        const data = doc.data();
        const submagicId = data.submagicVideoId || data.submagicProjectId;
        const timestamp = data.updatedAt || 0;
        const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);
        const createdAt = new Date(data.createdAt || 0).toLocaleString();

        console.log(`\nProperty: ${doc.id}`);
        console.log(`  Created: ${createdAt}`);
        console.log(`  Stuck for: ${stuckMinutes} minutes`);
        console.log(`  Submagic ID: ${submagicId || 'MISSING'}`);
        console.log(`  Address: ${data.address || 'N/A'}`);

        allStuck.push({
          brand: 'property',
          workflowId: doc.id,
          submagicId,
          stuckMinutes,
          createdAt: data.createdAt,
          address: data.address
        });
      });
    }
  } catch (error) {
    console.error(`❌ Error checking property_videos:`, error instanceof Error ? error.message : error);
  }

  console.log('\n' + '━'.repeat(80));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total stuck: ${allStuck.length}`);

  if (allStuck.length > 0) {
    const withSubmagicId = allStuck.filter(w => w.submagicId).length;
    const missingId = allStuck.length - withSubmagicId;

    console.log(`   With Submagic ID: ${withSubmagicId}`);
    console.log(`   Missing Submagic ID: ${missingId}`);

    // Find stuck >30 min
    const stuck30Plus = allStuck.filter(w => w.stuckMinutes > 30);
    if (stuck30Plus.length > 0) {
      console.log(`\n⚠️  ${stuck30Plus.length} workflows stuck >30 minutes:`);
      stuck30Plus.forEach(w => {
        console.log(`      ${w.brand}/${w.workflowId} - ${w.stuckMinutes} min`);
      });
    }

    // Show next steps
    console.log(`\n💡 NEXT STEPS:`);
    console.log(`   1. Run check-stuck-submagic cron to auto-recover`);
    console.log(`   2. Or manually trigger process-video for each workflow`);
    console.log(`   3. Workflows missing Submagic ID (stuck >30 min) will be marked as failed`);
  } else {
    console.log('   ✅ No workflows stuck at submagic_processing!');
  }
}

checkStuckSubmagicWorkflows().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
