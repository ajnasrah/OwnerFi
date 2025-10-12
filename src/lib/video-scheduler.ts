// Automated Video Generation Scheduler
// Continuously processes RSS feeds and generates videos

import { fetchWithTimeout, TIMEOUTS } from './api-utils';
import {
  getAllFeedSources,
  getUnprocessedArticles,
  markArticleProcessed,
  addToVideoQueue,
  getPendingQueueItems,
  updateQueueItem,
  getStats,
  type Article
} from './feed-store';
import { processFeedSources } from './rss-fetcher';
import { getFeedsToFetch } from '@/config/feed-sources';
import { randomUUID } from 'crypto';

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

interface SchedulerConfig {
  maxVideosPerDay: {
    carz: number;
    ownerfi: number;
  };
  feedCheckInterval: number; // minutes
  videoProcessInterval: number; // minutes
  enabled: boolean;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  maxVideosPerDay: {
    carz: 5, // 5 Carz videos per day
    ownerfi: 5 // 5 OwnerFi videos per day
  },
  feedCheckInterval: 15, // Check feeds every 15 minutes
  videoProcessInterval: 5, // Process video queue every 5 minutes
  enabled: true
};

let schedulerConfig: SchedulerConfig = { ...DEFAULT_CONFIG };
let feedCheckTimer: NodeJS.Timeout | null = null;
let videoProcessTimer: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Start the automated scheduler
 */
export async function startScheduler(config?: Partial<SchedulerConfig>) {
  if (isRunning) {
    console.log('⚠️  Scheduler already running');
    return;
  }

  // Merge config
  schedulerConfig = { ...DEFAULT_CONFIG, ...config };

  if (!schedulerConfig.enabled) {
    console.log('⚠️  Scheduler is disabled');
    return;
  }

  // Initialize feed sources if not already initialized
  const { getAllFeedSources } = await import('./feed-store');
  if (getAllFeedSources().length === 0) {
    console.log('🔧 Initializing feed sources...');
    const { initializeFeedSources } = await import('@/config/feed-sources');
    initializeFeedSources();
  }

  isRunning = true;
  console.log('🚀 Starting automated video scheduler...\n');
  console.log('📊 Configuration:', schedulerConfig);

  // Start feed checking loop
  feedCheckTimer = setInterval(
    () => checkAndProcessFeeds(),
    schedulerConfig.feedCheckInterval * 60 * 1000
  );

  // Start video processing loop
  videoProcessTimer = setInterval(
    () => processVideoQueue(),
    schedulerConfig.videoProcessInterval * 60 * 1000
  );

  // Start video status poller (backup for webhooks)
  const { startVideoPoller } = await import('./video-status-poller');
  startVideoPoller(30000); // Check every 30 seconds

  // Run immediately
  checkAndProcessFeeds();
  processVideoQueue();

  console.log('✅ Scheduler started successfully\n');
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
  if (!isRunning) {
    console.log('⚠️  Scheduler not running');
    return;
  }

  if (feedCheckTimer) clearInterval(feedCheckTimer);
  if (videoProcessTimer) clearInterval(videoProcessTimer);

  isRunning = false;
  console.log('🛑 Scheduler stopped\n');
}

/**
 * Check feeds and process new articles
 */
async function checkAndProcessFeeds() {
  if (!schedulerConfig.enabled || !isRunning) return;

  console.log('\n🔄 [FEED CHECK] Checking for new articles...');

  try {
    const allFeeds = getAllFeedSources();
    const feedsToFetch = getFeedsToFetch(allFeeds);

    if (feedsToFetch.length === 0) {
      console.log('✅ All feeds up to date');
      return;
    }

    console.log(`📥 Fetching ${feedsToFetch.length} feeds...`);

    const result = await processFeedSources(feedsToFetch);

    console.log(`✅ Processed ${result.totalProcessed} feeds`);
    console.log(`📰 Found ${result.totalNewArticles} new articles`);

    if (result.errors.length > 0) {
      console.log(`⚠️  ${result.errors.length} feeds had errors`);
    }

    // Queue articles for video generation
    await queueArticlesForVideo();

  } catch (error) {
    console.error('❌ Error in feed check:', error);
  }
}

/**
 * Queue new articles for video generation (with AI quality filtering)
 */
async function queueArticlesForVideo() {
  const carzArticles = getUnprocessedArticles('carz', 20);
  const ownerfiArticles = getUnprocessedArticles('ownerfi', 20);

  const carzVideosToday = await getVideosGeneratedToday('carz');
  const ownerfiVideosToday = await getVideosGeneratedToday('ownerfi');

  // Queue Carz articles with quality filter
  const carzSlotsLeft = schedulerConfig.maxVideosPerDay.carz - carzVideosToday;
  if (carzSlotsLeft > 0 && carzArticles.length > 0) {
    console.log(`\n🔍 Evaluating ${carzArticles.length} Carz articles...`);
    const queued = await evaluateAndQueueArticles(carzArticles, 'carz', carzSlotsLeft);
    if (queued > 0) {
      console.log(`📋 Queued ${queued} Carz articles (${carzSlotsLeft} slots left today)`);
    }
  }

  // Queue OwnerFi articles with quality filter
  const ownerfiSlotsLeft = schedulerConfig.maxVideosPerDay.ownerfi - ownerfiVideosToday;
  if (ownerfiSlotsLeft > 0 && ownerfiArticles.length > 0) {
    console.log(`\n🔍 Evaluating ${ownerfiArticles.length} OwnerFi articles...`);
    const queued = await evaluateAndQueueArticles(ownerfiArticles, 'ownerfi', ownerfiSlotsLeft);
    if (queued > 0) {
      console.log(`📋 Queued ${queued} OwnerFi articles (${ownerfiSlotsLeft} slots left today)`);
    }
  }
}

