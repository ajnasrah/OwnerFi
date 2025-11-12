/**
 * Retry Failed Video Processing Workflows
 *
 * This script finds workflows with status "video_processing_failed" and retries them
 * by calling the /api/process-video endpoint directly.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin using environment variables
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

async function retryFailedWorkflows() {
  console.log('🔍 Finding workflows with video_processing_failed status...\n');

  const failedWorkflows: any[] = [];

  // Check all brand collections
  const brands = ['carz', 'ownerfi', 'vassdistro', 'benefit', 'abdullah', 'podcast'];

  for (const brand of brands) {
    const collectionName = brand === 'podcast' ? 'podcast_workflow_queue' : `${brand}_workflow_queue`;

    console.log(`📂 Checking ${collectionName}...`);

    try {
      const snapshot = await db.collection(collectionName)
        .where('status', '==', 'video_processing_failed')
        .get();

      console.log(`   Found ${snapshot.size} failed workflows`);

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        failedWorkflows.push({
          workflowId: doc.id,
          brand,
          workflow: data,
          collection: collectionName
        });
      });
    } catch (err) {
      console.error(`   ❌ Error querying ${collectionName}:`, err);
    }
  }

  // Check property_videos collection
  console.log(`📂 Checking property_videos...`);
  try {
    const snapshot = await db.collection('property_videos')
      .where('status', '==', 'video_processing_failed')
      .get();

    console.log(`   Found ${snapshot.size} failed property videos`);

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      failedWorkflows.push({
        workflowId: doc.id,
        brand: 'property',
        workflow: data,
        collection: 'property_videos'
      });
    });
  } catch (err) {
    console.error(`   ❌ Error querying property_videos:`, err);
  }

  console.log(`\n📋 Total failed workflows: ${failedWorkflows.length}\n`);

  if (failedWorkflows.length === 0) {
    console.log('✅ No failed workflows to retry!');
    return;
  }

  // Retry each workflow
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
  const results: any[] = [];

  for (const item of failedWorkflows) {
    const { workflowId, brand, workflow, collection } = item;

    console.log(`\n🔄 Retrying ${brand} workflow ${workflowId}...`);
    console.log(`   Error: ${workflow.error}`);
    console.log(`   Collection: ${collection}`);

    // Check if we have the necessary data
    const videoUrl = workflow.submagicDownloadUrl;
    const submagicProjectId = workflow.submagicProjectId || workflow.submagicVideoId;

    if (!videoUrl && !submagicProjectId) {
      console.error(`   ❌ No video URL or Submagic project ID - cannot retry`);
      results.push({
        workflowId,
        brand,
        status: 'skipped',
        reason: 'No video URL or Submagic project ID'
      });
      continue;
    }

    console.log(`   Video URL: ${videoUrl ? videoUrl.substring(0, 60) + '...' : 'none'}`);
    console.log(`   Submagic Project ID: ${submagicProjectId || 'none'}`);

    try {
      // Call the process-video endpoint
      const response = await fetch(`${baseUrl}/api/process-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand,
          workflowId,
          videoUrl,
          submagicProjectId
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`   ✅ Success! Post ID: ${result.postId}`);
        console.log(`   Scheduled for: ${result.scheduledFor}`);
        results.push({
          workflowId,
          brand,
          status: 'success',
          postId: result.postId
        });
      } else {
        console.error(`   ❌ Failed: ${result.error}`);
        results.push({
          workflowId,
          brand,
          status: 'failed',
          error: result.error
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`   ❌ Request failed: ${errorMsg}`);
      results.push({
        workflowId,
        brand,
        status: 'error',
        error: errorMsg
      });
    }

    // Wait 2 seconds between retries to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Print summary
  console.log('\n\n📊 RETRY SUMMARY\n');
  console.log('═'.repeat(60));

  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📊 Total: ${results.length}`);

  console.log('\n' + '═'.repeat(60) + '\n');

  // Show details for failed retries
  const failedRetries = results.filter(r => r.status === 'failed' || r.status === 'error');
  if (failedRetries.length > 0) {
    console.log('❌ FAILED RETRIES:\n');
    failedRetries.forEach(r => {
      console.log(`   ${r.brand}/${r.workflowId}: ${r.error}`);
    });
  }
}

// Run the script
retryFailedWorkflows()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  });
