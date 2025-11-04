/**
 * Retry all workflows stuck at "posting" status using optimal scheduling
 *
 * This script:
 * 1. Finds all workflows with status="posting"
 * 2. For each, triggers process-video endpoint to retry with scheduling
 * 3. Tracks success/failure
 */

import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const BRANDS = ['carz', 'ownerfi', 'vassdistro', 'podcast', 'benefit'];
const PROCESS_VIDEO_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/process-video`
  : 'https://ownerfi.ai/api/process-video';

interface WorkflowDoc {
  id: string;
  brand: string;
  status: string;
  finalVideoUrl?: string;
  submagicProjectId?: string;
  videoIndex?: number;
  createdAt: number;
}

async function retryStuckWorkflows() {
  console.log('🔍 Finding workflows stuck at "posting" status...\n');

  const stuckWorkflows: WorkflowDoc[] = [];

  for (const brand of BRANDS) {
    const collectionName = brand === 'podcast' ? 'podcast_workflow_queue' :
                          brand === 'benefit' ? 'benefit_workflow_queue' :
                          brand === 'property' ? 'property_videos' :
                          `${brand}_workflow_queue`;

    try {
      const qSnapshot = await getDocs(
        query(
          collection(db, collectionName),
          where('status', '==', 'posting'),
          orderBy('createdAt', 'asc')
        )
      );

      qSnapshot.forEach(doc => {
        const data = doc.data();
        stuckWorkflows.push({
          id: doc.id,
          brand,
          status: data.status,
          finalVideoUrl: data.finalVideoUrl,
          submagicProjectId: data.submagicProjectId,
          videoIndex: data.videoIndex,
          createdAt: data.createdAt
        });
      });

      if (qSnapshot.size > 0) {
        console.log(`📦 ${brand}: ${qSnapshot.size} workflows stuck at "posting"`);
      }
    } catch (error) {
      console.error(`❌ Error checking ${brand}:`, error instanceof Error ? error.message : error);
    }
  }

  if (stuckWorkflows.length === 0) {
    console.log('\n✅ No stuck workflows found!');
    return;
  }

  console.log(`\n📊 Total stuck workflows: ${stuckWorkflows.length}`);
  console.log('━'.repeat(80));

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const workflow of stuckWorkflows) {
    console.log(`\n🔄 Retrying ${workflow.brand} workflow: ${workflow.id}`);
    console.log(`   Created: ${new Date(workflow.createdAt).toLocaleString()}`);
    console.log(`   Video Index: ${workflow.videoIndex ?? 'NOT SET'}`);
    console.log(`   Video URL: ${workflow.finalVideoUrl ? 'EXISTS' : 'MISSING'}`);

    if (!workflow.finalVideoUrl && !workflow.submagicProjectId) {
      console.log(`   ⚠️  SKIP: No video URL or Submagic project ID`);
      results.failed++;
      results.errors.push(`${workflow.brand}/${workflow.id}: No video URL or project ID`);
      continue;
    }

    try {
      const response = await fetch(PROCESS_VIDEO_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand: workflow.brand,
          workflowId: workflow.id,
          videoUrl: workflow.finalVideoUrl,
          submagicProjectId: workflow.submagicProjectId
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`   ✅ Success!`);
        console.log(`   Post IDs: ${data.postIds}`);
        console.log(`   Platforms: ${data.totalPlatforms}`);
        console.log(`   Time slots: ${data.timeSlots}`);
        results.success++;
      } else {
        console.log(`   ❌ Failed: ${data.error || 'Unknown error'}`);
        results.failed++;
        results.errors.push(`${workflow.brand}/${workflow.id}: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`   ❌ Error: ${errorMsg}`);
      results.failed++;
      results.errors.push(`${workflow.brand}/${workflow.id}: ${errorMsg}`);
    }

    // Wait 2 seconds between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '━'.repeat(80));
  console.log('📊 RESULTS:');
  console.log(`   ✅ Success: ${results.success}`);
  console.log(`   ❌ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n🚨 ERRORS:');
    results.errors.forEach(err => console.log(`   - ${err}`));
  }
}

retryStuckWorkflows().catch(error => {
  console.error('\n❌ Script error:', error);
  process.exit(1);
});
