/**
 * Benefit Workflow Auto-Retry Cron
 * Automatically finds and retries failed benefit workflows
 * Run every hour to catch and fix failures
 */

import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';
import { BenefitVideoGenerator } from '@/lib/benefit-video-generator';
import { getBenefitById } from '@/lib/benefit-content';
import { updateBenefitWorkflow } from '@/lib/feed-store-firestore';

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_RETRY_COUNT = 3; // Maximum retries per workflow
const RETRY_AGE_HOURS = 1; // Only retry workflows that failed within last hour

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const referer = request.headers.get('referer');
    const userAgent = request.headers.get('user-agent');

    const isFromDashboard = referer && referer.includes(request.headers.get('host') || '');
    const hasValidSecret = authHeader === `Bearer ${CRON_SECRET}`;
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (!isFromDashboard && !hasValidSecret && !isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n🔄 Auto-retry cron triggered - checking for failed benefit workflows');

    const db = admin.firestore();

    // Find failed workflows that are eligible for retry
    const oneHourAgo = Date.now() - (RETRY_AGE_HOURS * 60 * 60 * 1000);

    const snapshot = await db
      .collection('benefit_workflow_queue')
      .where('status', '==', 'failed')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    if (snapshot.empty) {
      console.log('✅ No failed workflows found');
      return NextResponse.json({
        success: true,
        message: 'No failed workflows to retry',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📋 Found ${snapshot.size} failed workflow(s)`);

    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not configured');
    }

    const generator = new BenefitVideoGenerator(HEYGEN_API_KEY);
    const results: any[] = [];

    for (const doc of snapshot.docs) {
      const workflow = doc.data();
      const workflowId = doc.id;

      const retryCount = workflow.retryCount || 0;
      const createdAt = workflow.createdAt || 0;

      // Skip if too old
      if (createdAt < oneHourAgo) {
        console.log(`⏭️  Skipping ${workflowId} - too old (${new Date(createdAt).toISOString()})`);
        continue;
      }

      // Skip if already retried too many times
      if (retryCount >= MAX_RETRY_COUNT) {
        console.log(`⏭️  Skipping ${workflowId} - max retries reached (${retryCount}/${MAX_RETRY_COUNT})`);
        continue;
      }

      console.log(`\n🔄 Retrying workflow: ${workflowId}`);
      console.log(`   Benefit: ${workflow.benefitId}`);
      console.log(`   Retry count: ${retryCount}/${MAX_RETRY_COUNT}`);
      console.log(`   Previous error: ${workflow.error}`);

      try {
        // Get benefit data
        const benefit = getBenefitById(workflow.benefitId);
        if (!benefit) {
          console.error(`❌ Benefit not found: ${workflow.benefitId}`);
          results.push({
            workflowId,
            success: false,
            error: 'Benefit not found'
          });
          continue;
        }

        // Reset workflow status
        await updateBenefitWorkflow(workflowId, {
          status: 'heygen_processing',
          error: null,
          retryCount: retryCount + 1,
          lastRetryAt: Date.now()
        });

        // Generate video
        const videoId = await generator.generateVideo(benefit, workflowId);

        // Update workflow with new video ID
        await updateBenefitWorkflow(workflowId, {
          heygenVideoId: videoId
        });

        console.log(`✅ Retry successful - video ID: ${videoId}`);

        results.push({
          workflowId,
          success: true,
          videoId,
          retryCount: retryCount + 1
        });

      } catch (error) {
        console.error(`❌ Retry failed for ${workflowId}:`, error);

        // Update workflow with retry failure
        await updateBenefitWorkflow(workflowId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown retry error',
          retryCount: retryCount + 1,
          lastRetryAt: Date.now()
        });

        results.push({
          workflowId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount: retryCount + 1
        });
      }
    }

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n🎉 Auto-retry complete in ${duration}ms`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failCount
      },
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Auto-retry cron error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