/**
 * Evaluate articles with AI and queue the best ones
 * Strategy: Evaluate ALL articles, then pick the TOP N highest-rated ones
 */
async function evaluateAndQueueArticles(
  articles: Article[],
  category: 'carz' | 'ownerfi',
  maxToQueue: number
): Promise<number> {
  const { evaluateArticleQuality } = await import('./article-quality-filter');

  console.log(`  📊 Evaluating ${articles.length} articles to find top ${maxToQueue}...`);

  // Evaluate ALL articles
  const evaluations: Array<{ article: Article; score: number; reasoning: string }> = [];

  for (const article of articles) {
    try {
      const quality = await evaluateArticleQuality(
        article.title,
        article.content || article.description,
        category
      );

      evaluations.push({
        article,
        score: quality.score,
        reasoning: quality.reasoning
      });

      console.log(`  📊 "${article.title.substring(0, 60)}..." - Score: ${quality.score}/100`);
    } catch (error) {
      console.error(`  ❌ Error evaluating article: ${error}`);
      // Mark as processed with error
      markArticleProcessed(article.id, undefined, `Evaluation error: ${error}`);
    }
  }

  // Sort by score (highest first) and take top N
  evaluations.sort((a, b) => b.score - a.score);
  const topArticles = evaluations.slice(0, maxToQueue);

  console.log(`\n  🏆 TOP ${topArticles.length} ARTICLES SELECTED:`);

  // Queue the top articles with position-based scheduling
  let queued = 0;
  for (const { article, score, reasoning } of topArticles) {
    queueArticleForVideo(article, category, score, queued); // Pass position for scheduling
    queued++;
    console.log(`  ✅ #${queued}: "${article.title.substring(0, 60)}..." (Score: ${score}/100)`);
    console.log(`      ${reasoning}`);
  }

  // Mark the rest as processed but rejected
  const rejected = evaluations.slice(maxToQueue);
  for (const { article, score } of rejected) {
    markArticleProcessed(article.id, undefined, `Not in top ${maxToQueue} (score: ${score})`);
  }

  if (rejected.length > 0) {
    console.log(`\n  ❌ ${rejected.length} articles not selected (scores: ${rejected.map(r => r.score).join(', ')})`);
  }

  return queued;
}

// Posting schedule times (hours in 24-hour format)
const POSTING_SCHEDULE = [9, 11, 14, 18, 20]; // 9 AM, 11 AM, 2 PM, 6 PM, 8 PM

/**
 * Get the scheduled time for a video based on its position
 */
function getScheduledTime(position: number): number {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Get the hour for this position (0-4 maps to schedule array)
  const scheduleIndex = position % POSTING_SCHEDULE.length;
  const scheduledHour = POSTING_SCHEDULE[scheduleIndex];

  // Calculate the scheduled date/time
  const scheduledTime = new Date(today);
  scheduledTime.setHours(scheduledHour, 0, 0, 0);

  // If this time has already passed today, schedule for tomorrow
  if (scheduledTime.getTime() < now.getTime()) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  return scheduledTime.getTime();
}

/**
 * Add article to video generation queue with scheduled time
 */
function queueArticleForVideo(article: Article, category: 'carz' | 'ownerfi', qualityScore: number = 50, position: number = 0) {
  const queueId = randomUUID();
  const scheduledTime = getScheduledTime(position);

  const scheduledDate = new Date(scheduledTime);
  console.log(`  📅 Scheduled for: ${scheduledDate.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })}`);

  addToVideoQueue({
    id: queueId,
    articleId: article.id,
    feedId: article.feedId,
    category,
    status: 'pending',
    priority: Math.round(qualityScore), // Use quality score as priority
    scheduledFor: scheduledTime // Schedule for specific time
  });

  // Mark article as queued
  markArticleProcessed(article.id);
}

/**
 * Process pending videos in the queue (only those scheduled for now or earlier)
 */
