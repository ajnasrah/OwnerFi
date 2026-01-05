/**
 * Diagnose and fix failed video workflows
 * This script will:
 * 1. Find all workflows with status = 'video_processing_failed' or 'video_processing'
 * 2. Check if video URLs are available
 * 3. Retry processing for failed workflows
 */

import { getAdminDb } from '../src/lib/firebase-admin';

interface Workflow {
  id: string;
  brand: string;
  status: string;
  submagicProjectId?: string;
  submagicDownloadUrl?: string;
  finalVideoUrl?: string;
  heygenVideoId?: string;
  error?: string;
  caption?: string;
  title?: string;
  articleTitle?: string;
  createdAt?: number;
}

const COLLECTIONS = [
  { name: 'ownerfi_workflow_queue', brand: 'ownerfi' },
  { name: 'carz_workflow_queue', brand: 'carz' },
  { name: 'benefit_workflow_queue', brand: 'benefit' },
  { name: 'abdullah_workflow_queue', brand: 'abdullah' },
  { name: 'gaza_workflow_queue', brand: 'gaza' },
];

async function diagnoseFailedWorkflows() {
  console.log('🔍 Scanning for failed workflows...\n');

  const db = await getAdminDb();
  if (!db) {
    throw new Error('Failed to initialize Firebase Admin');
  }

  const failedWorkflows: Workflow[] = [];

  for (const collection of COLLECTIONS) {
    try {
      const snapshot = await db
        .collection(collection.name)
        .where('status', 'in', ['video_processing_failed', 'video_processing', 'export_failed'])
        .get();

      snapshot.forEach((doc) => {
        const data = doc.data();
        failedWorkflows.push({
          id: doc.id,
          brand: collection.brand,
          status: data.status,
          submagicProjectId: data.submagicProjectId,
          submagicDownloadUrl: data.submagicDownloadUrl,
          finalVideoUrl: data.finalVideoUrl,
          heygenVideoId: data.heygenVideoId,
          error: data.error,
          caption: data.caption,
          title: data.title,
          articleTitle: data.articleTitle,
          createdAt: data.createdAt,
        });
      });

      if (snapshot.size > 0) {
        console.log(`✅ ${collection.brand}: Found ${snapshot.size} failed workflows`);
      }
    } catch (error) {
      console.error(`❌ Error checking ${collection.name}:`, error);
    }
  }

  console.log(`\n📊 Total failed workflows: ${failedWorkflows.length}\n`);

  // Sort by creation time (newest first)
  failedWorkflows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Display details
  for (const workflow of failedWorkflows) {
    const age = workflow.createdAt
      ? Math.floor((Date.now() - workflow.createdAt) / 1000 / 60)
      : 'unknown';

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔴 ${workflow.brand.toUpperCase()} - ${workflow.id}`);
    console.log(`   Status: ${workflow.status}`);
    console.log(`   Age: ${age} minutes`);
    console.log(`   Title: ${workflow.title || workflow.articleTitle || 'N/A'}`);
    console.log(`   Error: ${workflow.error || 'N/A'}`);
    console.log(`   HeyGen ID: ${workflow.heygenVideoId || 'N/A'}`);
    console.log(`   Submagic ID: ${workflow.submagicProjectId || 'N/A'}`);
    console.log(`   Submagic URL: ${workflow.submagicDownloadUrl ? 'YES' : 'NO'}`);
    console.log(`   Final URL: ${workflow.finalVideoUrl ? 'YES' : 'NO'}`);
  }

  return failedWorkflows;
}

async function retryWorkflow(workflow: Workflow) {
  console.log(`\n🔄 Retrying ${workflow.brand} - ${workflow.id}...`);

  try {
    // Determine base URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.ownerfi.com';

    const response = await fetch(`${baseUrl}/api/process-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: workflow.brand,
        workflowId: workflow.id,
        videoUrl: workflow.submagicDownloadUrl,
        submagicProjectId: workflow.submagicProjectId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`❌ Retry failed: ${errorData.error}`);
      return false;
    }

    const result = await response.json();
    console.log(`✅ Retry successful:`, result);
    return true;
  } catch (error) {
    console.error(`❌ Retry error:`, error);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   Failed Workflow Diagnostic Tool');
  console.log('═══════════════════════════════════════════\n');

  const failedWorkflows = await diagnoseFailedWorkflows();

  if (failedWorkflows.length === 0) {
    console.log('\n✅ No failed workflows found!');
    process.exit(0);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`Found ${failedWorkflows.length} workflows that need attention.`);
  console.log(`\nTo retry all workflows, run:`);
  console.log(`  npm run retry-failed-workflows`);
  console.log(`\nTo retry a specific workflow manually:`);
  console.log(`  curl -X POST https://www.ownerfi.com/api/process-video \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"brand":"BRAND","workflowId":"WORKFLOW_ID"}'`);
}

main().catch(console.error);
