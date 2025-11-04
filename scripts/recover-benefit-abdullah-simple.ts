/**
 * Recover stuck benefit and abdullah workflows
 * Uses simple query without orderBy to avoid needing index
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ownerfi.ai';

if (!SUBMAGIC_API_KEY) {
  throw new Error('SUBMAGIC_API_KEY not configured');
}

async function recoverStuckWorkflows() {
  console.log('🔧 Recovering stuck benefit and abdullah workflows...\n');

  const stats = {
    found: 0,
    recovered: 0,
    failed: 0,
    stillProcessing: 0
  };

  // Check benefit_workflow_queue
  console.log('📦 === BENEFIT ===');
  for (const status of ['submagic_processing', 'video_processing']) {
    try {
      const q = query(
        collection(db, 'benefit_workflow_queue'),
        where('status', '==', status)
      );

      const snapshot = await getDocs(q);

      if (snapshot.size === 0) continue;

      console.log(`\n  Found ${snapshot.size} workflows stuck at ${status}`);
      stats.found += snapshot.size;

      for (const docSnapshot of snapshot.docs) {
        const workflow = docSnapshot.data();
        const workflowId = docSnapshot.id;
        const submagicId = workflow.submagicProjectId || workflow.submagicVideoId;

        console.log(`\n  🔍 ${workflowId}`);
        console.log(`     Status: ${status}`);
        console.log(`     Submagic ID: ${submagicId || 'MISSING'}`);

        if (!submagicId) {
          console.log(`     ⚠️  No Submagic ID - skipping`);
          stats.failed++;
          continue;
        }

        // Check Submagic status
        try {
          const response = await fetch(`https://api.submagic.co/v1/projects/${submagicId}`, {
            headers: { 'x-api-key': SUBMAGIC_API_KEY }
          });

          if (!response.ok) {
            console.error(`     ❌ Submagic API error: ${response.status}`);
            stats.failed++;
            continue;
          }

          const data = await response.json();
          const submagicStatus = data.status;
          const downloadUrl = data.media_url || data.video_url || data.downloadUrl || data.directUrl;

          console.log(`     Submagic Status: ${submagicStatus}`);

          if (submagicStatus === 'completed' && downloadUrl) {
            console.log(`     ✅ Video ready - triggering process-video...`);

            const processResponse = await fetch(`${SITE_URL}/api/process-video`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                brand: 'benefit',
                workflowId,
                videoUrl: downloadUrl,
                submagicProjectId: submagicId
              })
            });

            const processData = await processResponse.json();

            if (processResponse.ok && processData.success) {
              console.log(`     ✅ RECOVERED!`);
              stats.recovered++;
            } else {
              console.error(`     ❌ Failed: ${processData.error}`);
              stats.failed++;
            }
          } else {
            console.log(`     ⏳ Still processing (${submagicStatus})`);
            stats.stillProcessing++;
          }
        } catch (error) {
          console.error(`     ❌ Error:`, error instanceof Error ? error.message : error);
          stats.failed++;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`\n  ❌ Error checking ${status}:`, error instanceof Error ? error.message : error);
    }
  }

  // Check abdullah_content_queue
  console.log('\n📦 === ABDULLAH ===');
  for (const status of ['submagic_processing', 'video_processing']) {
    try {
      const q = query(
        collection(db, 'abdullah_content_queue'),
        where('status', '==', status)
      );

      const snapshot = await getDocs(q);

      if (snapshot.size === 0) continue;

      console.log(`\n  Found ${snapshot.size} workflows stuck at ${status}`);
      stats.found += snapshot.size;

      for (const docSnapshot of snapshot.docs) {
        const workflow = docSnapshot.data();
        const workflowId = docSnapshot.id;
        const submagicId = workflow.submagicProjectId || workflow.submagicVideoId;

        console.log(`\n  🔍 ${workflowId}`);
        console.log(`     Status: ${status}`);
        console.log(`     Submagic ID: ${submagicId || 'MISSING'}`);

        if (!submagicId) {
          console.log(`     ⚠️  No Submagic ID - skipping`);
          stats.failed++;
          continue;
        }

        // Check Submagic status
        try {
          const response = await fetch(`https://api.submagic.co/v1/projects/${submagicId}`, {
            headers: { 'x-api-key': SUBMAGIC_API_KEY }
          });

          if (!response.ok) {
            console.error(`     ❌ Submagic API error: ${response.status}`);
            stats.failed++;
            continue;
          }

          const data = await response.json();
          const submagicStatus = data.status;
          const downloadUrl = data.media_url || data.video_url || data.downloadUrl || data.directUrl;

          console.log(`     Submagic Status: ${submagicStatus}`);

          if (submagicStatus === 'completed' && downloadUrl) {
            console.log(`     ✅ Video ready - triggering process-video...`);

            const processResponse = await fetch(`${SITE_URL}/api/process-video`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                brand: 'abdullah',
                workflowId,
                videoUrl: downloadUrl,
                submagicProjectId: submagicId
              })
            });

            const processData = await processResponse.json();

            if (processResponse.ok && processData.success) {
              console.log(`     ✅ RECOVERED!`);
              stats.recovered++;
            } else {
              console.error(`     ❌ Failed: ${processData.error}`);
              stats.failed++;
            }
          } else {
            console.log(`     ⏳ Still processing (${submagicStatus})`);
            stats.stillProcessing++;
          }
        } catch (error) {
          console.error(`     ❌ Error:`, error instanceof Error ? error.message : error);
          stats.failed++;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`\n  ❌ Error checking ${status}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 FINAL RESULTS:');
  console.log(`   Found: ${stats.found}`);
  console.log(`   ✅ Recovered: ${stats.recovered}`);
  console.log(`   ⏳ Still Processing: ${stats.stillProcessing}`);
  console.log(`   ❌ Failed: ${stats.failed}`);
  console.log('='.repeat(80));
}

recoverStuckWorkflows().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