async function processVideoQueue() {
  if (!schedulerConfig.enabled || !isRunning) return;

  console.log('\n🎬 [VIDEO PROCESS] Processing video queue...');

  try {
    const now = Date.now();
    const allPendingCarz = getPendingQueueItems('carz', 10);
    const allPendingOwnerfi = getPendingQueueItems('ownerfi', 10);

    // Filter for videos scheduled for now or earlier
    const pendingCarz = allPendingCarz.filter(item => {
      if (!item.scheduledFor) return true; // No schedule = process immediately
      return item.scheduledFor <= now;
    });

    const pendingOwnerfi = allPendingOwnerfi.filter(item => {
      if (!item.scheduledFor) return true;
      return item.scheduledFor <= now;
    });

    if (pendingCarz.length === 0 && pendingOwnerfi.length === 0) {
      // Check if there are any scheduled for later
      const upcomingCarz = allPendingCarz.filter(item => item.scheduledFor && item.scheduledFor > now);
      const upcomingOwnerfi = allPendingOwnerfi.filter(item => item.scheduledFor && item.scheduledFor > now);

      if (upcomingCarz.length > 0 || upcomingOwnerfi.length > 0) {
        const nextScheduled = Math.min(
          ...[...upcomingCarz, ...upcomingOwnerfi]
            .map(item => item.scheduledFor!)
            .filter(Boolean)
        );
        const nextTime = new Date(nextScheduled).toLocaleString('en-US', {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        console.log(`⏰ Next video scheduled for: ${nextTime}`);
      } else {
        console.log('✅ No pending videos in queue');
      }
      return;
    }

    console.log(`📋 ${pendingCarz.length} Carz + ${pendingOwnerfi.length} OwnerFi videos ready to process`);

    // Process one from each category (if available)
    const toProcess = [...pendingCarz.slice(0, 1), ...pendingOwnerfi.slice(0, 1)];

    for (const queueItem of toProcess) {
      await processQueueItem(queueItem);
    }

  } catch (error) {
    console.error('❌ Error processing video queue:', error);
  }
}

/**
 * Process a single queue item (generate video)
 */
async function processQueueItem(queueItem: any) {
  console.log(`\n🎥 Processing ${queueItem.category} video: ${queueItem.id.substring(0, 8)}...`);

  try {
    // Update status to processing
    updateQueueItem(queueItem.id, { status: 'processing' });

    // Get article
    const { getArticle } = await import('./feed-store');
    const article = getArticle(queueItem.articleId);

    if (!article) {
      throw new Error('Article not found');
    }

    // Call viral video API
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/workflow/viral-video-webhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          article_content: `${article.title}\n\n${article.content}`,
          auto_generate_script: true,
          talking_photo_id: getAvatarForCategory(queueItem.category),
          voice_id: getVoiceForCategory(queueItem.category),
          scale: 1.4,
          width: 1080,
          height: 1920,
          submagic_template: 'Hormozi 2',
          language: 'en',
          brand: queueItem.category // Pass brand (carz or ownerfi) for Metricool
        })
      },
      TIMEOUTS.WORKFLOW_TTL
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Update queue item with workflow ID
    updateQueueItem(queueItem.id, {
      workflowId: data.workflow_id,
      processedAt: Date.now()
    });

    // Mark article as having video generated
    const { markArticleVideoGenerated } = await import('./feed-store');
    markArticleVideoGenerated(article.id, data.heygen_video_id);

    console.log(`✅ Video generation started: ${data.heygen_video_id}`);
    console.log(`📊 Workflow ID: ${data.workflow_id}`);

  } catch (error) {
    console.error(`❌ Failed to process queue item:`, error);

    // Update queue item with error
    updateQueueItem(queueItem.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get avatar ID for category
 */
function getAvatarForCategory(category: 'carz' | 'ownerfi'): string {
  // You can customize avatars per category
  const avatars = {
    carz: '31c6b2b6306b47a2ba3572a23be09dbc', // Default avatar
    ownerfi: '31c6b2b6306b47a2ba3572a23be09dbc' // Same for now
  };
  return avatars[category];
}

/**
 * Get voice ID for category
 */
function getVoiceForCategory(category: 'carz' | 'ownerfi'): string {
  // You can customize voices per category
  const voices = {
    carz: '9070a6c2dbd54c10bb111dc8c655bff7', // Energetic voice
    ownerfi: '9070a6c2dbd54c10bb111dc8c655bff7' // Same for now
  };
  return voices[category];
}

/**
 * Get number of videos generated today for a category
 */
async function getVideosGeneratedToday(category: 'carz' | 'ownerfi'): Promise<number> {
  const { getArticlesByFeed, getAllFeedSources } = await import('./feed-store');

  const feeds = getAllFeedSources(category);
  const feedIds = feeds.map(f => f.id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  let count = 0;
  for (const feedId of feedIds) {
    const articles = getArticlesByFeed(feedId);
    count += articles.filter(
      a => a.videoGenerated && a.createdAt >= todayTimestamp
    ).length;
  }

  return count;
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  const stats = getStats();

  return {
    running: isRunning,
    config: schedulerConfig,
    stats: {
      carz: getStats('carz'),
      ownerfi: getStats('ownerfi'),
      total: stats
    }
  };
}

/**
 * Update scheduler configuration
 */
export function updateSchedulerConfig(updates: Partial<SchedulerConfig>) {
  schedulerConfig = { ...schedulerConfig, ...updates };
  console.log('⚙️  Scheduler config updated:', schedulerConfig);

  if (updates.enabled !== undefined) {
    if (updates.enabled && !isRunning) {
      startScheduler();
    } else if (!updates.enabled && isRunning) {
      stopScheduler();
    }
  }
}
