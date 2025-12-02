/**
 * Gaza News Video Cron
 *
 * Runs 5x daily to generate up to 5 Gaza humanitarian news videos per day
 * Schedule: 9 AM, 12 PM, 3 PM, 6 PM, 9 PM CDT
 *
 * Features:
 * - Fetches highest-quality pro-Gaza articles from RSS feeds
 * - Generates sad/dramatic news video scripts
 * - Uses round-robin multi-agent selection
 * - Article screenshot backgrounds
 * - Donation CTA in every video
 * - Environment validation at startup
 * - Feed health checks before article selection
 * - Error alerting for failures
 */

import { NextRequest, NextResponse } from 'next/server';
import { createGazaVideoGenerator, GazaArticle } from '@/lib/gaza-video-generator';
import {
  getAndLockArticle,
  addWorkflowToQueue,
  updateWorkflowStatus,
  getCollectionName,
} from '@/lib/feed-store-firestore';
import { getBrandConfig } from '@/config/brand-configs';
import {
  validateGazaEnv,
  logGazaEnvValidation,
} from '@/lib/gaza-env-validation';
import {
  alertEnvValidationFailed,
  alertArticleSelectionFailed,
  alertHeyGenFailed,
  alertDailyLimitReached,
} from '@/lib/gaza-alerting';
import {
  isGazaFeedsHealthy,
  getAvailableArticleCount,
} from '@/lib/gaza-feed-health';
import { captureArticleScreenshot } from '@/lib/gaza-screenshot';

const CRON_SECRET = process.env.CRON_SECRET;
const BRAND = 'gaza' as const;

export const maxDuration = 60;

