// RSS Feed Data Store
// Manages feed subscriptions, article storage, and video generation queue

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  category: 'carz' | 'ownerfi';
  subcategory: string;
  enabled: boolean;
  fetchInterval: number; // minutes
  lastFetched?: number;
  lastError?: string;
  articlesProcessed: number;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  description: string;
  content: string;
  link: string;
  pubDate: number;
  author?: string;
  categories: string[];
  processed: boolean;
  videoGenerated: boolean;
  videoId?: string;
  workflowId?: string;
  error?: string;
  createdAt: number;
}

export interface VideoGenerationQueue {
  id: string;
  articleId: string;
  feedId: string;
  category: 'carz' | 'ownerfi';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  scheduledFor?: number;
  workflowId?: string;
  videoUrl?: string;
  error?: string;
  createdAt: number;
  processedAt?: number;
}

// In-memory stores (replace with database in production)
const feedSources = new Map<string, FeedSource>();
const articles = new Map<string, Article>();
const videoQueue = new Map<string, VideoGenerationQueue>();

// Feed management
export function addFeedSource(feed: Omit<FeedSource, 'articlesProcessed'>): FeedSource {
  const source: FeedSource = {
    ...feed,
    articlesProcessed: 0
  };
  feedSources.set(feed.id, source);
  console.log(`✅ Added feed source: ${feed.name} (${feed.category})`);
  return source;
}

export function getFeedSource(id: string): FeedSource | undefined {
  return feedSources.get(id);
}

export function getAllFeedSources(category?: 'carz' | 'ownerfi'): FeedSource[] {
  const sources = Array.from(feedSources.values());
  return category ? sources.filter(s => s.category === category) : sources;
}

export function updateFeedSource(id: string, updates: Partial<FeedSource>): FeedSource | undefined {
  const feed = feedSources.get(id);
  if (!feed) return undefined;

  const updated = { ...feed, ...updates };
  feedSources.set(id, updated);
  return updated;
}

export function deleteFeedSource(id: string): boolean {
  return feedSources.delete(id);
}

// Article management
export function addArticle(article: Omit<Article, 'createdAt'>): Article {
  const newArticle: Article = {
    ...article,
    createdAt: Date.now()
  };
  articles.set(article.id, newArticle);
  return newArticle;
}

export function getArticle(id: string): Article | undefined {
  return articles.get(id);
}

export function getArticlesByFeed(feedId: string, limit?: number): Article[] {
  const feedArticles = Array.from(articles.values())
    .filter(a => a.feedId === feedId)
    .sort((a, b) => b.pubDate - a.pubDate);

  return limit ? feedArticles.slice(0, limit) : feedArticles;
}

export function getUnprocessedArticles(category?: 'carz' | 'ownerfi', limit?: number): Article[] {
  let unprocessed = Array.from(articles.values())
    .filter(a => !a.processed);

  if (category) {
    const categoryFeeds = getAllFeedSources(category).map(f => f.id);
    unprocessed = unprocessed.filter(a => categoryFeeds.includes(a.feedId));
  }

  unprocessed.sort((a, b) => b.pubDate - a.pubDate);
  return limit ? unprocessed.slice(0, limit) : unprocessed;
}

export function markArticleProcessed(id: string, workflowId?: string, error?: string): Article | undefined {
  const article = articles.get(id);
  if (!article) return undefined;

  const updated: Article = {
    ...article,
    processed: true,
    workflowId,
    error
  };
  articles.set(id, updated);
  return updated;
}

export function markArticleVideoGenerated(id: string, videoId: string): Article | undefined {
  const article = articles.get(id);
  if (!article) return undefined;

  const updated: Article = {
    ...article,
    videoGenerated: true,
    videoId
  };
  articles.set(id, updated);
  return updated;
}

// Video queue management
export function addToVideoQueue(queueItem: Omit<VideoGenerationQueue, 'createdAt'>): VideoGenerationQueue {
  const item: VideoGenerationQueue = {
    ...queueItem,
    createdAt: Date.now()
  };
  videoQueue.set(item.id, item);
  return item;
}

export function getQueueItem(id: string): VideoGenerationQueue | undefined {
  return videoQueue.get(id);
}

export function getPendingQueueItems(category?: 'carz' | 'ownerfi', limit?: number): VideoGenerationQueue[] {
  let pending = Array.from(videoQueue.values())
    .filter(q => q.status === 'pending')
    .sort((a, b) => {
      // Sort by priority (higher first), then by scheduled time
      if (a.priority !== b.priority) return b.priority - a.priority;
      const aTime = a.scheduledFor || a.createdAt;
      const bTime = b.scheduledFor || b.createdAt;
      return aTime - bTime;
    });

  if (category) {
    pending = pending.filter(q => q.category === category);
  }

  return limit ? pending.slice(0, limit) : pending;
}

export function updateQueueItem(id: string, updates: Partial<VideoGenerationQueue>): VideoGenerationQueue | undefined {
  const item = videoQueue.get(id);
  if (!item) return undefined;

  const updated = { ...item, ...updates };
  videoQueue.set(id, updated);
  return updated;
}

export function deleteQueueItem(id: string): boolean {
  return videoQueue.delete(id);
}

// Statistics
export function getStats(category?: 'carz' | 'ownerfi') {
  const feeds = getAllFeedSources(category);
  const allArticles = category
    ? Array.from(articles.values()).filter(a => feeds.map(f => f.id).includes(a.feedId))
    : Array.from(articles.values());
  const queue = category
    ? Array.from(videoQueue.values()).filter(q => q.category === category)
    : Array.from(videoQueue.values());

  return {
    totalFeeds: feeds.length,
    activeFeeds: feeds.filter(f => f.enabled).length,
    totalArticles: allArticles.length,
    unprocessedArticles: allArticles.filter(a => !a.processed).length,
    videosGenerated: allArticles.filter(a => a.videoGenerated).length,
    queuePending: queue.filter(q => q.status === 'pending').length,
    queueProcessing: queue.filter(q => q.status === 'processing').length,
    queueCompleted: queue.filter(q => q.status === 'completed').length,
    queueFailed: queue.filter(q => q.status === 'failed').length
  };
}

// Check if article already exists (by link or title)
export function articleExists(link: string, title: string): boolean {
  return Array.from(articles.values()).some(
    a => a.link === link || a.title === title
  );
}

// Clean up old articles (keep last 30 days)
export function cleanupOldArticles(daysToKeep: number = 30): number {
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  let deleted = 0;

  for (const [id, article] of articles.entries()) {
    if (article.pubDate < cutoff && article.processed) {
      articles.delete(id);
      deleted++;
    }
  }

  console.log(`🧹 Cleaned up ${deleted} old articles`);
  return deleted;
}

// Reset article processing status (for testing)
export function resetArticleProcessing(articleId?: string): number {
  if (articleId) {
    const article = articles.get(articleId);
    if (article) {
      article.processed = false;
      article.workflowId = undefined;
      articles.set(articleId, article);
      console.log(`✅ Reset processing status for article: ${article.title}`);
      return 1;
    }
    return 0;
  }

  // Reset all articles
  let count = 0;
  for (const [id, article] of articles.entries()) {
    article.processed = false;
    article.videoGenerated = false;
    article.workflowId = undefined;
    article.videoId = undefined;
    article.error = undefined;
    articles.set(id, article);
    count++;
  }

  console.log(`✅ Reset processing status for ${count} articles`);
  return count;
}
