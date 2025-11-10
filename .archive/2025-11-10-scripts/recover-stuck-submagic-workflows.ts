#!/usr/bin/env tsx
/**
 * Recover Stuck Submagic Workflows
 *
 * For workflows stuck in submagic_processing status:
 * 1. Check actual Submagic project status via API
 * 2. If completed, download video and complete workflow
 * 3. If failed, mark workflow as failed
 */

import { getAdminDb } from '../src/lib/firebase-admin';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

interface WorkflowData {
  id: string;
  status: string;
  submagicVideoId: string;
  heygenVideoId?: string;
  benefitTitle?: string;
  articleTitle?: string;
  episodeTitle?: string;
  createdAt: number;
  brand: string;
}

async function checkSubmagicStatus(projectId: string): Promise<any> {
  if (!SUBMAGIC_API_KEY) {
    throw new Error('SUBMAGIC_API_KEY not set');
  }

  const response = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
    headers: {
      'x-api-key': SUBMAGIC_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Submagic API error: ${response.status}`);
  }

  return response.json();
}

async function recoverStuckWorkflows(brand: string, collectionName: string, adminDb: any) {
  console.log(`\n🔍 Checking ${brand} workflows...`);

  try {
    const workflowsRef = adminDb.collection(collectionName);
    const snapshot = await workflowsRef
      .where('status', '==', 'submagic_processing')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    if (snapshot.empty) {
      console.log(`   ✅ No stuck workflows`);
      return;
    }

    console.log(`   Found ${snapshot.size} stuck workflows\n`);

    for (const doc of snapshot.docs) {
      const workflow = doc.data() as WorkflowData;
      const workflowId = doc.id;
      const title = workflow.benefitTitle || workflow.articleTitle || workflow.episodeTitle || 'N/A';
      const ageHours = Math.round((Date.now() - workflow.createdAt) / (1000 * 60 * 60));

      console.log(`   📋 ${workflowId}`);
      console.log(`      Title: ${title.substring(0, 60)}`);
      console.log(`      Age: ${ageHours}h`);
      console.log(`      Submagic ID: ${workflow.submagicVideoId}`);

      if (!workflow.submagicVideoId) {
        console.log(`      ⚠️  No Submagic ID - skipping`);
        continue;
      }

      try {
        // Check Submagic status
        const submagicData = await checkSubmagicStatus(workflow.submagicVideoId);
        console.log(`      Submagic Status: ${submagicData.status}`);

        if (submagicData.status === 'completed' || submagicData.status === 'done' || submagicData.status === 'ready') {
          const videoUrl = submagicData.media_url || submagicData.mediaUrl || submagicData.video_url || submagicData.videoUrl || submagicData.downloadUrl || submagicData.download_url;

          if (videoUrl) {
            console.log(`      ✅ Video ready: ${videoUrl.substring(0, 60)}...`);
            console.log(`      🔧 Triggering webhook manually...`);

            // Call the webhook endpoint manually
            const webhookResponse = await fetch(`https://ownerfi.ai/api/webhooks/submagic/${brand}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                projectId: workflow.submagicVideoId,
                id: workflow.submagicVideoId,
                status: 'completed',
                media_url: videoUrl,
                downloadUrl: videoUrl
              })
            });

            if (webhookResponse.ok) {
              console.log(`      ✅ Webhook triggered successfully\n`);
            } else {
              const error = await webhookResponse.text();
              console.log(`      ❌ Webhook failed: ${error}\n`);
            }
          } else {
            console.log(`      ⚠️  No video URL in Submagic response\n`);
          }
        } else if (submagicData.status === 'failed' || submagicData.status === 'error') {
          console.log(`      ❌ Submagic failed - marking workflow as failed`);
          await doc.ref.update({
            status: 'failed',
            error: `Submagic processing failed: ${submagicData.error || 'Unknown error'}`
          });
          console.log(`      ✅ Workflow marked as failed\n`);
        } else {
          console.log(`      ⏳ Still processing (${submagicData.status})\n`);
        }

        // Rate limit: wait 2 seconds between checks
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.log(`      ❌ Error checking Submagic: ${error instanceof Error ? error.message : error}\n`);
      }
    }

  } catch (error) {
    console.error(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
  }
}

async function main() {
  console.log('🔧 Recovering Stuck Submagic Workflows\n');
  console.log('═'.repeat(60));

  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('❌ Firebase Admin not initialized. Make sure FIREBASE_* env vars are set.');
    process.exit(1);
  }

  const brands = [
    { name: 'benefit', collection: 'benefit_workflow_queue' },
    { name: 'property', collection: 'property_videos' },
    { name: 'carz', collection: 'carz_workflow_queue' },
    { name: 'ownerfi', collection: 'ownerfi_workflow_queue' },
    { name: 'podcast', collection: 'podcast_workflow_queue' },
    { name: 'vassdistro', collection: 'vassdistro_workflow_queue' },
    { name: 'abdullah', collection: 'abdullah_workflow_queue' },
  ];

  for (const brand of brands) {
    await recoverStuckWorkflows(brand.name, brand.collection, adminDb);
  }

  console.log('\n═'.repeat(60));
  console.log('✅ Recovery complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
