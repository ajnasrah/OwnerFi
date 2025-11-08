/**
 * Recovery Script for Stuck Abdullah Workflows
 *
 * This script:
 * 1. Finds all stuck abdullah workflows
 * 2. Checks their current status and diagnoses issues
 * 3. Attempts to recover them by:
 *    - Re-triggering Submagic if HeyGen video is ready but Submagic failed
 *    - Re-posting to Late if final video is ready but posting failed
 *    - Logging issues that need manual intervention
 */

// Load environment variables
import * as dotenv from 'dotenv';
import * as path from 'path';

// Try to load .env.local
try {
  const result = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  if (result.error) {
    console.warn('⚠️  Could not load .env.local:', result.error.message);
  } else {
    console.log('✅ Environment variables loaded from .env.local\n');
  }
} catch (error) {
  console.warn('⚠️  Error loading environment:', error);
}

import { getAdminDb } from '../src/lib/firebase-admin';

interface AbdullahWorkflow {
  id: string;
  status: string;
  articleTitle?: string;
  caption?: string;
  title?: string;
  heygenVideoId?: string;
  heygenVideoUrl?: string;
  submagicProjectId?: string;
  submagicVideoId?: string;
  submagicDownloadUrl?: string;
  finalVideoUrl?: string;
  latePostId?: string;
  error?: string;
  createdAt?: number;
  updatedAt?: number;
  failedAt?: number;
}

async function recoverStuckAbdullahWorkflows() {
  console.log('🔧 Starting Abdullah Workflows Recovery...\n');

  try {
    const adminDb = await getAdminDb();

    if (!adminDb) {
      throw new Error('Failed to initialize Firebase Admin - adminDb is null');
    }

    const collection = adminDb.collection('abdullah_workflow_queue');

  // Find all workflows that are NOT completed
  const snapshot = await collection
    .where('status', '!=', 'completed')
    .get();

  if (snapshot.empty) {
    console.log('✅ No stuck workflows found!');
    return;
  }

  console.log(`📊 Found ${snapshot.size} non-completed workflows\n`);

  const workflows: AbdullahWorkflow[] = [];
  snapshot.forEach(doc => {
    workflows.push({ id: doc.id, ...doc.data() } as AbdullahWorkflow);
  });

  // Sort by creation time (oldest first)
  workflows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  const results = {
    recovered: 0,
    alreadyProcessing: 0,
    needsManualIntervention: 0,
    errors: [] as string[]
  };

  for (const workflow of workflows) {
    const age = workflow.createdAt
      ? `${Math.round((Date.now() - workflow.createdAt) / (1000 * 60 * 60))}h ago`
      : 'unknown age';

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📋 Workflow: ${workflow.id}`);
    console.log(`   Title: ${workflow.articleTitle || workflow.title || 'Unknown'}`);
    console.log(`   Status: ${workflow.status}`);
    console.log(`   Age: ${age}`);

    if (workflow.error) {
      console.log(`   Error: ${workflow.error}`);
    }

    try {
      // Analyze workflow status and attempt recovery
      const recoveryResult = await analyzeAndRecover(workflow, collection);

      if (recoveryResult.recovered) {
        results.recovered++;
        console.log(`✅ ${recoveryResult.action}`);
      } else if (recoveryResult.alreadyProcessing) {
        results.alreadyProcessing++;
        console.log(`⏳ ${recoveryResult.action}`);
      } else {
        results.needsManualIntervention++;
        console.log(`⚠️  ${recoveryResult.action}`);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push(`${workflow.id}: ${errorMsg}`);
      console.error(`❌ Recovery failed: ${errorMsg}`);
    }
  }

  // Print summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 RECOVERY SUMMARY');
  console.log(`${'='.repeat(80)}`);
  console.log(`✅ Recovered: ${results.recovered}`);
  console.log(`⏳ Already processing: ${results.alreadyProcessing}`);
  console.log(`⚠️  Needs manual intervention: ${results.needsManualIntervention}`);

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors encountered (${results.errors.length}):`);
    results.errors.forEach(err => console.log(`   - ${err}`));
  }

  console.log(`\n${'='.repeat(80)}\n`);
  } catch (error) {
    console.error('❌ Failed to recover workflows:', error);
    throw error;
  }
}

