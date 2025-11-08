#!/usr/bin/env tsx
/**
 * Fix Stuck Benefit Workflows
 *
 * Manually complete the two benefit workflows that are stuck in submagic_processing
 * even though Submagic has completed them.
 */

import { getAdminDb } from '../src/lib/firebase-admin';
import { postToLate } from '../src/lib/late-api';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

interface WorkflowData {
  id: string;
  status: string;
  submagicVideoId: string;
  heygenVideoId?: string;
  benefitTitle?: string;
  caption?: string;
  title?: string;
  createdAt: number;
  brand?: string;
  audience?: string;
}

async function checkSubmagicStatus(projectId: string): Promise<any> {
  if (!SUBMAGIC_API_KEY) {
    throw new Error('SUBMAGIC_API_KEY not set');
  }

  const response = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
    headers: {
      'x-api-key': SUBMAGIC_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Submagic API error: ${response.status}`);
  }

  return response.json();
}

async function downloadAndPostVideo(
  workflowId: string,
  workflow: WorkflowData,
  videoUrl: string,
  adminDb: any
) {
  console.log(`   📥 Downloading video from: ${videoUrl.substring(0, 60)}...`);

  // Download the video
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.status}`);
  }

  const videoBuffer = await videoResponse.arrayBuffer();
  const videoSize = videoBuffer.byteLength;
  console.log(`   ✅ Downloaded ${(videoSize / 1024 / 1024).toFixed(2)} MB`);

  // Upload to Firebase Storage
  const { uploadVideoToStorage } = await import('../src/lib/video-storage');
  console.log(`   📤 Uploading to Firebase Storage...`);

  const storageUrl = await uploadVideoToStorage(
    Buffer.from(videoBuffer),
    `benefit/${workflowId}.mp4`
  );

  console.log(`   ✅ Uploaded to Firebase: ${storageUrl}`);

  // Update workflow with storage URL
  await adminDb.collection('benefit_workflow_queue').doc(workflowId).update({
    submagicDownloadUrl: videoUrl,
    finalVideoUrl: storageUrl,
    status: 'posting_to_social',
    updatedAt: Date.now()
  });

  // Post to Late
  console.log(`   📱 Posting to social media via Late...`);

  const lateResult = await postToLate({
    videoUrl: storageUrl,
    caption: workflow.caption || workflow.title || 'Owner financing benefit',
    title: workflow.title || 'Owner Financing Benefit',
    platforms: ['instagram', 'tiktok', 'youtube', 'facebook'],
    brand: 'ownerfi',
    useQueue: true,
    timezone: 'America/New_York'
  });

  if (!lateResult.success) {
    throw new Error(`Late posting failed: ${lateResult.error}`);
  }

  console.log(`   ✅ Posted to Late (Post ID: ${lateResult.postId})`);
  console.log(`   📅 Scheduled for: ${lateResult.scheduledFor}`);

  // Update workflow to completed
  await adminDb.collection('benefit_workflow_queue').doc(workflowId).update({
    status: 'completed',
    latePostId: lateResult.postId,
    scheduledFor: lateResult.scheduledFor,
    completedAt: Date.now(),
    updatedAt: Date.now()
  });

  console.log(`   ✅ Workflow completed!\n`);
}

async function main() {
  console.log('🔧 Fixing Stuck Benefit Workflows\n');
  console.log('═'.repeat(60));

  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('❌ Firebase Admin not initialized. Make sure FIREBASE_* env vars are set.');
    process.exit(1);
  }

  // The two stuck workflows
  const stuckWorkflows = [
    {
      id: 'benefit_1762604448565_5ci84np8l',
      submagicId: '927877ac-cf3e-409a-844f-f163b983f0eb',
      title: 'Negotiate Better Terms'
    },
    {
      id: 'benefit_1762593648706_4ee4831dg',
      submagicId: '80e0d0b1-f23a-428a-b866-b937682f778f',
      title: 'Avoid PMI and Excessive Fees'
    }
  ];

  for (const stuck of stuckWorkflows) {
    console.log(`\n📋 Processing: ${stuck.title}`);
    console.log(`   Workflow ID: ${stuck.id}`);
    console.log(`   Submagic ID: ${stuck.submagicId}`);

    try {
      // Get workflow data
      const workflowDoc = await adminDb.collection('benefit_workflow_queue').doc(stuck.id).get();

      if (!workflowDoc.exists) {
        console.log(`   ⚠️  Workflow not found - skipping`);
        continue;
      }

      const workflow = workflowDoc.data() as WorkflowData;

      // Check Submagic status
      console.log(`   🔍 Checking Submagic status...`);
      const submagicData = await checkSubmagicStatus(stuck.submagicId);
      console.log(`   Submagic Status: ${submagicData.status}`);

      if (submagicData.status === 'completed' || submagicData.status === 'done' || submagicData.status === 'ready') {
        const videoUrl = submagicData.media_url || submagicData.mediaUrl || submagicData.video_url || submagicData.videoUrl || submagicData.downloadUrl || submagicData.download_url;

        if (videoUrl) {
          await downloadAndPostVideo(stuck.id, workflow, videoUrl, adminDb);
        } else {
          console.log(`   ⚠️  No video URL in Submagic response`);
        }
      } else {
        console.log(`   ⏳ Still processing (${submagicData.status})`);
      }

      // Rate limit: wait 2 seconds between workflows
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`   ❌ Error processing workflow: ${error instanceof Error ? error.message : error}`);

      // Mark workflow as failed
      try {
        await adminDb.collection('benefit_workflow_queue').doc(stuck.id).update({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          failedAt: Date.now(),
          updatedAt: Date.now()
        });
        console.log(`   ❌ Workflow marked as failed`);
      } catch (updateError) {
        console.error(`   ❌ Failed to update workflow: ${updateError}`);
      }
    }
  }

  console.log('\n═'.repeat(60));
  console.log('✅ Processing complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
