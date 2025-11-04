/**
 * Recover workflows stuck at submagic_processing by checking Submagic API
 * and completing those that are ready
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit, doc, updateDoc } from 'firebase/firestore';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
if (!SUBMAGIC_API_KEY) {
  throw new Error('SUBMAGIC_API_KEY not configured');
}

const BRANDS = ['carz', 'ownerfi', 'vassdistro', 'podcast'];

interface StuckWorkflow {
  brand: string;
  workflowId: string;
  submagicId: string;
  collectionName: string;
  isPodcast: boolean;
  isProperty: boolean;
}

async function recoverStuckSubmagicWorkflows() {
  console.log('🔧 Recovering workflows stuck at submagic_processing...\n');

  const stuckWorkflows: StuckWorkflow[] = [];

  // Find all stuck workflows
  for (const brand of BRANDS) {
    const collectionName = brand === 'podcast' ? 'podcast_workflow_queue' : `${brand}_workflow_queue`;

    try {
      const qSnapshot = await getDocs(
        query(
          collection(db, collectionName),
          where('status', '==', 'submagic_processing'),
          orderBy('updatedAt', 'asc'),
          firestoreLimit(10)
        )
      );

      qSnapshot.forEach(d => {
        const data = d.data();
        const submagicId = data.submagicVideoId || data.submagicProjectId;

        if (submagicId) {
          stuckWorkflows.push({
            brand,
            workflowId: d.id,
            submagicId,
            collectionName,
            isPodcast: brand === 'podcast',
            isProperty: false
          });
        }
      });

      console.log(`📦 ${brand}: Found ${qSnapshot.size} stuck workflows`);
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
        firestoreLimit(10)
      )
    );

    qSnapshot.forEach(d => {
      const data = d.data();
      const submagicId = data.submagicVideoId || data.submagicProjectId;

      if (submagicId) {
        stuckWorkflows.push({
          brand: 'property',
          workflowId: d.id,
          submagicId,
          collectionName: 'property_videos',
          isPodcast: false,
          isProperty: true
        });
      }
    });

    console.log(`📦 property: Found ${qSnapshot.size} stuck videos`);
  } catch (error) {
    console.error(`❌ Error checking property_videos:`, error instanceof Error ? error.message : error);
  }

  console.log(`\n📊 Total stuck workflows: ${stuckWorkflows.length}`);
  console.log('━'.repeat(80));

  const results = {
    recovered: 0,
    stillProcessing: 0,
    failed: 0,
    errors: [] as string[]
  };

  // Process each stuck workflow
  for (const workflow of stuckWorkflows) {
    console.log(`\n🔍 Checking ${workflow.brand}/${workflow.workflowId}`);
    console.log(`   Submagic ID: ${workflow.submagicId}`);

    try {
      // Check Submagic status
      const response = await fetch(`https://api.submagic.co/v1/projects/${workflow.submagicId}`, {
        headers: { 'x-api-key': SUBMAGIC_API_KEY }
      });

      if (!response.ok) {
        console.error(`   ❌ Submagic API error: ${response.status}`);
        results.failed++;
        results.errors.push(`${workflow.brand}/${workflow.workflowId}: API ${response.status}`);
        continue;
      }

      const data = await response.json();
      const status = data.status;
      const downloadUrl = data.media_url || data.video_url || data.downloadUrl || data.directUrl;

      console.log(`   Status: ${status}`);
      console.log(`   Download URL: ${downloadUrl ? 'EXISTS' : 'MISSING'}`);

      if (status === 'completed' || status === 'done' || status === 'ready') {
        if (!downloadUrl) {
          console.log(`   ⚠️  Complete but no download URL - triggering export...`);

          // Trigger export
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ownerfi.ai';
          const webhookUrl = `${baseUrl}/api/webhooks/submagic/${workflow.brand}`;

          const exportResponse = await fetch(`https://api.submagic.co/v1/projects/${workflow.submagicId}/export`, {
            method: 'POST',
            headers: {
              'x-api-key': SUBMAGIC_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              webhookUrl,
              format: 'mp4',
              quality: 'high'
            })
          });

          if (exportResponse.ok) {
            console.log(`   ✅ Export triggered - webhook will fire when complete`);
            results.stillProcessing++;
          } else {
            const exportError = await exportResponse.text();
            console.error(`   ❌ Export failed:`, exportError);
            results.failed++;
            results.errors.push(`${workflow.brand}/${workflow.workflowId}: Export failed - ${exportError}`);
          }
        } else {
          console.log(`   ✅ Video ready! Triggering process-video...`);

          // Call process-video endpoint to complete the workflow
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ownerfi.ai';
          const processResponse = await fetch(`${baseUrl}/api/process-video`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              brand: workflow.brand,
              workflowId: workflow.workflowId,
              videoUrl: downloadUrl,
              submagicProjectId: workflow.submagicId
            })
          });

          const processData = await processResponse.json();

          if (processResponse.ok && processData.success) {
            console.log(`   ✅ Workflow recovered!`);
            console.log(`   Post IDs: ${processData.postIds}`);
            results.recovered++;
          } else {
            console.error(`   ❌ Process-video failed: ${processData.error || 'Unknown error'}`);
            results.failed++;
            results.errors.push(`${workflow.brand}/${workflow.workflowId}: ${processData.error || 'Unknown error'}`);
          }
        }
      } else {
        console.log(`   ⏳ Still processing (${status})`);
        results.stillProcessing++;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`   ❌ Error:`, errorMsg);
      results.failed++;
      results.errors.push(`${workflow.brand}/${workflow.workflowId}: ${errorMsg}`);
    }

    // Wait 2 seconds between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '━'.repeat(80));
  console.log('📊 RESULTS:');
  console.log(`   ✅ Recovered: ${results.recovered}`);
  console.log(`   ⏳ Still processing: ${results.stillProcessing}`);
  console.log(`   ❌ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n🚨 ERRORS:');
    results.errors.forEach(err => console.log(`   - ${err}`));
  }
}

recoverStuckSubmagicWorkflows().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
