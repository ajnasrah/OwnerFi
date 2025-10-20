// Automated Benefit Video Generation Cron Job
// Runs 5x daily (9 AM, 12 PM, 3 PM, 6 PM, 9 PM CDT)
// Generates up to 2 videos per day (1 seller + 1 buyer)
// Mixes with podcast content for diverse social media feed

import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 60; // 1 minute (webhook-based, no polling)

export async function GET(request: NextRequest) {
  const generatedWorkflows: string[] = []; // Track all generated workflows

  try {
    // Verify authorization - allow dashboard, CRON_SECRET, or Vercel cron
    const authHeader = request.headers.get('authorization');
    const referer = request.headers.get('referer');
    const userAgent = request.headers.get('user-agent');

    const isFromDashboard = referer && referer.includes(request.headers.get('host') || '');
    const hasValidSecret = authHeader === `Bearer ${CRON_SECRET}`;
    const isVercelCron = userAgent === 'vercel-cron/1.0';

    if (!isFromDashboard && !hasValidSecret && !isVercelCron) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check for force parameter (from dashboard button)
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    console.log('🏡 Benefit video cron job triggered - Generating daily videos');
    if (force) {
      console.log('⚡ Force mode enabled - Bypassing scheduler check');
    }

    // Import libraries
    const BenefitScheduler = (await import('../../../../../podcast/lib/benefit-scheduler')).default;
    const BenefitVideoGenerator = (await import('../../../../../podcast/lib/benefit-video-generator')).default;
    const {
      getRandomBenefit,
      generateBenefitCaption,
      generateBenefitTitle
    } = await import('../../../../../podcast/lib/benefit-content');
    const {
      addBenefitWorkflow,
      updateBenefitWorkflow
    } = await import('@/lib/feed-store-firestore');

    // Check if we should generate videos
    const scheduler = new BenefitScheduler();
    await scheduler.loadStateFromFirestore();

    const { shouldGenerate, needSeller, needBuyer } = scheduler.shouldGenerateVideos();

    if (!force && !shouldGenerate) {
      console.log('⏭️  Skipping - Already generated today\'s videos');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Already generated today\'s videos',
        stats: scheduler.getStats()
      });
    }

    console.log('✅ Time to generate benefit videos!');
    console.log(`   Needs: ${needSeller ? 'seller' : ''}${needSeller && needBuyer ? ' + ' : ''}${needBuyer ? 'buyer' : ''}`);

    // Get API keys
    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not configured');
    }

    const generator = new BenefitVideoGenerator(HEYGEN_API_KEY);
    const { getBrandWebhookUrl } = await import('@/lib/brand-utils');
    const results: any[] = [];

    // Generate seller video if needed
    if (force || needSeller) {
      console.log('\n📹 Generating SELLER benefit video...');

      const recentSellerIds = scheduler.getRecentBenefitIds('seller', 5);
      const sellerBenefit = getRandomBenefit('seller', recentSellerIds);

      if (!sellerBenefit) {
        throw new Error('No available seller benefits (all recently used)');
      }

      console.log(`   Selected: ${sellerBenefit.title}`);

      // Create workflow
      const sellerWorkflow = await addBenefitWorkflow(
        sellerBenefit.id,
        'seller',
        sellerBenefit.title
      );
      generatedWorkflows.push(sellerWorkflow.id);

      // Generate video with HeyGen
      const webhookUrl = getBrandWebhookUrl('benefit', 'heygen');
      const videoId = await generator.generateBenefitVideo(
        sellerBenefit,
        sellerWorkflow.id
      );

      // Update workflow
      await updateBenefitWorkflow(sellerWorkflow.id, {
        heygenVideoId: videoId,
        caption: generateBenefitCaption(sellerBenefit),
        title: generateBenefitTitle(sellerBenefit)
      });

      // Record in scheduler
      await scheduler.recordBenefitVideo(
        sellerBenefit.id,
        'seller',
        sellerWorkflow.id
      );

      console.log(`✅ Seller video initiated - Workflow ID: ${sellerWorkflow.id}`);

      results.push({
        audience: 'seller',
        benefit_id: sellerBenefit.id,
        benefit_title: sellerBenefit.title,
        video_id: videoId,
        workflow_id: sellerWorkflow.id
      });
    }

    // Generate buyer video if needed
    if (force || needBuyer) {
      console.log('\n📹 Generating BUYER benefit video...');

      const recentBuyerIds = scheduler.getRecentBenefitIds('buyer', 5);
      const buyerBenefit = getRandomBenefit('buyer', recentBuyerIds);

      if (!buyerBenefit) {
        throw new Error('No available buyer benefits (all recently used)');
      }

      console.log(`   Selected: ${buyerBenefit.title}`);

      // Create workflow
      const buyerWorkflow = await addBenefitWorkflow(
        buyerBenefit.id,
        'buyer',
        buyerBenefit.title
      );
      generatedWorkflows.push(buyerWorkflow.id);

      // Generate video with HeyGen
      const videoId = await generator.generateBenefitVideo(
        buyerBenefit,
        buyerWorkflow.id
      );

      // Update workflow
      await updateBenefitWorkflow(buyerWorkflow.id, {
        heygenVideoId: videoId,
        caption: generateBenefitCaption(buyerBenefit),
        title: generateBenefitTitle(buyerBenefit)
      });

      // Record in scheduler
      await scheduler.recordBenefitVideo(
        buyerBenefit.id,
        'buyer',
        buyerWorkflow.id
      );

      console.log(`✅ Buyer video initiated - Workflow ID: ${buyerWorkflow.id}`);

      results.push({
        audience: 'buyer',
        benefit_id: buyerBenefit.id,
        benefit_title: buyerBenefit.title,
        video_id: videoId,
        workflow_id: buyerWorkflow.id
      });
    }

    console.log(`\n🎉 Generated ${results.length} benefit video(s)!`);
    console.log(`   ⚡ HeyGen → Submagic → Late API (automatic via webhooks)`);

    return NextResponse.json({
      success: true,
      videos: results,
      message: `Benefit video generation started. Workflow continues via webhooks (HeyGen → Submagic → Late API).`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Benefit cron job error:', error);

    // Try to mark all workflows as failed
    if (generatedWorkflows.length > 0) {
      try {
        const { updateBenefitWorkflow } = await import('@/lib/feed-store-firestore');
        for (const workflowId of generatedWorkflows) {
          await updateBenefitWorkflow(workflowId, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
        console.log(`✅ Marked ${generatedWorkflows.length} workflow(s) as failed`);
      } catch (updateError) {
        console.error('Failed to update workflow statuses:', updateError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        workflow_ids: generatedWorkflows,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Also support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request);
}
