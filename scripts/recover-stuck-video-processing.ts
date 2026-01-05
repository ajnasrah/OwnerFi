#!/usr/bin/env tsx
/**
 * Recover workflows stuck in video_processing status
 * These workflows got stuck due to a bug where the worker was skipping video_processing status
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

const WORKER_SECRET = process.env.CLOUD_TASKS_SECRET || process.env.CRON_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

async function recoverStuckWorkflows() {
  console.log('\n=== RECOVERING STUCK video_processing WORKFLOWS ===\n');

  const brands = ['carz', 'ownerfi', 'benefit', 'abdullah', 'personal', 'gaza'];
  let totalRecovered = 0;
  let totalFailed = 0;

  for (const brand of brands) {
    console.log(`\n📱 ${brand.toUpperCase()}:`);
    console.log('─'.repeat(60));

    const workflowCollection = `${brand}_workflow_queue`;

    // Find stuck workflows
    const stuckSnapshot = await db.collection(workflowCollection)
      .where('status', '==', 'video_processing')
      .limit(20) // Get more to filter out dedup docs
      .get();

    // Filter out dedup documents (they start with 'dedup_')
    const actualWorkflows = stuckSnapshot.docs.filter(doc => !doc.id.startsWith('dedup_'));

    if (actualWorkflows.length === 0) {
      console.log('   No stuck workflows found');
      continue;
    }

    console.log(`   Found ${actualWorkflows.length} stuck workflows (filtered from ${stuckSnapshot.size} total docs)`);

    for (const doc of actualWorkflows) {
      const data = doc.data();
      const workflowId = doc.id;

      // Check if it has a video URL (either from Submagic or HeyGen)
      const videoUrl = data.submagicDownloadUrl || data.heygenVideoUrl || data.finalVideoUrl;

      if (!videoUrl) {
        console.log(`   ⚠️  ${workflowId}: No video URL - skipping`);
        continue;
      }

      console.log(`\n   🔄 Recovering ${workflowId}...`);
      console.log(`      Video URL: ${videoUrl.substring(0, 60)}...`);

      try {
        // Call the worker endpoint directly
        const response = await fetch(`${BASE_URL}/api/workers/process-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cloud-Tasks-Worker': WORKER_SECRET || '',
          },
          body: JSON.stringify({
            brand,
            workflowId,
            videoUrl,
            submagicProjectId: data.submagicProjectId || data.submagicVideoId,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`      ✅ Successfully triggered recovery`);
          console.log(`         Status: ${result.status || 'processing'}`);
          totalRecovered++;
        } else {
          const error = await response.text();
          console.log(`      ❌ Failed: ${response.status} - ${error.substring(0, 100)}`);
          totalFailed++;
        }
      } catch (error) {
        console.log(`      ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        totalFailed++;
      }

      // Add delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('RECOVERY COMPLETE');
  console.log('='.repeat(60));
  console.log(`   Total recovered: ${totalRecovered}`);
  console.log(`   Total failed: ${totalFailed}`);
}

recoverStuckWorkflows().catch(console.error);