async function analyzeAndRecover(
  workflow: AbdullahWorkflow,
  collection: any
): Promise<{ recovered: boolean; alreadyProcessing: boolean; action: string }> {

  // Case 1: HeyGen is processing - let it finish
  if (workflow.status === 'heygen_processing') {
    // Check if HeyGen video is actually ready
    if (workflow.heygenVideoId) {
      console.log(`   🔍 Checking HeyGen video status...`);
      const heygenStatus = await checkHeyGenStatus(workflow.heygenVideoId);

      if (heygenStatus === 'completed' && workflow.heygenVideoUrl) {
        console.log(`   💡 HeyGen completed but webhook missed! Triggering Submagic...`);
        await triggerSubmagicProcessing(workflow);
        return { recovered: true, alreadyProcessing: false, action: 'Triggered Submagic processing' };
      } else if (heygenStatus === 'processing') {
        return { recovered: false, alreadyProcessing: true, action: 'HeyGen still processing' };
      } else if (heygenStatus === 'failed') {
        await collection.doc(workflow.id).update({
          status: 'failed',
          error: 'HeyGen generation failed',
          failedAt: Date.now()
        });
        return { recovered: false, alreadyProcessing: false, action: 'Marked as failed (HeyGen failed)' };
      }
    }
    return { recovered: false, alreadyProcessing: true, action: 'Waiting for HeyGen' };
  }

  // Case 2: Submagic is processing - let it finish
  if (workflow.status === 'submagic_processing') {
    if (workflow.submagicProjectId) {
      console.log(`   🔍 Checking Submagic project status...`);
      const submagicStatus = await checkSubmagicStatus(workflow.submagicProjectId);

      if (submagicStatus.status === 'completed' && submagicStatus.videoUrl) {
        console.log(`   💡 Submagic completed but webhook missed! Triggering video processing...`);
        await triggerVideoProcessing(workflow, submagicStatus.videoUrl);
        return { recovered: true, alreadyProcessing: false, action: 'Triggered video processing' };
      } else if (submagicStatus.status === 'processing') {
        return { recovered: false, alreadyProcessing: true, action: 'Submagic still processing' };
      } else if (submagicStatus.status === 'failed') {
        await collection.doc(workflow.id).update({
          status: 'failed',
          error: 'Submagic processing failed',
          failedAt: Date.now()
        });
        return { recovered: false, alreadyProcessing: false, action: 'Marked as failed (Submagic failed)' };
      }
    }
    return { recovered: false, alreadyProcessing: true, action: 'Waiting for Submagic' };
  }

  // Case 3: Video processing - let it finish
  if (workflow.status === 'video_processing') {
    return { recovered: false, alreadyProcessing: true, action: 'Video processing in progress' };
  }

  // Case 4: Failed with Submagic error - retry if we have HeyGen video
  if (workflow.status === 'failed' && workflow.error?.includes('Submagic')) {
    if (workflow.heygenVideoUrl) {
      console.log(`   🔄 Retrying Submagic with HeyGen URL...`);
      await triggerSubmagicProcessing(workflow);
      return { recovered: true, alreadyProcessing: false, action: 'Retried Submagic processing' };
    } else {
      return { recovered: false, alreadyProcessing: false, action: 'Cannot retry - missing HeyGen video URL' };
    }
  }

  // Case 5: Failed with Late posting error - retry if we have final video
  if (workflow.status === 'failed' && workflow.error?.includes('Late posting failed')) {
    if (workflow.finalVideoUrl) {
      console.log(`   🔄 Retrying Late posting...`);
      await retryLatePosting(workflow);
      return { recovered: true, alreadyProcessing: false, action: 'Retried Late posting' };
    } else {
      return { recovered: false, alreadyProcessing: false, action: 'Cannot retry - missing final video URL' };
    }
  }

  // Case 6: Posting status - check if it actually posted
  if (workflow.status === 'posting') {
    if (workflow.latePostId) {
      // Already has post ID, mark as completed
      await collection.doc(workflow.id).update({
        status: 'completed',
        completedAt: Date.now()
      });
      return { recovered: true, alreadyProcessing: false, action: 'Marked as completed (has post ID)' };
    } else if (workflow.finalVideoUrl) {
      console.log(`   🔄 Retrying Late posting...`);
      await retryLatePosting(workflow);
      return { recovered: true, alreadyProcessing: false, action: 'Retried Late posting' };
    }
    return { recovered: false, alreadyProcessing: false, action: 'Stuck in posting - missing video URL' };
  }

  // Case 7: Generic failed status
  if (workflow.status === 'failed') {
    return { recovered: false, alreadyProcessing: false, action: `Failed: ${workflow.error || 'Unknown error'}` };
  }

  // Case 8: Unknown status
  return { recovered: false, alreadyProcessing: false, action: `Unknown status: ${workflow.status}` };
}

