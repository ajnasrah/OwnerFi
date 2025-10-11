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
 */
async function evaluateAndQueueArticles(
  articles: Article[],
  category: 'carz' | 'ownerfi',
  maxToQueue: number
): Promise<number> {
  const { evaluateArticleQuality } = await import('./article-quality-filter');

  let queued = 0;

  for (const article of articles) {
    if (queued >= maxToQueue) break;

    // Evaluate article quality
    const quality = await evaluateArticleQuality(
      article.title,
      article.content || article.description,
      category
    );

    console.log(`  📊 "${article.title.substring(0, 60)}..."`);
    console.log(`     Score: ${quality.score}/100 - ${quality.reasoning}`);

    if (quality.shouldMakeVideo) {
      queueArticleForVideo(article, category, quality.score);
      queued++;
      console.log(`     ✅ QUEUED for video`);
    } else {
      // Mark as processed but rejected
      markArticleProcessed(article.id, undefined, `Quality score too low: ${quality.score}`);
      console.log(`     ❌ REJECTED (${quality.redFlags?.join(', ') || 'low quality'})`);
    }
  }

  return queued;
}

/**
 * Add article to video generation queue
 */
function queueArticleForVideo(article: Article, category: 'carz' | 'ownerfi', qualityScore: number = 50) {
  const queueId = randomUUID();

  addToVideoQueue({
    id: queueId,
    articleId: article.id,
    feedId: article.feedId,
    category,
    status: 'pending',
    priority: Math.round(qualityScore) // Use quality score as priority
  });

  // Mark article as queued
  markArticleProcessed(article.id);
}

/**
 * Process pending videos in the queue
 */
async function processVideoQueue() {
  if (!schedulerConfig.enabled || !isRunning) return;

  console.log('\n🎬 [VIDEO PROCESS] Processing video queue...');

  try {
    const pendingCarz = getPendingQueueItems('carz', 1);
    const pendingOwnerfi = getPendingQueueItems('ownerfi', 1);

    if (pendingCarz.length === 0 && pendingOwnerfi.length === 0) {
      console.log('✅ No pending videos in queue');
      return;
    }

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
          language: 'en'
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
