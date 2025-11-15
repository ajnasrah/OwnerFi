/**
 * Manually trigger a single property video workflow
 * This will generate a video for the next property in the queue
 * and let us watch the entire process to catch errors
 *
 * Run with: npx tsx scripts/trigger-property-workflow.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function triggerWorkflow() {
  console.log('🎬 Manually Triggering Property Video Workflow\n');
  console.log('='.repeat(80));

  try {
    // Import the functions we need
    const {
      getNextPropertyFromRotation,
      markPropertyCompleted
    } = await import('../src/lib/feed-store-firestore');

    const { generatePropertyVideo } = await import('../src/lib/property-video-service');

    // Get next property from rotation queue
    console.log('\n📋 Getting next property from queue...');
    const queueItem = await getNextPropertyFromRotation();

    if (!queueItem) {
      console.log('❌ No properties available in queue!');
      return;
    }

    console.log(`\n✅ Selected property: ${queueItem.address}`);
    console.log(`   City: ${queueItem.city}, ${queueItem.state}`);
    console.log(`   Property ID: ${queueItem.propertyId}`);
    console.log(`   Down payment: $${(queueItem.downPayment || 0).toLocaleString()}`);
    console.log(`   Monthly payment: $${(queueItem.monthlyPayment || 0).toLocaleString()}`);
    console.log(`   Times shown: ${queueItem.videoCount || 0}`);

    console.log('\n🎥 Generating 15-second video...');
    console.log('   This will:');
    console.log('   1. Generate script with OpenAI');
    console.log('   2. Send to HeyGen for video generation');
    console.log('   3. Wait for HeyGen webhook → sends to Submagic');
    console.log('   4. Wait for Submagic webhook → triggers /api/process-video');
    console.log('   5. Download video, upload to R2, post to Late API');
    console.log('');

    const result = await generatePropertyVideo(queueItem.propertyId, '15');

    if (result.success) {
      console.log('\n✅ Workflow started successfully!');
      console.log(`   Workflow ID: ${result.workflowId}`);
      console.log(`   Initial status: pending`);
      console.log('');
      console.log('🔍 Monitor workflow progress:');
      console.log(`   1. Check Firestore: property_videos/${result.workflowId}`);
      console.log(`   2. Watch Vercel logs: vercel logs --follow`);
      console.log(`   3. Check for errors in logs`);
      console.log('');
      console.log('⏱️  Expected timeline:');
      console.log('   - HeyGen webhook: 30-60 seconds');
      console.log('   - Submagic processing: 60-120 seconds');
      console.log('   - R2 upload + Late posting: 10-30 seconds');
      console.log('   - Total: ~2-4 minutes');
      console.log('');

      // Mark as completed in queue
      await markPropertyCompleted(queueItem.propertyId);
      console.log('✅ Property marked as completed in rotation queue');

      // Monitor the workflow
      console.log('\n👀 Monitoring workflow for 5 minutes...');
      console.log('   (Press Ctrl+C to stop monitoring)');
      console.log('');

      await monitorWorkflow(result.workflowId);

    } else {
      console.log(`\n❌ Failed to start workflow: ${result.error}`);
      if (result.message) {
        console.log(`   Details: ${result.message}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

async function monitorWorkflow(workflowId: string) {
  const startTime = Date.now();
  const maxWaitTime = 5 * 60 * 1000; // 5 minutes

  let lastStatus = '';
  let checkCount = 0;

  while (Date.now() - startTime < maxWaitTime) {
    checkCount++;
    const doc = await db.collection('property_videos').doc(workflowId).get();

    if (!doc.exists) {
      console.log(`   ❌ Workflow disappeared!`);
      break;
    }

    const data = doc.data()!;
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (data.status !== lastStatus) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`   [${timestamp}] Status changed: ${lastStatus || 'none'} → ${data.status} (${elapsed}s elapsed)`);
      lastStatus = data.status;

      // Show additional details for each status
      if (data.status === 'heygen_processing' && data.heygenVideoId) {
        console.log(`      HeyGen Video ID: ${data.heygenVideoId}`);
      }
      if (data.status === 'submagic_processing' && data.submagicProjectId) {
        console.log(`      Submagic Project ID: ${data.submagicProjectId}`);
      }
      if (data.status === 'video_processing') {
        console.log(`      Downloading and uploading to R2...`);
      }
      if (data.status === 'posting') {
        if (data.finalVideoUrl) {
          console.log(`      ✅ Video URL: ${data.finalVideoUrl.substring(0, 60)}...`);
          console.log(`      Posting to Late API...`);
        } else {
          console.log(`      ❌ ERROR: No finalVideoUrl! This is the bug!`);
        }
      }
      if (data.status === 'completed') {
        console.log(`      ✅ Late Post ID: ${data.latePostId || 'N/A'}`);
        console.log(`\n🎉 Workflow completed successfully in ${elapsed}s!`);
        break;
      }
      if (data.status === 'failed') {
        console.log(`      ❌ Error: ${data.error || 'Unknown'}`);
        console.log(`\n💥 Workflow failed after ${elapsed}s`);
        break;
      }
    }

    // Wait 5 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  if (Date.now() - startTime >= maxWaitTime) {
    console.log(`\n⏱️  Monitoring timeout after 5 minutes`);
    console.log(`   Final status: ${lastStatus}`);
    console.log(`   Check Vercel logs for errors`);
  }
}

triggerWorkflow().catch(console.error);
