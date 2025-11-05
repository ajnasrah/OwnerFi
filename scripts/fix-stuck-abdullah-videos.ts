#!/usr/bin/env npx tsx

/**
 * Fix Stuck Abdullah Videos
 *
 * Manually checks and advances stuck Abdullah workflows in submagic_processing status
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('\n🔍 Checking stuck Abdullah workflows...\n');

  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
  if (!SUBMAGIC_API_KEY) {
    throw new Error('SUBMAGIC_API_KEY not found');
  }

  // Initialize Firebase Admin
  const { getAdminDb } = await import('../src/lib/firebase-admin.js');
  const adminDb = await getAdminDb();

  if (!adminDb) {
    throw new Error('Failed to initialize Firebase Admin');
  }

  console.log('✅ Firebase Admin initialized\n');

  // Check abdullah_workflow_queue for stuck workflows
  const snapshot = await adminDb
    .collection('abdullah_workflow_queue')
    .where('status', '==', 'submagic_processing')
    .get();

  console.log(`📊 Found ${snapshot.size} workflows in submagic_processing\n`);

  if (snapshot.empty) {
    console.log('✅ No stuck workflows found!');
    return;
  }

  const results = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const workflowId = doc.id;
    const submagicVideoId = data.submagicVideoId;
    const timestamp = data.statusChangedAt || data.updatedAt || 0;
    const stuckMinutes = Math.round((Date.now() - timestamp) / 60000);

    console.log(`\n📄 Workflow: ${workflowId}`);
    console.log(`   Title: ${data.articleTitle || data.topic || 'Unknown'}`);
    console.log(`   Submagic ID: ${submagicVideoId || 'MISSING'}`);
    console.log(`   Stuck for: ${stuckMinutes} minutes`);

    if (!submagicVideoId) {
      console.log(`   ❌ No Submagic ID - marking as failed`);
      await adminDb.collection('abdullah_workflow_queue').doc(workflowId).update({
        status: 'failed',
        error: 'No Submagic video ID received',
        updatedAt: Date.now()
      });
      results.push({ workflowId, action: 'marked_failed', reason: 'no_submagic_id' });
      continue;
    }

    try {
      // Check Submagic status
      console.log(`   🔍 Checking Submagic project: ${submagicVideoId}`);

      const response = await fetch(
        `https://api.submagic.co/v1/projects/${submagicVideoId}`,
        {
          headers: { 'x-api-key': SUBMAGIC_API_KEY }
        }
      );

      if (!response.ok) {
        console.log(`   ❌ Submagic API error: ${response.status}`);
        results.push({ workflowId, action: 'api_error', status: response.status });
        continue;
      }

      const submagicData = await response.json();
      const status = submagicData.status;
      const downloadUrl = submagicData.media_url || submagicData.video_url || submagicData.downloadUrl;

      console.log(`   📊 Submagic status: ${status}`);

      if (status === 'completed' || status === 'done' || status === 'ready') {
        if (!downloadUrl) {
          console.log(`   ⚠️  Complete but no download URL - triggering export...`);

          const exportResponse = await fetch(
            `https://api.submagic.co/v1/projects/${submagicVideoId}/export`,
            {
              method: 'POST',
              headers: {
                'x-api-key': SUBMAGIC_API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                webhookUrl: 'https://ownerfi.ai/api/webhooks/submagic/abdullah',
                format: 'mp4',
                quality: 'high'
              })
            }
          );

          if (exportResponse.ok) {
            console.log(`   ✅ Export triggered - webhook will complete workflow`);
            results.push({ workflowId, action: 'export_triggered' });
          } else {
            console.log(`   ❌ Export failed: ${exportResponse.status}`);
            results.push({ workflowId, action: 'export_failed' });
          }
          continue;
        }

        console.log(`   ✅ Video is complete! Processing now...`);
        console.log(`   📥 Download URL: ${downloadUrl.substring(0, 80)}...`);

        // Import video storage utilities
        const videoStorageModule = await import('../src/lib/video-storage.js');
        const { uploadSubmagicVideo } = videoStorageModule;

        console.log(`   ☁️  Uploading to R2...`);
        const publicVideoUrl = await uploadSubmagicVideo(downloadUrl);
        console.log(`   ✅ R2 upload complete!`);

        // Update workflow to posting status
        await adminDb.collection('abdullah_workflow_queue').doc(workflowId).update({
          status: 'posting',
          finalVideoUrl: publicVideoUrl,
          submagicDownloadUrl: downloadUrl,
          updatedAt: Date.now()
        });

        console.log(`   💾 Updated to 'posting' status`);

        // Import posting utilities
        const lateApiModule = await import('../src/lib/late-api.js');
        const { postToLate } = lateApiModule;

        console.log(`   📱 Posting to social media...`);

        const allPlatforms = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'threads', 'twitter', 'bluesky'];

        const postResult = await postToLate({
          videoUrl: publicVideoUrl,
          caption: data.caption || 'Check this out! 🔥',
          title: data.title || data.articleTitle || 'New Video',
          platforms: allPlatforms,
          useQueue: true,
          brand: 'abdullah'
        });

        if (postResult.success) {
          console.log(`   ✅ Posted to Late! Post ID: ${postResult.postId}`);

          await adminDb.collection('abdullah_workflow_queue').doc(workflowId).update({
            status: 'completed',
            latePostId: postResult.postId,
            completedAt: Date.now(),
            updatedAt: Date.now()
          });

          console.log(`   ✅ WORKFLOW COMPLETED!`);
          results.push({ workflowId, action: 'completed', postId: postResult.postId });
        } else {
          console.log(`   ❌ Late posting failed: ${postResult.error}`);

          await adminDb.collection('abdullah_workflow_queue').doc(workflowId).update({
            status: 'failed',
            error: `Late posting failed: ${postResult.error}`,
            updatedAt: Date.now()
          });

          results.push({ workflowId, action: 'failed', error: postResult.error });
        }
      } else if (status === 'failed') {
        console.log(`   ❌ Submagic processing failed - marking workflow as failed`);

        await adminDb.collection('abdullah_workflow_queue').doc(workflowId).update({
          status: 'failed',
          error: 'Submagic processing failed',
          updatedAt: Date.now()
        });

        results.push({ workflowId, action: 'marked_failed', reason: 'submagic_failed' });
      } else {
        console.log(`   ⏳ Still processing (status: ${status})`);
        results.push({ workflowId, action: 'still_processing', status });
      }
    } catch (error) {
      console.error(`   ❌ Error processing workflow:`, error);
      results.push({
        workflowId,
        action: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nTotal workflows checked: ${snapshot.size}`);
  console.log(`Completed: ${results.filter(r => r.action === 'completed').length}`);
  console.log(`Still processing: ${results.filter(r => r.action === 'still_processing').length}`);
  console.log(`Failed: ${results.filter(r => r.action === 'marked_failed').length}`);
  console.log(`Errors: ${results.filter(r => r.action === 'error').length}`);
  console.log('');
}

main().catch(console.error);
