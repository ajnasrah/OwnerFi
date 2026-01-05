#!/usr/bin/env tsx
/**
 * Mark stuck video_processing workflows for retry
 * Sets retryable flag so check-stuck-workflows cron can pick them up
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

async function markForRetry() {
  console.log('\n=== MARKING STUCK WORKFLOWS FOR RETRY ===\n');

  const brands = ['carz', 'ownerfi', 'benefit', 'abdullah', 'personal', 'gaza'];
  let totalMarked = 0;

  for (const brand of brands) {
    console.log(`\n📱 ${brand.toUpperCase()}:`);
    console.log('─'.repeat(60));

    const workflowCollection = `${brand}_workflow_queue`;

    // Find stuck workflows
    const stuckSnapshot = await db.collection(workflowCollection)
      .where('status', '==', 'video_processing')
      .get();

    // Filter out dedup documents
    const actualWorkflows = stuckSnapshot.docs.filter(doc => !doc.id.startsWith('dedup_'));

    if (actualWorkflows.length === 0) {
      console.log('   No stuck workflows found');
      continue;
    }

    console.log(`   Found ${actualWorkflows.length} stuck workflows`);

    // Mark each workflow for retry by changing status to submagic_processing
    // This will make the check-stuck-workflows cron pick them up
    for (const doc of actualWorkflows) {
      const data = doc.data();
      const workflowId = doc.id;

      // Only process if it has video URLs
      if (!data.submagicDownloadUrl && !data.heygenVideoUrl) {
        console.log(`   ⚠️  ${workflowId}: No video URL - skipping`);
        continue;
      }

      try {
        // Set to submagic_processing so it gets picked up by check-stuck-workflows
        // Also add retryable flag
        await db.collection(workflowCollection).doc(workflowId).update({
          status: 'submagic_processing',
          retryable: true,
          needsReprocessing: true,
          markedForRetryAt: Date.now(),
          previousStatus: 'video_processing',
        });

        console.log(`   ✅ ${workflowId} marked for retry`);
        totalMarked++;
      } catch (error) {
        console.log(`   ❌ ${workflowId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('MARKING COMPLETE');
  console.log('='.repeat(60));
  console.log(`   Total marked for retry: ${totalMarked}`);
  console.log('\nThe check-stuck-workflows cron will pick these up and process them.');
}

markForRetry().catch(console.error);
