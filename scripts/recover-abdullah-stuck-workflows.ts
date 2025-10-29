/**
 * Recovery Script for Stuck Abdullah Workflows
 *
 * This script recovers the 10 Abdullah workflows that are stuck in "heygen_processing"
 * because HeyGen completed but the webhook couldn't trigger Submagic (bug now fixed).
 *
 * Usage:
 *   npx tsx scripts/recover-abdullah-stuck-workflows.ts
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

interface AbdullahWorkflow {
  id: string;
  status: string;
  heygenVideoId?: string;
  heygenVideoUrl?: string;
  articleTitle?: string;
  title?: string;
  caption?: string;
  createdAt: any;
}

async function recoverStuckWorkflows() {
  console.log('\n' + '='.repeat(70));
  console.log('🔧 ABDULLAH STUCK WORKFLOW RECOVERY');
  console.log('='.repeat(70) + '\n');

  if (!SUBMAGIC_API_KEY) {
    throw new Error('SUBMAGIC_API_KEY not configured');
  }

  try {
    // Get all stuck Abdullah workflows (status = heygen_processing with heygenVideoId)
    console.log('🔍 Finding stuck workflows...');
    const workflowsRef = db.collection('abdullah_workflow_queue');
    const query = workflowsRef
      .where('status', '==', 'heygen_processing')
      .orderBy('createdAt', 'desc');

    const snapshot = await query.get();

    console.log(`\n📊 Found ${snapshot.size} workflows in "heygen_processing" status\n`);

    if (snapshot.empty) {
      console.log('✅ No stuck workflows found!');
      return;
    }

    const stuckWorkflows: AbdullahWorkflow[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.heygenVideoId) {
        stuckWorkflows.push({
          id: doc.id,
          status: data.status,
          heygenVideoId: data.heygenVideoId,
          heygenVideoUrl: data.heygenVideoUrl,
          articleTitle: data.articleTitle,
          title: data.title,
          caption: data.caption,
          createdAt: data.createdAt
        });
      }
    });

    console.log(`⚠️  ${stuckWorkflows.length} workflows have HeyGen video IDs (stuck after HeyGen completion)\n`);

    if (stuckWorkflows.length === 0) {
      console.log('✅ All workflows are progressing normally');
      return;
    }

    // Process each stuck workflow
    let successCount = 0;
    let failCount = 0;

    for (const workflow of stuckWorkflows) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`📹 Processing: ${workflow.id}`);
      console.log(`   Title: ${workflow.title || workflow.articleTitle}`);
      console.log(`   HeyGen Video ID: ${workflow.heygenVideoId}`);

      try {
        // Check if HeyGen video URL exists
        if (!workflow.heygenVideoUrl) {
          console.log(`   ⚠️  No HeyGen video URL - checking HeyGen status...`);

          // Fetch video status from HeyGen
          const heygenResponse = await fetch(
            `https://api.heygen.com/v1/video_status.get?video_id=${workflow.heygenVideoId}`,
            {
              headers: {
                'accept': 'application/json',
                'x-api-key': process.env.HEYGEN_API_KEY || ''
              }
            }
          );

          if (!heygenResponse.ok) {
            throw new Error(`HeyGen API error: ${heygenResponse.status}`);
          }

          const heygenData = await heygenResponse.json();

          if (heygenData.data?.status !== 'completed') {
            console.log(`   ⏳ HeyGen still processing (status: ${heygenData.data?.status})`);
            console.log(`   ⏭️  Skipping - will be handled by webhook when ready`);
            continue;
          }

          workflow.heygenVideoUrl = heygenData.data.video_url;
          console.log(`   ✅ Retrieved HeyGen video URL: ${workflow.heygenVideoUrl}`);

          // Update workflow with URL
          await db.collection('abdullah_workflow_queue').doc(workflow.id).update({
            heygenVideoUrl: workflow.heygenVideoUrl,
            updatedAt: Date.now()
          });
        }

        // Trigger Submagic processing
        console.log(`   🎬 Triggering Submagic processing...`);

        const webhookUrl = `${BASE_URL}/api/webhooks/submagic/abdullah`;
        let title = workflow.title || workflow.articleTitle || `Abdullah Video - ${workflow.id}`;

        // Truncate title to 50 chars
        if (title.length > 50) {
          title = title.substring(0, 47) + '...';
        }

        const submagicConfig = {
          title,
          language: 'en',
          videoUrl: workflow.heygenVideoUrl,
          webhookUrl,
          templateName: 'Hormozi 2',
          magicZooms: true,
          magicBrolls: true,
          magicBrollsPercentage: 75,
          removeSilencePace: 'fast',
          removeBadTakes: true,
        };

        const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
          method: 'POST',
          headers: {
            'x-api-key': SUBMAGIC_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(submagicConfig)
        });

        if (!submagicResponse.ok) {
          const errorText = await submagicResponse.text();
          throw new Error(`Submagic API error: ${submagicResponse.status} - ${errorText}`);
        }

        const submagicData = await submagicResponse.json();
        const projectId = submagicData?.id || submagicData?.project_id || submagicData?.projectId;

        if (!projectId) {
          throw new Error('Submagic did not return project ID');
        }

        console.log(`   ✅ Submagic project created: ${projectId}`);

        // Update workflow status
        await db.collection('abdullah_workflow_queue').doc(workflow.id).update({
          status: 'submagic_processing',
          submagicVideoId: projectId,
          submagicProjectId: projectId,
          statusChangedAt: Date.now(),
          updatedAt: Date.now()
        });

        console.log(`   ✅ Workflow updated to "submagic_processing"`);
        console.log(`   ⏳ Webhooks will handle: Submagic → Late posting`);

        successCount++;

      } catch (error) {
        console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
        failCount++;

        // Mark as failed
        try {
          await db.collection('abdullah_workflow_queue').doc(workflow.id).update({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: Date.now(),
            updatedAt: Date.now()
          });
          console.log(`   📝 Marked as failed in database`);
        } catch (updateError) {
          console.error(`   ❌ Failed to update database:`, updateError);
        }
      }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log('🏁 RECOVERY COMPLETE');
    console.log(`   ✅ Recovered: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📊 Total: ${stuckWorkflows.length}`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ RECOVERY SCRIPT ERROR:', error);
    process.exit(1);
  }
}

// Run recovery
recoverStuckWorkflows()
  .then(() => {
    console.log('✅ Recovery script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Recovery script failed:', error);
    process.exit(1);
  });
