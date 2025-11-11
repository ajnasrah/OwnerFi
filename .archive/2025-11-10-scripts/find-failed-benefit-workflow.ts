/**
 * Find Failed Benefit Workflow (Episode #7)
 * Direct Firestore query to find and retry the failed workflow
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function findFailedWorkflows() {
  console.log('🔍 Searching for failed benefit workflows...\n');

  const snapshot = await db
    .collection('benefit_workflow_queue')
    .where('status', '==', 'failed')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  if (snapshot.empty) {
    console.log('✅ No failed workflows found');
    return [];
  }

  const workflows: any[] = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    workflows.push({
      id: doc.id,
      ...data,
      createdAtDate: data.createdAt ? new Date(data.createdAt).toISOString() : 'N/A'
    });
  });

  console.log(`Found ${workflows.length} failed workflow(s):\n`);
  workflows.forEach((w, i) => {
    console.log(`${i + 1}. Workflow ID: ${w.id}`);
    console.log(`   Benefit ID: ${w.benefitId}`);
    console.log(`   Title: ${w.title || 'N/A'}`);
    console.log(`   Created: ${w.createdAtDate}`);
    console.log(`   Error: ${w.error}`);
    console.log(`   Retry Count: ${w.retryCount || 0}`);
    console.log();
  });

  return workflows;
}

async function retryWorkflow(workflowId: string) {
  console.log(`\n🔄 Retrying workflow: ${workflowId}`);

  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    console.error('❌ CRON_SECRET not set in environment');
    process.exit(1);
  }

  try {
    const response = await fetch('https://ownerfi.ai/api/benefit/workflow/retry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`
      },
      body: JSON.stringify({ workflowId })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Retry failed:', result.error);
      return;
    }

    console.log('✅ Retry successful!');
    console.log('   New Video ID:', result.videoId);
    console.log('   Retry Count:', result.retryCount);
    console.log();
  } catch (error) {
    console.error('❌ Retry request failed:', error);
  }
}

// Main execution
(async () => {
  try {
    const failedWorkflows = await findFailedWorkflows();

    if (failedWorkflows.length === 0) {
      process.exit(0);
    }

    // Find Episode #7 specifically (looking for "James Chen" or "real estate")
    const episode7 = failedWorkflows.find(w =>
      w.title?.toLowerCase().includes('james') ||
      w.title?.toLowerCase().includes('chen') ||
      w.error?.includes('video_inputs')
    );

    if (episode7) {
      console.log('🎯 Found Episode #7 (or matching workflow)!');
      console.log(`   Workflow ID: ${episode7.id}`);
      console.log(`   Title: ${episode7.title}`);
      console.log(`   Error: ${episode7.error}`);
      console.log();

      // Retry it
      await retryWorkflow(episode7.id);
    } else {
      console.log('⚠️  Could not identify Episode #7 specifically');
      console.log('    Retrying the most recent failed workflow...');
      await retryWorkflow(failedWorkflows[0].id);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
