#!/usr/bin/env tsx
/**
 * Direct Fix for Stuck Submagic Workflows
 *
 * Directly updates workflows that are stuck in submagic_processing
 * when the Submagic API shows they're actually completed.
 */

import { getAdminDb } from '../src/lib/firebase-admin';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

interface WorkflowData {
  id: string;
  status: string;
  submagicVideoId: string;
  submagicProjectId?: string;
  heygenVideoId?: string;
  heygenVideoR2Url?: string;
  benefitTitle?: string;
  articleTitle?: string;
  episodeTitle?: string;
  createdAt: number;
  brand: string;
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

async function downloadAndUploadVideo(videoUrl: string, workflowId: string, brand: string): Promise<string> {
  console.log(`      📥 Downloading video from Submagic...`);

  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.status}`);
  }

  const videoBuffer = await videoResponse.arrayBuffer();
  const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });

  console.log(`      ☁️  Uploading to R2...`);

  // Upload to R2
  const formData = new FormData();
  formData.append('file', videoBlob, `${workflowId}.mp4`);
  formData.append('brand', brand);
  formData.append('workflowId', workflowId);

  const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upload/r2`, {
    method: 'POST',
    body: formData
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload to R2: ${uploadResponse.status}`);
  }

  const uploadData = await uploadResponse.json();
  return uploadData.url;
}

async function postToLate(videoUrl: string, workflow: any, brand: string): Promise<void> {
  console.log(`      📤 Posting to Late...`);

  const title = workflow.benefitTitle || workflow.articleTitle || workflow.episodeTitle || 'Video';

  // Get brand platforms
  const platforms = brand === 'benefit'
    ? ['facebook', 'instagram', 'tiktok', 'youtube']
    : ['facebook', 'instagram', 'tiktok'];

  const lateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/late/schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      brand,
      videoUrl,
      caption: title,
      platforms,
      workflowId: workflow.id
    })
  });

  if (!lateResponse.ok) {
    throw new Error(`Failed to post to Late: ${lateResponse.status}`);
  }
}

async function fixStuckWorkflows(brand: string, collectionName: string, adminDb: any) {
  console.log(`\n🔍 Fixing ${brand} workflows...`);

  try {
    const workflowsRef = adminDb.collection(collectionName);
    const snapshot = await workflowsRef
      .where('status', '==', 'submagic_processing')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    if (snapshot.empty) {
      console.log(`   ✅ No stuck workflows`);
      return;
    }

    console.log(`   Found ${snapshot.size} stuck workflows\n`);

    for (const doc of snapshot.docs) {
      const workflow = doc.data() as WorkflowData;
      const workflowId = doc.id;
      const title = workflow.benefitTitle || workflow.articleTitle || workflow.episodeTitle || 'N/A';
      const ageHours = Math.round((Date.now() - workflow.createdAt) / (1000 * 60 * 60));

      console.log(`   📋 ${workflowId}`);
      console.log(`      Title: ${title.substring(0, 60)}`);
      console.log(`      Age: ${ageHours}h`);

      const submagicId = workflow.submagicVideoId || workflow.submagicProjectId;
      console.log(`      Submagic ID: ${submagicId}`);

      if (!submagicId) {
        console.log(`      ⚠️  No Submagic ID - skipping`);
        continue;
      }

      try {
        // Check Submagic status
        const submagicData = await checkSubmagicStatus(submagicId);
        console.log(`      Submagic Status: ${submagicData.status}`);

        if (submagicData.status === 'completed' || submagicData.status === 'done' || submagicData.status === 'ready') {
          const videoUrl = submagicData.media_url || submagicData.mediaUrl || submagicData.video_url || submagicData.videoUrl || submagicData.downloadUrl || submagicData.download_url;

          if (videoUrl) {
            console.log(`      ✅ Video ready: ${videoUrl.substring(0, 60)}...`);

            try {
              // Download and upload to R2
              const r2Url = await downloadAndUploadVideo(videoUrl, workflowId, brand);
              console.log(`      ✅ Uploaded to R2: ${r2Url.substring(0, 60)}...`);

              // Post to Late
              await postToLate(r2Url, { ...workflow, id: workflowId }, brand);
              console.log(`      ✅ Posted to Late`);

              // Update workflow status
              await doc.ref.update({
                status: 'completed',
                submagicVideoUrl: videoUrl,
                r2VideoUrl: r2Url,
                completedAt: Date.now(),
                error: null
              });

              console.log(`      ✅ Workflow completed successfully!\n`);
            } catch (error) {
              console.log(`      ❌ Error processing video: ${error instanceof Error ? error.message : error}`);

              // Update with error but don't mark as failed yet
              await doc.ref.update({
                error: `Processing error: ${error instanceof Error ? error.message : error}`,
                lastErrorAt: Date.now()
              });
              console.log(`      ⚠️  Error logged, workflow still in processing state\n`);
            }
          } else {
            console.log(`      ⚠️  No video URL in Submagic response\n`);
          }
        } else if (submagicData.status === 'failed' || submagicData.status === 'error') {
          console.log(`      ❌ Submagic failed - marking workflow as failed`);
          await doc.ref.update({
            status: 'failed',
            error: `Submagic processing failed: ${submagicData.error || 'Unknown error'}`,
            failedAt: Date.now()
          });
          console.log(`      ✅ Workflow marked as failed\n`);
        } else {
          console.log(`      ⏳ Still processing (${submagicData.status})\n`);
        }

        // Rate limit: wait 2 seconds between checks
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.log(`      ❌ Error checking Submagic: ${error instanceof Error ? error.message : error}\n`);
      }
    }

  } catch (error) {
    console.error(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
  }
}

async function main() {
  console.log('🔧 Direct Fix for Stuck Submagic Workflows\n');
  console.log('═'.repeat(60));

  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('❌ Firebase Admin not initialized. Make sure FIREBASE_* env vars are set.');
    process.exit(1);
  }

  const brands = [
    { name: 'benefit', collection: 'benefit_workflow_queue' },
    { name: 'property', collection: 'property_videos' },
  ];

  for (const brand of brands) {
    await fixStuckWorkflows(brand.name, brand.collection, adminDb);
  }

  console.log('\n═'.repeat(60));
  console.log('✅ Fix complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
