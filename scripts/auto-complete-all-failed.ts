/**
 * Automatically find and complete all failed video workflows
 * This script:
 * 1. Queries Firestore for workflows with status = 'failed' or 'video_processing_failed'
 * 2. For each workflow, calls the complete-without-submagic API
 * 3. Reports success/failure for each workflow
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin using environment credentials
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.error('❌ Missing Firebase credentials in environment');
    console.error('   Required: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = getFirestore();

interface FailedWorkflow {
  id: string;
  brand: string;
  status: string;
  error?: string;
  heygenVideoId?: string;
  heygenVideoUrl?: string;
  articleTitle?: string;
  title?: string;
  createdAt?: number;
}

const COLLECTIONS = [
  { name: 'ownerfi_workflow_queue', brand: 'ownerfi' },
  { name: 'carz_workflow_queue', brand: 'carz' },
  { name: 'benefit_workflow_queue', brand: 'benefit' },
  { name: 'abdullah_workflow_queue', brand: 'abdullah' },
  { name: 'gaza_workflow_queue', brand: 'gaza' },
];

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

async function findFailedWorkflows(): Promise<FailedWorkflow[]> {
  console.log('🔍 Scanning Firestore for failed workflows...\n');

  const failedWorkflows: FailedWorkflow[] = [];

  for (const collection of COLLECTIONS) {
    try {
      // Query for workflows with failed status
      const snapshot = await db
        .collection(collection.name)
        .where('status', 'in', ['failed', 'video_processing_failed', 'export_failed'])
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      console.log(`📂 ${collection.brand}: Found ${snapshot.size} failed workflows`);

      snapshot.forEach((doc) => {
        const data = doc.data();
        failedWorkflows.push({
          id: doc.id,
          brand: collection.brand,
          status: data.status,
          error: data.error,
          heygenVideoId: data.heygenVideoId,
          heygenVideoUrl: data.heygenVideoUrl || data.heygenVideoR2Url,
          articleTitle: data.articleTitle || data.title || data.caption,
          title: data.title,
          createdAt: data.createdAt,
        });
      });
    } catch (error) {
      console.error(`❌ Error querying ${collection.name}:`, error);
    }
  }

  console.log(`\n📊 Total failed workflows found: ${failedWorkflows.length}\n`);
  return failedWorkflows;
}

async function completeWorkflow(workflow: FailedWorkflow): Promise<boolean> {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔄 Processing: ${workflow.articleTitle || workflow.id}`);
  console.log(`   Brand: ${workflow.brand}`);
  console.log(`   Status: ${workflow.status}`);
  console.log(`   HeyGen Video: ${workflow.heygenVideoUrl ? 'YES' : 'NO'}`);
  console.log(`   HeyGen ID: ${workflow.heygenVideoId || 'N/A'}`);

  try {
    // Call the complete-without-submagic endpoint
    const response = await fetch(`${BASE_URL}/api/workflow/complete-without-submagic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId: workflow.id,
        brand: workflow.brand,
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log(`✅ SUCCESS - Workflow completed and posted to social media`);
      if (result.postId) {
        console.log(`   Post ID: ${result.postId}`);
      }
      return true;
    } else {
      console.error(`❌ FAILED - ${result.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ ERROR:`, error);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   Auto-Complete All Failed Workflows');
  console.log('═══════════════════════════════════════════\n');

  // Find all failed workflows
  const failedWorkflows = await findFailedWorkflows();

  if (failedWorkflows.length === 0) {
    console.log('✅ No failed workflows found!');
    process.exit(0);
  }

  // Display summary
  console.log('Found failed workflows:');
  failedWorkflows.forEach((wf, index) => {
    const age = wf.createdAt ? Math.floor((Date.now() - wf.createdAt) / 1000 / 60) : 'unknown';
    console.log(`${index + 1}. [${wf.brand}] ${wf.articleTitle || wf.id} (${age} min old)`);
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log('Starting retry process...\n');

  // Process each workflow
  let successCount = 0;
  let failCount = 0;

  for (const workflow of failedWorkflows) {
    const success = await completeWorkflow(workflow);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Wait 2 seconds between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log('═══════════════════════════════════════════');
  console.log('   Summary');
  console.log('═══════════════════════════════════════════');
  console.log(`Total processed: ${failedWorkflows.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('═══════════════════════════════════════════\n');
}

main().catch(console.error);
