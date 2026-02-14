/**
 * Benefit Video Cron - BUYER-ONLY
 *
 * Runs 5x daily to generate up to 5 buyer benefit videos per day
 * Schedule: 9 AM, 12 PM, 3 PM, 6 PM, 9 PM CDT
 */

import { NextRequest, NextResponse } from 'next/server';
import { BenefitScheduler } from '@/lib/benefit-scheduler';
import { BenefitVideoGenerator } from '@/lib/benefit-video-generator';
import {
  getRandomBenefit,
  generateBenefitCaption,
  generateBenefitTitle
} from '@/lib/benefit-content';
import {
  addBenefitWorkflow,
  updateBenefitWorkflow
} from '@/lib/feed-store-firestore';

const CRON_SECRET = process.env.CRON_SECRET;

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

    console.log('\n🏡 Benefit video cron triggered');

    // Check for force parameter to bypass daily limit
    const forceGenerate = request.nextUrl.searchParams.get('force') === 'true';

    // Check scheduler
    const videosNeeded = await BenefitScheduler.getVideosNeeded();

    if (videosNeeded === 0 && !forceGenerate) {
      console.log('⏭️  Already generated 5 videos today - skipping');

      const stats = await BenefitScheduler.getStats();
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Daily limit reached (5/5 videos generated)',
        stats
      });
    }

    if (forceGenerate) {
      console.log('🔥 FORCE mode enabled - bypassing daily limit check');
    }

    console.log(`✅ Need to generate ${videosNeeded} video(s) today`);

    // Determine video provider
    const { videoProvider } = await import('@/lib/env-config');
    const activeProvider = videoProvider;
    console.log(`🎥 Video provider: ${activeProvider}`);

    const results: any[] = [];

    // Generate ONE video per cron run (5 runs per day = 5 videos)
    // This prevents timeout issues and allows for better error recovery
    const recentIds = await BenefitScheduler.getRecentBenefitIds();
    const benefit = getRandomBenefit(recentIds);

    if (!benefit) {
      throw new Error('No available benefits (all recently used - should not happen with 10 benefits)');
    }

    console.log(`\n📹 Selected benefit: ${benefit.title}`);

    // Claim a slot atomically (prevents race conditions) - skip if force mode
    if (!forceGenerate) {
      const claimed = await BenefitScheduler.claimVideoSlot(benefit.id);

      if (!claimed) {
        console.log('⚠️  Daily limit reached while claiming slot - skipping');
        const stats = await BenefitScheduler.getStats();
        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Daily limit reached during generation',
          stats
        });
      }
    }

    // Create workflow
    const workflow = await addBenefitWorkflow(
      benefit.id,
      'buyer',
      benefit.title
    );

    console.log(`📝 Created workflow: ${workflow.id}`);

    try {
      let videoId: string;
      let agentId: string;

      if (activeProvider === 'synthesia') {
        // Synthesia path
        const { generateSynthesiaVideo } = await import('@/lib/synthesia-client');
        const { getSynthesiaAgentForBrand, buildSynthesiaClipConfig } = await import('@/config/synthesia-agents');

        // Generate script inline for Synthesia (reuse benefit content)
        const script = benefit.shortDescription
          ? `Think you can't buy a home? ${benefit.shortDescription} See what's possible at Owner-Fy dot A Eye.`
          : benefit.title;

        const synthAgent = getSynthesiaAgentForBrand('benefit');
        const clip = buildSynthesiaClipConfig(synthAgent, script);

        const result = await generateSynthesiaVideo(
          {
            title: generateBenefitTitle(benefit),
            aspectRatio: '9:16',
            clips: [clip],
            callbackId: `benefit:${workflow.id}`,
          },
          'benefit',
          workflow.id
        );

        if (!result.success || !result.video_id) {
          throw new Error(result.error || 'Synthesia video generation failed');
        }

        videoId = result.video_id;
        agentId = synthAgent.id;

        await updateBenefitWorkflow(workflow.id, {
          synthesiaVideoId: videoId,
          videoProvider: 'synthesia',
          agentId,
          status: 'synthesia_processing',
          caption: generateBenefitCaption(benefit),
          title: generateBenefitTitle(benefit)
        });
      } else {
        // HeyGen path (original)
        const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
        if (!HEYGEN_API_KEY) throw new Error('HEYGEN_API_KEY not configured');

        const generator = new BenefitVideoGenerator(HEYGEN_API_KEY);
        const result = await generator.generateVideo(benefit, workflow.id);

        videoId = result.videoId;
        agentId = result.agentId;

        await updateBenefitWorkflow(workflow.id, {
          heygenVideoId: videoId,
          videoProvider: 'heygen',
          agentId,
          status: 'heygen_processing',
          caption: generateBenefitCaption(benefit),
          title: generateBenefitTitle(benefit)
        });
      }

      console.log(`✅ Video initiated (${activeProvider}) - Workflow ID: ${workflow.id}`);

      results.push({
        benefit_id: benefit.id,
        benefit_title: benefit.title,
        video_id: videoId,
        workflow_id: workflow.id,
        provider: activeProvider
      });

    } catch (error) {
      // Mark workflow as failed
      await updateBenefitWorkflow(workflow.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }

    const duration = Date.now() - startTime;
    console.log(`\n🎉 Benefit video generation complete in ${duration}ms`);
    console.log(`   ⚡ Next: ${activeProvider} → Submagic → Late API (automatic via webhooks)`);

    const stats = await BenefitScheduler.getStats();

    return NextResponse.json({
      success: true,
      videos: results,
      stats,
      duration_ms: duration,
      message: 'Benefit video generation started. Workflow continues via webhooks.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Benefit cron error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Support POST for Vercel cron
export async function POST(_request: NextRequest) {
  return GET(_request);
}
