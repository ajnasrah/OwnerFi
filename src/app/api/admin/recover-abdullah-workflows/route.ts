/**
 * Recovery API for Stuck Abdullah Workflows
 *
 * Recovers workflows stuck in "heygen_processing" or "synthesia_processing" by manually triggering Submagic
 *
 * Usage:
 *   POST https://ownerfi.ai/api/admin/recover-abdullah-workflows
 *   Authorization: Bearer YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';

const CRON_SECRET = process.env.CRON_SECRET;
const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export const maxDuration = 300; // 5 minutes for recovery

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('\n' + '='.repeat(70));
    console.log('🔧 ABDULLAH STUCK WORKFLOW RECOVERY');
    console.log('='.repeat(70) + '\n');

    // Verify authorization
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!SUBMAGIC_API_KEY) {
      throw new Error('SUBMAGIC_API_KEY not configured');
    }

    // Get all stuck Abdullah workflows (heygen_processing OR synthesia_processing)
    console.log('🔍 Finding stuck workflows...');
    const workflowsRef = collection(db, 'abdullah_workflow_queue');

    // Check both HeyGen and Synthesia stuck workflows
    const qHeygen = query(
      workflowsRef,
      where('status', '==', 'heygen_processing'),
      orderBy('createdAt', 'desc')
    );
    const qSynthesia = query(
      workflowsRef,
      where('status', '==', 'synthesia_processing'),
      orderBy('createdAt', 'desc')
    );

    const [heygenSnapshot, synthesiaSnapshot] = await Promise.all([
      getDocs(qHeygen),
      getDocs(qSynthesia)
    ]);

    const totalFound = heygenSnapshot.size + synthesiaSnapshot.size;
    console.log(`\n📊 Found ${totalFound} stuck workflows (${heygenSnapshot.size} HeyGen, ${synthesiaSnapshot.size} Synthesia)\n`);

    if (totalFound === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stuck workflows found',
        recovered: 0,
        failed: 0
      });
    }

    const stuckWorkflows: any[] = [];

    heygenSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.heygenVideoId) {
        stuckWorkflows.push({ id: docSnap.id, ...data });
      }
    });

    synthesiaSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.synthesiaVideoId) {
        stuckWorkflows.push({ id: docSnap.id, ...data, _provider: 'synthesia' });
      }
    });

    console.log(`⚠️  ${stuckWorkflows.length} workflows have video IDs (stuck after video completion)\n`);

    if (stuckWorkflows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All workflows are progressing normally',
        recovered: 0,
        failed: 0
      });
    }

    // Process each stuck workflow
    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const workflow of stuckWorkflows) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`📹 Processing: ${workflow.id}`);
      console.log(`   Title: ${workflow.title || workflow.articleTitle}`);
      console.log(`   HeyGen Video ID: ${workflow.heygenVideoId}`);

      try {
        let heygenVideoUrl = workflow.heygenVideoUrl;

        // Check if HeyGen video URL exists
        if (!heygenVideoUrl) {
          console.log(`   ⚠️  No HeyGen video URL - checking HeyGen status...`);

          // Fetch video status from HeyGen
          const heygenResponse = await fetch(
            `https://api.heygen.com/v1/video_status.get?video_id=${workflow.heygenVideoId}`,
            {
              headers: {
                'accept': 'application/json',
                'x-api-key': HEYGEN_API_KEY
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
            results.push({
              id: workflow.id,
              title: workflow.title || workflow.articleTitle,
              status: 'skipped',
              reason: 'HeyGen still processing'
            });
            continue;
          }

          heygenVideoUrl = heygenData.data.video_url;
          console.log(`   ✅ Retrieved HeyGen video URL`);

          // Update workflow with URL
          const docRef = doc(db, 'abdullah_workflow_queue', workflow.id);
          await updateDoc(docRef, {
            heygenVideoUrl,
            updatedAt: Date.now()
          });
        }

        // Trigger Submagic processing
        console.log(`   🎬 Triggering Submagic processing...`);

        const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
        const webhookUrl = `${BASE_URL}/api/webhooks/submagic/abdullah`;
        let title = workflow.title || workflow.articleTitle || `Abdullah Video - ${workflow.id}`;

        // Truncate title to 50 chars
        if (title.length > 50) {
          title = title.substring(0, 47) + '...';
        }

        const submagicConfig = {
          title,
          language: 'en',
          videoUrl: heygenVideoUrl,
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

        // Track Submagic cost
        try {
          const { trackCost, calculateSubmagicCost } = await import('@/lib/cost-tracker');
          await trackCost(
            'abdullah',
            'submagic',
            'caption_generation_recovery',
            1,
            calculateSubmagicCost(1),
            workflow.id
          );
          console.log(`   💰 Tracked Submagic cost: $0.25`);
        } catch (costError) {
          console.error(`   ⚠️  Failed to track Submagic cost:`, costError);
        }

        // Update workflow status
        const docRef = doc(db, 'abdullah_workflow_queue', workflow.id);
        await updateDoc(docRef, {
          status: 'submagic_processing',
          submagicVideoId: projectId,
          submagicProjectId: projectId,
          statusChangedAt: Date.now(),
          updatedAt: Date.now()
        });

        console.log(`   ✅ Workflow updated to "submagic_processing"`);
        console.log(`   ⏳ Webhooks will handle: Submagic → Late posting`);

        successCount++;
        results.push({
          id: workflow.id,
          title: workflow.title || workflow.articleTitle,
          status: 'recovered',
          submagicProjectId: projectId
        });

      } catch (error) {
        console.error(`   ❌ Error:`, error instanceof Error ? error.message : error);
        failCount++;

        // Mark as failed
        try {
          const docRef = doc(db, 'abdullah_workflow_queue', workflow.id);
          await updateDoc(docRef, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: Date.now(),
            updatedAt: Date.now()
          });
          console.log(`   📝 Marked as failed in database`);
        } catch (updateError) {
          console.error(`   ❌ Failed to update database:`, updateError);
        }

        results.push({
          id: workflow.id,
          title: workflow.title || workflow.articleTitle,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const duration = Date.now() - startTime;

    console.log(`\n${'='.repeat(70)}`);
    console.log('🏁 RECOVERY COMPLETE');
    console.log(`   ✅ Recovered: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📊 Total: ${stuckWorkflows.length}`);
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log('='.repeat(70) + '\n');

    return NextResponse.json({
      success: true,
      message: `Recovered ${successCount}/${stuckWorkflows.length} stuck workflows`,
      recovered: successCount,
      failed: failCount,
      total: stuckWorkflows.length,
      results,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('\n❌ RECOVERY ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Recovery failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}