// Track videos generated today
async function getVideosGeneratedToday(): Promise<number> {
  try {
    const { getAdminDb } = await import('@/lib/firebase-admin');
    const adminDb = await getAdminDb();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();

    const snapshot = await adminDb
      .collection('gaza_workflow_queue')
      .where('createdAt', '>=', startOfDay)
      .get();

    return snapshot.size;
  } catch (error) {
    console.error('Error checking videos generated today:', error);
    return 0;
  }
}

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

    console.log('\n🇵🇸 Gaza news video cron triggered');

    // STEP 1: Validate environment variables
    const envValidation = validateGazaEnv();
    logGazaEnvValidation(envValidation);

    if (!envValidation.valid) {
      // Alert about env validation failure
      await alertEnvValidationFailed(envValidation.errors);

      return NextResponse.json({
        success: false,
        error: 'Environment validation failed',
        errors: envValidation.errors,
        warnings: envValidation.warnings,
      }, { status: 500 });
    }

    // STEP 2: Check feed health (use cached result if recent)
    const feedsHealthy = await isGazaFeedsHealthy();
    if (!feedsHealthy) {
      console.warn('⚠️  Gaza feeds may be unhealthy - continuing anyway');
    }

    // Log article availability
    const availableArticles = await getAvailableArticleCount();
    console.log(`📊 Available high-quality articles: ${availableArticles}`);

    // Check for force parameter to bypass daily limit
    const forceGenerate = request.nextUrl.searchParams.get('force') === 'true';
    const brandConfig = getBrandConfig(BRAND);

    // Check daily limit
    const videosToday = await getVideosGeneratedToday();
    const maxPerDay = brandConfig.scheduling.maxPostsPerDay;

    if (videosToday >= maxPerDay && !forceGenerate) {
      console.log(`⏭️  Already generated ${videosToday}/${maxPerDay} videos today - skipping`);

      // Alert (info level) that daily limit was reached
      await alertDailyLimitReached(videosToday, maxPerDay);

      return NextResponse.json({
        success: true,
        skipped: true,
        message: `Daily limit reached (${videosToday}/${maxPerDay} videos generated)`,
        videosToday,
        maxPerDay
      });
    }

    if (forceGenerate) {
      console.log('🔥 FORCE mode enabled - bypassing daily limit check');
    }

    console.log(`✅ Videos today: ${videosToday}/${maxPerDay}`);

    // Get API key
    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not configured');
    }

    // Get and lock the highest quality article
    const article = await getAndLockArticle(BRAND);

    if (!article) {
      console.log('⚠️  No articles available for video generation');
      console.log('   Check if RSS feeds have been fetched and rated');

      // Alert about article selection failure
      await alertArticleSelectionFailed(
        `No high-quality articles available. Available: ${availableArticles}, Feeds healthy: ${feedsHealthy}`
      );

      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'No articles available - ensure RSS feeds are fetched and rated',
        videosToday,
        availableArticles,
        feedsHealthy,
      });
    }

    console.log(`\n📰 Selected article: ${article.title}`);
    console.log(`   Quality score: ${article.qualityScore || 'N/A'}`);
    console.log(`   Source: ${article.feedId}`);

    // Create workflow
    const workflow = await addWorkflowToQueue(
      article.id,
      article.title,
      BRAND
    );

    console.log(`📝 Created workflow: ${workflow.id}`);

    try {
      // Initialize generator
      const generator = createGazaVideoGenerator();

      // Convert Article to GazaArticle format
      // Capture screenshot of article for video background
      let screenshotUrl: string | undefined;
      try {
        const screenshotResult = await captureArticleScreenshot(article.link);
        if (screenshotResult.success && screenshotResult.imageUrl) {
          screenshotUrl = screenshotResult.imageUrl;
          console.log(`📸 Article screenshot captured: ${screenshotUrl}`);
        } else {
          console.log(`📸 Using dark background (screenshot ${screenshotResult.fallbackUsed ? 'fallback' : 'failed'})`);
        }
      } catch (screenshotError) {
        console.warn('⚠️  Screenshot capture error:', screenshotError);
      }

      const gazaArticle: GazaArticle = {
        id: article.id,
        title: article.title,
        content: article.content,
        description: article.description,
        link: article.link,
        pubDate: article.pubDate,
        source: article.feedId,
        imageUrl: screenshotUrl, // Article screenshot for background
      };

      // Generate video with round-robin agent selection
      const { videoId, agentId, script } = await generator.generateVideo(
        gazaArticle,
        workflow.id,
        screenshotUrl, // Use captured screenshot as background
        { mode: 'round-robin' }
      );

      // Generate caption
      const caption = generator.generateCaption(gazaArticle);

      // Update workflow with video info
      await updateWorkflowStatus(workflow.id, BRAND, {
        heygenVideoId: videoId,
        status: 'heygen_processing',
        caption,
        title: article.title,
        script,
        agentId,
        articleLink: article.link,
      });

      console.log(`✅ Video initiated - Workflow ID: ${workflow.id}`);
      console.log(`   HeyGen Video ID: ${videoId}`);
      console.log(`   Agent: ${agentId}`);

      const duration = Date.now() - startTime;
      console.log(`\n🎉 Gaza news video generation complete in ${duration}ms`);
      console.log(`   ⚡ Next: HeyGen → Submagic → Late API (automatic via webhooks)`);

      return NextResponse.json({
        success: true,
        workflow_id: workflow.id,
        article: {
          id: article.id,
          title: article.title,
          quality_score: article.qualityScore,
          source: article.feedId
        },
        video: {
          heygen_video_id: videoId,
          agent_id: agentId
        },
        stats: {
          videos_today: videosToday + 1,
          max_per_day: maxPerDay,
          duration_ms: duration
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark workflow as failed
      await updateWorkflowStatus(workflow.id, BRAND, {
        status: 'failed',
        error: errorMessage,
        failedAt: Date.now()
      });

      // Alert about HeyGen generation failure
      await alertHeyGenFailed(workflow.id, article.title, errorMessage);

      throw error;
    }

  } catch (error) {
    console.error('❌ Gaza cron error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - startTime
    }, { status: 500 });
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
