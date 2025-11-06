#!/usr/bin/env npx tsx

/**
 * EMERGENCY: Recover ALL stuck workflows
 * This script manually processes stuck workflows across all brands
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, updateDoc, doc as firestoreDoc } from 'firebase/firestore';

// Initialize Firebase
if (!getApps().length) {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  initializeApp(firebaseConfig);
}

const db = getFirestore();

const LATE_API_KEY = process.env.LATE_API_KEY;
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

interface StuckWorkflow {
  id: string;
  brand: string;
  status: string;
  submagicVideoId?: string;
  finalVideoUrl?: string;
  submagicDownloadUrl?: string;
  caption?: string;
  title?: string;
  articleTitle?: string;
  updatedAt: number;
}

async function recoverStuckWorkflows() {
  console.log('🚨 EMERGENCY RECOVERY: Finding all stuck workflows...\n');

  const stuckWorkflows: StuckWorkflow[] = [];

  // Check all brand workflow queues
  const brands = ['carz', 'ownerfi', 'vassdistro', 'benefit', 'abdullah'];

  for (const brand of brands) {
    const collectionName = `${brand}_workflow_queue`;
    console.log(`📂 Checking ${collectionName}...`);

    try {
      // Find workflows stuck in posting
      const qPosting = query(
        collection(db, collectionName),
        where('status', '==', 'posting')
      );

      // Find workflows stuck in pending
      const qPending = query(
        collection(db, collectionName),
        where('status', '==', 'pending')
      );

      // Find workflows stuck in submagic_processing
      const qSubmagic = query(
        collection(db, collectionName),
        where('status', '==', 'submagic_processing')
      );

      const [postingSnap, pendingSnap, submagicSnap] = await Promise.all([
        getDocs(qPosting),
        getDocs(qPending),
        getDocs(qSubmagic)
      ]);

      console.log(`   Found: ${postingSnap.size} posting, ${pendingSnap.size} pending, ${submagicSnap.size} submagic\n`);

      // Process posting workflows
      postingSnap.forEach(doc => {
        const data = doc.data();
        const stuckMinutes = Math.round((Date.now() - (data.updatedAt || 0)) / 60000);

        if (stuckMinutes > 10) {
          console.log(`   ⚠️  ${doc.id}: POSTING for ${stuckMinutes} min`);
          stuckWorkflows.push({
            id: doc.id,
            brand,
            status: 'posting',
            ...data
          } as StuckWorkflow);
        }
      });

      // Process pending workflows
      pendingSnap.forEach(doc => {
        const data = doc.data();
        const stuckMinutes = Math.round((Date.now() - (data.createdAt || 0)) / 60000);

        if (stuckMinutes > 5) {
          console.log(`   ⚠️  ${doc.id}: PENDING for ${stuckMinutes} min`);
          stuckWorkflows.push({
            id: doc.id,
            brand,
            status: 'pending',
            ...data
          } as StuckWorkflow);
        }
      });

      // Process submagic workflows
      submagicSnap.forEach(doc => {
        const data = doc.data();
        const stuckMinutes = Math.round((Date.now() - (data.updatedAt || 0)) / 60000);

        if (stuckMinutes > 10) {
          console.log(`   ⚠️  ${doc.id}: SUBMAGIC for ${stuckMinutes} min`);
          stuckWorkflows.push({
            id: doc.id,
            brand,
            status: 'submagic_processing',
            ...data
          } as StuckWorkflow);
        }
      });

    } catch (err) {
      console.error(`   ❌ Error checking ${collectionName}:`, err);
    }
  }

  console.log(`\n📋 Total stuck workflows: ${stuckWorkflows.length}\n`);

  // Process each stuck workflow
  let recovered = 0;
  let failed = 0;

  for (const workflow of stuckWorkflows) {
    console.log(`\n🔧 Processing ${workflow.brand}/${workflow.id} (${workflow.status})...`);

    try {
      if (workflow.status === 'posting') {
        // Has video URL, just needs to post to Late
        await recoverPostingWorkflow(workflow);
        recovered++;
      } else if (workflow.status === 'pending') {
        // Needs to start the complete workflow
        await startPendingWorkflow(workflow);
        recovered++;
      } else if (workflow.status === 'submagic_processing') {
        // Check if Submagic is done, download and post
        await recoverSubmagicWorkflow(workflow);
        recovered++;
      }
    } catch (err) {
      console.error(`   ❌ Failed:`, err);
      failed++;
    }
  }

  console.log(`\n✅ RECOVERY COMPLETE`);
  console.log(`   Recovered: ${recovered}`);
  console.log(`   Failed: ${failed}`);
}

async function recoverPostingWorkflow(workflow: StuckWorkflow) {
  if (!workflow.finalVideoUrl) {
    console.log(`   ❌ No video URL, cannot recover`);

    // Revert to submagic_processing if we have a submagic ID
    if (workflow.submagicVideoId) {
      console.log(`   🔄 Reverting to submagic_processing to retry download`);
      const collectionName = `${workflow.brand}_workflow_queue`;
      await updateDoc(firestoreDoc(db, collectionName, workflow.id), {
        status: 'submagic_processing',
        updatedAt: Date.now()
      });

      // Now try to recover from submagic
      await recoverSubmagicWorkflow({ ...workflow, status: 'submagic_processing' });
    } else {
      throw new Error('No video URL and no Submagic ID');
    }
    return;
  }

  console.log(`   📱 Posting to Late API...`);

  const response = await fetch('https://api.getlate.so/v1/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      videoUrl: workflow.finalVideoUrl,
      text: workflow.caption || workflow.articleTitle || 'Check this out!',
      platforms: ['instagram', 'tiktok', 'youtube', 'facebook'],
      publishAt: 'now'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Late API failed: ${error}`);
  }

  const result = await response.json();
  console.log(`   ✅ Posted to Late: ${result.id}`);

  // Mark as completed
  const collectionName = `${workflow.brand}_workflow_queue`;
  await updateDoc(firestoreDoc(db, collectionName, workflow.id), {
    status: 'completed',
    latePostId: result.id,
    completedAt: Date.now(),
    updatedAt: Date.now()
  });

  console.log(`   ✅ Marked as completed`);
}

async function startPendingWorkflow(workflow: StuckWorkflow) {
  console.log(`   🚀 Triggering complete-viral workflow...`);

  const response = await fetch('https://ownerfi.ai/api/workflow/complete-viral', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      brand: workflow.brand,
      platforms: ['instagram', 'tiktok', 'youtube', 'facebook'],
      schedule: 'immediate'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Workflow start failed: ${error}`);
  }

  const result = await response.json();
  console.log(`   ✅ Workflow started: ${result.workflow_id}`);
}

async function recoverSubmagicWorkflow(workflow: StuckWorkflow) {
  if (!workflow.submagicVideoId) {
    throw new Error('No Submagic ID');
  }

  console.log(`   🔍 Checking Submagic status...`);

  // Check if Submagic project is complete
  const response = await fetch(`https://api.submagic.co/v1/projects/${workflow.submagicVideoId}`, {
    headers: { 'x-api-key': SUBMAGIC_API_KEY! }
  });

  if (!response.ok) {
    throw new Error(`Submagic API error: ${response.status}`);
  }

  const data = await response.json();
  const status = data.status;
  const downloadUrl = data.media_url || data.video_url || data.downloadUrl;

  console.log(`   Status: ${status}`);

  if (status === 'completed' || status === 'done' || status === 'ready') {
    if (!downloadUrl) {
      console.log(`   📤 Triggering export...`);

      // Trigger export
      const exportResponse = await fetch(`https://api.submagic.co/v1/projects/${workflow.submagicVideoId}/export`, {
        method: 'POST',
        headers: {
          'x-api-key': SUBMAGIC_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhookUrl: `https://ownerfi.ai/api/webhooks/submagic/${workflow.brand}`
        })
      });

      if (!exportResponse.ok) {
        throw new Error(`Export trigger failed: ${await exportResponse.text()}`);
      }

      console.log(`   ✅ Export triggered, webhook will complete the workflow`);
      return;
    }

    console.log(`   ✅ Video ready, downloading and uploading to R2...`);

    // Upload to R2
    const { uploadSubmagicVideo } = await import('../src/lib/video-storage');
    const publicVideoUrl = await uploadSubmagicVideo(downloadUrl);

    console.log(`   ✅ Uploaded to R2: ${publicVideoUrl.substring(0, 80)}...`);

    // Update workflow
    const collectionName = `${workflow.brand}_workflow_queue`;
    await updateDoc(firestoreDoc(db, collectionName, workflow.id), {
      finalVideoUrl: publicVideoUrl,
      submagicDownloadUrl: downloadUrl,
      status: 'posting',
      updatedAt: Date.now()
    });

    // Now post to Late
    await recoverPostingWorkflow({
      ...workflow,
      finalVideoUrl: publicVideoUrl,
      status: 'posting'
    });

  } else {
    console.log(`   ⏳ Still processing (${status}), will check again later`);
  }
}

// Run recovery
recoverStuckWorkflows()
  .then(() => {
    console.log('\n✅ Recovery script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Recovery script failed:', err);
    process.exit(1);
  });