async function checkHeyGenStatus(videoId: string): Promise<'completed' | 'processing' | 'failed'> {
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_API_KEY) {
    console.warn('   ⚠️  HEYGEN_API_KEY not configured, cannot check status');
    return 'processing'; // Assume still processing
  }

  try {
    const response = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
      {
        headers: {
          'accept': 'application/json',
          'x-api-key': HEYGEN_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.warn(`   ⚠️  HeyGen API returned ${response.status}`);
      return 'processing';
    }

    const data = await response.json();
    const status = data.data?.status;

    if (status === 'completed') return 'completed';
    if (status === 'failed' || status === 'error') return 'failed';
    return 'processing';

  } catch (error) {
    console.warn(`   ⚠️  Error checking HeyGen status:`, error);
    return 'processing';
  }
}

async function checkSubmagicStatus(projectId: string): Promise<{ status: 'completed' | 'processing' | 'failed'; videoUrl?: string }> {
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
  if (!SUBMAGIC_API_KEY) {
    console.warn('   ⚠️  SUBMAGIC_API_KEY not configured, cannot check status');
    return { status: 'processing' };
  }

  try {
    const response = await fetch(
      `https://api.submagic.co/v1/projects/${projectId}`,
      {
        headers: {
          'x-api-key': SUBMAGIC_API_KEY
        }
      }
    );

    if (!response.ok) {
      console.warn(`   ⚠️  Submagic API returned ${response.status}`);
      return { status: 'processing' };
    }

    const data = await response.json();
    const status = data.status;
    const videoUrl = data.media_url || data.video_url || data.downloadUrl;

    if (status === 'completed' || status === 'done' || status === 'ready') {
      return { status: 'completed', videoUrl };
    }
    if (status === 'failed' || status === 'error') {
      return { status: 'failed' };
    }
    return { status: 'processing' };

  } catch (error) {
    console.warn(`   ⚠️  Error checking Submagic status:`, error);
    return { status: 'processing' };
  }
}

async function triggerSubmagicProcessing(workflow: AbdullahWorkflow): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

  console.log(`   📤 Calling HeyGen webhook to trigger Submagic...`);

  const response = await fetch(`${baseUrl}/api/webhooks/heygen/abdullah`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'avatar_video.success',
      event_data: {
        video_id: workflow.heygenVideoId,
        url: workflow.heygenVideoUrl,
        callback_id: workflow.id
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to trigger Submagic: ${response.status} - ${errorText}`);
  }

  console.log(`   ✅ Submagic processing triggered`);
}

async function triggerVideoProcessing(workflow: AbdullahWorkflow, videoUrl: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

  console.log(`   📤 Triggering video processing...`);

  const response = await fetch(`${baseUrl}/api/process-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      brand: 'abdullah',
      workflowId: workflow.id,
      videoUrl: videoUrl,
      submagicProjectId: workflow.submagicProjectId
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to trigger video processing: ${response.status} - ${errorText}`);
  }

  console.log(`   ✅ Video processing triggered`);
}

async function retryLatePosting(workflow: AbdullahWorkflow): Promise<void> {
  if (!workflow.finalVideoUrl) {
    throw new Error('Cannot retry Late posting - missing final video URL');
  }

  const { postVideoSameDay } = await import('../src/lib/same-day-posting');

  const caption = workflow.caption || 'Check out this video! 🔥';
  const title = workflow.title || workflow.articleTitle || 'Video';

  console.log(`   📤 Posting to Late...`);

  const result = await postVideoSameDay(
    workflow.finalVideoUrl,
    caption,
    title,
    'abdullah'
  );

  if (result.success) {
    const adminDb = await getAdminDb();
    const postIds = result.posts
      .map(p => p.result.postId)
      .filter(Boolean)
      .join(', ');

    await adminDb.collection('abdullah_workflow_queue').doc(workflow.id).update({
      status: 'completed',
      latePostId: postIds,
      completedAt: Date.now(),
      weeklyPosts: result.totalPosts,
      error: null // Clear previous error
    });

    console.log(`   ✅ Posted successfully (${result.totalPosts} posts)`);
  } else {
    throw new Error(`Late posting failed: ${result.errors.join('; ')}`);
  }
}

// Run the recovery
recoverStuckAbdullahWorkflows().catch(error => {
  console.error('💥 Recovery script failed:', error);
  process.exit(1);
});
