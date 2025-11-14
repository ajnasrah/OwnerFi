/**
 * Diagnostic Script: Find HeyGen Stuck Workflows
 *
 * Checks ALL workflows across ALL brands to find stuck HeyGen videos
 * and diagnose WHY they're stuck
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials in .env.local');
    console.error('   Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    })
  });
}

const db = getFirestore();

interface WorkflowIssue {
  workflowId: string;
  brand: string;
  collection: string;
  status: string;
  issue: string;
  createdAt?: number;
  heygenVideoId?: string;
  heygenVideoUrl?: string;
  heygenCompletedAt?: number;
  stuckMinutes?: number;
}

async function diagnoseStuckWorkflows() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 HEYGEN STUCK WORKFLOWS DIAGNOSTIC');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const issues: WorkflowIssue[] = [];
  const now = Date.now();

  // All collections to check
  const collections = [
    { name: 'carz_workflow_queue', brand: 'carz' },
    { name: 'ownerfi_workflow_queue', brand: 'ownerfi' },
    { name: 'vassdistro_workflow_queue', brand: 'vassdistro' },
    { name: 'podcast_workflow_queue', brand: 'podcast' },
    { name: 'benefit_workflow_queue', brand: 'benefit' },
    { name: 'abdullah_workflow_queue', brand: 'abdullah' },
    { name: 'propertyShowcaseWorkflows', brand: 'property/property-spanish' },
  ];

  console.log('📊 Checking all collections for HeyGen issues...\n');

  for (const { name, brand } of collections) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📂 Collection: ${name}`);
    console.log(`${'='.repeat(60)}`);

    try {
      // Get ALL workflows (not just heygen_processing)
      const snapshot = await db.collection(name).get();

      console.log(`   Total workflows: ${snapshot.size}`);

      let heygenProcessing = 0;
      let heygenStuck = 0;
      let missingVideoId = 0;
      let hasVideoUrl = 0;
      let hasCompletedAt = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        const status = data.status;
        const createdAt = data.createdAt || 0;
        const stuckMinutes = Math.round((now - createdAt) / 60000);

        // Check for heygen_processing status
        if (status === 'heygen_processing') {
          heygenProcessing++;

          // Check if stuck (> 10 minutes)
          if (stuckMinutes > 10) {
            heygenStuck++;

            const issue: WorkflowIssue = {
              workflowId: doc.id,
              brand,
              collection: name,
              status,
              issue: 'Stuck in heygen_processing',
              createdAt,
              stuckMinutes,
              heygenVideoId: data.heygenVideoId,
              heygenVideoUrl: data.heygenVideoUrl,
              heygenCompletedAt: data.heygenCompletedAt,
            };

            // Determine specific issue
            if (!data.heygenVideoId) {
              issue.issue = '❌ CRITICAL: Missing heygenVideoId (HeyGen API call may have failed)';
              missingVideoId++;
            } else if (data.heygenVideoUrl) {
              issue.issue = '⚠️  Has videoUrl but still in heygen_processing (webhook not called or failed)';
              hasVideoUrl++;
            } else if (data.heygenCompletedAt) {
              issue.issue = '⚠️  Has completedAt but still in heygen_processing (webhook failed after saving URL)';
              hasCompletedAt++;
            } else {
              issue.issue = '⏳ Waiting for HeyGen to complete (normal if < 15 min)';
            }

            issues.push(issue);
          }
        }

        // Also check for workflows that have heygenVideoUrl but wrong status
        if (data.heygenVideoUrl && status !== 'submagic_processing' && status !== 'completed' && status !== 'failed') {
          issues.push({
            workflowId: doc.id,
            brand,
            collection: name,
            status,
            issue: `🔥 Has heygenVideoUrl but status is "${status}" (should be submagic_processing)`,
            createdAt,
            stuckMinutes,
            heygenVideoId: data.heygenVideoId,
            heygenVideoUrl: data.heygenVideoUrl,
            heygenCompletedAt: data.heygenCompletedAt,
          });
        }
      });

      console.log(`   ├─ heygen_processing: ${heygenProcessing}`);
      console.log(`   ├─ Stuck (>10 min): ${heygenStuck}`);
      console.log(`   ├─ Missing videoId: ${missingVideoId}`);
      console.log(`   ├─ Has videoUrl: ${hasVideoUrl}`);
      console.log(`   └─ Has completedAt: ${hasCompletedAt}`);

    } catch (error) {
      console.error(`   ❌ Error checking ${name}:`, error);
    }
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 DETAILED ISSUES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (issues.length === 0) {
    console.log('✅ No stuck HeyGen workflows found!\n');
    return;
  }

  console.log(`Found ${issues.length} stuck workflows:\n`);

  // Group by issue type
  const grouped = issues.reduce((acc, issue) => {
    if (!acc[issue.issue]) acc[issue.issue] = [];
    acc[issue.issue].push(issue);
    return acc;
  }, {} as Record<string, WorkflowIssue[]>);

  Object.entries(grouped).forEach(([issueType, workflows]) => {
    console.log(`\n${issueType} (${workflows.length})`);
    console.log('─'.repeat(60));

    workflows.forEach(w => {
      console.log(`\n   Workflow: ${w.workflowId}`);
      console.log(`   Brand: ${w.brand}`);
      console.log(`   Collection: ${w.collection}`);
      console.log(`   Status: ${w.status}`);
      console.log(`   Stuck for: ${w.stuckMinutes} minutes`);
      console.log(`   Created: ${w.createdAt ? new Date(w.createdAt).toISOString() : 'unknown'}`);
      console.log(`   HeyGen Video ID: ${w.heygenVideoId || 'MISSING'}`);
      console.log(`   HeyGen Video URL: ${w.heygenVideoUrl || 'MISSING'}`);
      console.log(`   HeyGen Completed At: ${w.heygenCompletedAt ? new Date(w.heygenCompletedAt).toISOString() : 'MISSING'}`);
    });
  });

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 RECOMMENDATIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const missingVideoIdCount = issues.filter(i => i.issue.includes('Missing heygenVideoId')).length;
  const hasVideoUrlCount = issues.filter(i => i.issue.includes('Has videoUrl')).length;
  const wrongStatusCount = issues.filter(i => i.issue.includes('should be submagic_processing')).length;

  if (missingVideoIdCount > 0) {
    console.log(`❌ ${missingVideoIdCount} workflows missing heygenVideoId`);
    console.log('   → Problem: HeyGen API call failed or didn\'t return video_id');
    console.log('   → Check: HeyGen API logs, quota, API key validity\n');
  }

  if (hasVideoUrlCount > 0) {
    console.log(`⚠️  ${hasVideoUrlCount} workflows have videoUrl but stuck in heygen_processing`);
    console.log('   → Problem: Webhook was called and saved URL, but didn\'t advance to submagic_processing');
    console.log('   → Check: Webhook handler logs, Submagic API failures\n');
  }

  if (wrongStatusCount > 0) {
    console.log(`🔥 ${wrongStatusCount} workflows have videoUrl but wrong status`);
    console.log('   → Problem: Status update failed after webhook');
    console.log('   → Check: Database write permissions, webhook error handling\n');
  }

  // Check HeyGen API for completed videos
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 CHECKING HEYGEN API STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_API_KEY) {
    console.log('❌ HEYGEN_API_KEY not found in environment');
    return;
  }

  const workflowsWithVideoId = issues.filter(i => i.heygenVideoId);
  console.log(`Checking ${workflowsWithVideoId.length} workflows with HeyGen video IDs...\n`);

  for (const workflow of workflowsWithVideoId.slice(0, 10)) { // Check first 10
    try {
      const response = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${workflow.heygenVideoId}`,
        { headers: { 'x-api-key': HEYGEN_API_KEY } }
      );

      if (response.ok) {
        const data = await response.json();
        const heygenStatus = data.data?.status;
        const videoUrl = data.data?.video_url;

        console.log(`📹 ${workflow.workflowId}`);
        console.log(`   HeyGen Status: ${heygenStatus}`);
        console.log(`   Video URL: ${videoUrl ? 'Available' : 'Not ready'}`);
        console.log(`   DB Status: ${workflow.status}`);

        if (heygenStatus === 'completed' && videoUrl) {
          console.log(`   ❗ ISSUE: HeyGen shows completed with URL, but webhook didn't update DB`);
          console.log(`   → Webhook may have failed or not been called by HeyGen`);
        }
        console.log('');
      }
    } catch (error) {
      console.error(`   ❌ Error checking ${workflow.workflowId}:`, error);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

diagnoseStuckWorkflows()
  .then(() => {
    console.log('✅ Diagnostic complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  });
