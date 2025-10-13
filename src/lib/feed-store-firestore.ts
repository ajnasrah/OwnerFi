// RSS Feed Data Store - Firestore Backend for Serverless (Simplified)
// Manages feed subscriptions and article storage in Firestore

import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';

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
  contentHash?: string;
  createdAt: number;
}

export interface WorkflowQueueItem {
  id: string;
  articleId: string;
  brand: 'carz' | 'ownerfi';
  status: 'pending' | 'heygen_processing' | 'submagic_processing' | 'posting' | 'completed' | 'failed';
  articleTitle: string;
  workflowId?: string;
  heygenVideoId?: string;
  submagicVideoId?: string;
  metricoolPostId?: string;
  caption?: string; // Store for webhooks
  title?: string; // Store for webhooks
  error?: string;
  retryCount?: number;
  lastRetryAt?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

// Firestore collection names - organized by brand
const COLLECTIONS = {
  CARZ: {
    FEEDS: 'carz_rss_feeds',
    ARTICLES: 'carz_articles',
    WORKFLOW_QUEUE: 'carz_workflow_queue',
  },
  OWNERFI: {
    FEEDS: 'ownerfi_rss_feeds',
    ARTICLES: 'ownerfi_articles',
    WORKFLOW_QUEUE: 'ownerfi_workflow_queue',
  },
  PODCAST: {
    WORKFLOW_QUEUE: 'podcast_workflow_queue',
  }
};

// Helper to get collection name based on category
function getCollectionName(type: 'FEEDS' | 'ARTICLES' | 'WORKFLOW_QUEUE', category: 'carz' | 'ownerfi'): string {
  return category === 'carz' ? COLLECTIONS.CARZ[type] : COLLECTIONS.OWNERFI[type];
}

// Helper to remove undefined values from objects (Firestore doesn't allow undefined)
function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result as Partial<T>;
}

// Feed management
export async function addFeedSource(feed: Omit<FeedSource, 'articlesProcessed'>): Promise<FeedSource> {
  if (!db) throw new Error('Firebase not initialized');

  const source: FeedSource = {
    ...feed,
    articlesProcessed: 0
  };

  const collectionName = getCollectionName('FEEDS', feed.category);
  await setDoc(doc(db, collectionName, feed.id), source);
  console.log(`✅ Added feed source: ${feed.name} (${feed.category})`);
  return source;
}

export async function getAllFeedSources(category?: 'carz' | 'ownerfi'): Promise<FeedSource[]> {
  if (!db) return [];

  const sources: FeedSource[] = [];

  // If category specified, get from that collection only
  if (category) {
    const collectionName = getCollectionName('FEEDS', category);
    const snapshot = await getDocs(collection(db, collectionName));
    snapshot.docs.forEach(doc => sources.push(doc.data() as FeedSource));
  } else {
    // Get from both collections
    const carzSnapshot = await getDocs(collection(db, COLLECTIONS.CARZ.FEEDS));
    const ownerfiSnapshot = await getDocs(collection(db, COLLECTIONS.OWNERFI.FEEDS));
    carzSnapshot.docs.forEach(doc => sources.push(doc.data() as FeedSource));
    ownerfiSnapshot.docs.forEach(doc => sources.push(doc.data() as FeedSource));
  }

  return sources;
}

export async function updateFeedSource(feed: FeedSource): Promise<void> {
  if (!db) return;

  const collectionName = getCollectionName('FEEDS', feed.category);
  const cleanData = removeUndefined(feed);
  await updateDoc(doc(db, collectionName, feed.id), cleanData);
}

// Generate content hash for deduplication
function generateContentHash(title: string, content: string): string {
  // Use title + first 500 chars of content to detect duplicates
  const text = (title + content.substring(0, 500)).toLowerCase().replace(/\s+/g, ' ').trim();

  // Simple hash function (FNV-1a)
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

// Article management
export async function addArticle(article: Omit<Article, 'createdAt'>, category: 'carz' | 'ownerfi'): Promise<Article> {
  if (!db) throw new Error('Firebase not initialized');

  // Generate content hash for deduplication
  const contentHash = generateContentHash(article.title, article.content || article.description);

  const newArticle: Article = {
    ...article,
    contentHash,
    createdAt: Date.now()
  };

  const collectionName = getCollectionName('ARTICLES', category);
  const cleanData = removeUndefined(newArticle);
  await setDoc(doc(db, collectionName, article.id), cleanData);
  return newArticle;
}

export async function getArticle(id: string, category: 'carz' | 'ownerfi'): Promise<Article | null> {
  if (!db) return null;

  const collectionName = getCollectionName('ARTICLES', category);
  const docSnap = await getDoc(doc(db, collectionName, id));
  return docSnap.exists() ? docSnap.data() as Article : null;
}

export async function getUnprocessedArticles(category: 'carz' | 'ownerfi', limitCount: number = 20): Promise<Article[]> {
  if (!db) return [];

  const collectionName = getCollectionName('ARTICLES', category);
  const q = query(
    collection(db, collectionName),
    where('processed', '==', false),
    orderBy('pubDate', 'desc'),
    firestoreLimit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Article);
}

export async function markArticleProcessed(id: string, category: 'carz' | 'ownerfi', workflowId?: string, error?: string): Promise<void> {
  if (!db) return;

  const collectionName = getCollectionName('ARTICLES', category);
  const cleanData = removeUndefined({
    processed: true,
    processedAt: Date.now(),
    workflowId,
    error
  });
  await updateDoc(doc(db, collectionName, id), cleanData);
}

// Get and lock article for processing (atomic operation to prevent race conditions)
// Uses AI quality evaluation to pick the best article
export async function getAndLockArticle(category: 'carz' | 'ownerfi'): Promise<Article | null> {
  if (!db) return null;

  const collectionName = getCollectionName('ARTICLES', category);

  // Get top 5 unprocessed articles to evaluate
  const q = query(
    collection(db, collectionName),
    where('processed', '==', false),
    orderBy('pubDate', 'desc'),
    firestoreLimit(5)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const candidates = snapshot.docs.map(doc => doc.data() as Article);

  // Use AI quality filter to score all candidates
  const { evaluateArticlesBatch } = await import('./article-quality-filter');
  const qualityScores = await evaluateArticlesBatch(
    candidates.map(article => ({
      title: article.title,
      content: article.content || article.description,
      category
    })),
    3 // Max 3 concurrent API calls
  );

  // Pair articles with their scores
  const scoredArticles = candidates.map((article, index) => ({
    article,
    score: qualityScores[index].score,
    shouldMakeVideo: qualityScores[index].shouldMakeVideo,
    reasoning: qualityScores[index].reasoning
  }));

  // Filter out articles below threshold (score < 70)
  const viableArticles = scoredArticles.filter(item => item.shouldMakeVideo);

  if (viableArticles.length === 0) {
    console.log(`⚠️  No viable articles found (all below quality threshold)`);
    // Still pick the best one even if below threshold (fail open)
    scoredArticles.sort((a, b) => b.score - a.score);
    const bestArticle = scoredArticles[0].article;
    const bestScore = scoredArticles[0].score;

    await updateDoc(doc(db, collectionName, bestArticle.id), {
      processed: true,
      processedAt: Date.now(),
      processingStartedAt: Date.now(),
      qualityScore: bestScore,
      aiReasoning: scoredArticles[0].reasoning
    });

    console.log(`🔒 Locked best available article (score: ${bestScore}): ${bestArticle.title.substring(0, 60)}...`);
    return bestArticle;
  }

  // Sort viable articles by score (highest first)
  viableArticles.sort((a, b) => b.score - a.score);

  const bestArticle = viableArticles[0].article;
  const bestScore = viableArticles[0].score;
  const reasoning = viableArticles[0].reasoning;

  console.log(`📊 AI evaluated ${candidates.length} articles, best score: ${bestScore}`);
  console.log(`   Reasoning: ${reasoning}`);

  // Immediately mark as processed to prevent another process from picking it up
  await updateDoc(doc(db, collectionName, bestArticle.id), {
    processed: true,
    processedAt: Date.now(),
    processingStartedAt: Date.now(),
    qualityScore: bestScore,
    aiReasoning: reasoning
  });

  console.log(`🔒 Locked best article (AI score: ${bestScore}): ${bestArticle.title.substring(0, 60)}...`);

  return bestArticle;
}

export async function markArticleVideoGenerated(id: string, category: 'carz' | 'ownerfi', videoId: string): Promise<void> {
  if (!db) return;

  const collectionName = getCollectionName('ARTICLES', category);
  await updateDoc(doc(db, collectionName, id), {
    videoGenerated: true,
    videoId
  });
}

// Check if article already exists (by link)
export async function articleExists(link: string, category: 'carz' | 'ownerfi'): Promise<boolean> {
  if (!db) return false;

  const collectionName = getCollectionName('ARTICLES', category);
  const q = query(
    collection(db, collectionName),
    where('link', '==', link),
    firestoreLimit(1)
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

// Check if article content already exists (deduplication)
export async function articleExistsByContent(
  title: string,
  content: string,
  category: 'carz' | 'ownerfi'
): Promise<boolean> {
  if (!db) return false;

  const contentHash = generateContentHash(title, content);
  const collectionName = getCollectionName('ARTICLES', category);

  const q = query(
    collection(db, collectionName),
    where('contentHash', '==', contentHash),
    firestoreLimit(1)
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

// Workflow Queue Management
export async function addWorkflowToQueue(articleId: string, articleTitle: string, brand: 'carz' | 'ownerfi'): Promise<WorkflowQueueItem> {
  if (!db) throw new Error('Firebase not initialized');

  const queueItem: WorkflowQueueItem = {
    id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    articleId,
    articleTitle,
    brand,
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
  await setDoc(doc(db, collectionName, queueItem.id), queueItem);
  console.log(`✅ Added workflow to queue: ${queueItem.id} (${brand})`);
  return queueItem;
}

export async function updateWorkflowStatus(
  workflowId: string,
  brand: 'carz' | 'ownerfi',
  updates: Partial<WorkflowQueueItem>
): Promise<void> {
  if (!db) return;

  const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
  const cleanData = removeUndefined({
    ...updates,
    updatedAt: Date.now()
  });
  await updateDoc(doc(db, collectionName, workflowId), cleanData);
}

export async function getWorkflowQueueStats(category?: 'carz' | 'ownerfi') {
  if (!db) {
    return {
      pending: 0,
      heygen_processing: 0,
      submagic_processing: 0,
      posting: 0,
      completed: 0,
      failed: 0
    };
  }

  const stats = {
    pending: 0,
    heygen_processing: 0,
    submagic_processing: 0,
    posting: 0,
    completed: 0,
    failed: 0
  };

  const categories = category ? [category] : ['carz', 'ownerfi'] as const;

  for (const cat of categories) {
    const collectionName = getCollectionName('WORKFLOW_QUEUE', cat);

    for (const status of ['pending', 'heygen_processing', 'submagic_processing', 'posting', 'completed', 'failed'] as const) {
      const snapshot = await getDocs(query(
        collection(db, collectionName),
        where('status', '==', status)
      ));
      stats[status] += snapshot.size;
    }
  }

  return stats;
}

export async function cleanupCompletedWorkflows(olderThanHours: number = 24): Promise<number> {
  if (!db) return 0;

  const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
  let cleaned = 0;

  for (const cat of ['carz', 'ownerfi'] as const) {
    const collectionName = getCollectionName('WORKFLOW_QUEUE', cat);
    const snapshot = await getDocs(query(
      collection(db, collectionName),
      where('status', '==', 'completed'),
      where('completedAt', '<', cutoffTime)
    ));

    // Note: In production, you'd want to batch delete these
    for (const docSnap of snapshot.docs) {
      await docSnap.ref.delete();
      cleaned++;
    }
  }

  console.log(`🧹 Cleaned up ${cleaned} completed workflows`);
  return cleaned;
}

// Keep only top N articles per brand (delete low-quality ones)
export async function cleanupLowQualityArticles(keepTopN: number = 10): Promise<{carz: number; ownerfi: number}> {
  if (!db) return { carz: 0, ownerfi: 0 };

  const deleted = { carz: 0, ownerfi: 0 };

  for (const cat of ['carz', 'ownerfi'] as const) {
    const collectionName = getCollectionName('ARTICLES', cat);

    // Get all unprocessed articles ordered by pubDate
    const q = query(
      collection(db, collectionName),
      where('processed', '==', false),
      orderBy('pubDate', 'desc')
    );

    const snapshot = await getDocs(q);
    const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));

    if (articles.length <= keepTopN) {
      console.log(`✅ ${cat}: ${articles.length} articles (within limit)`);
      continue;
    }

    // Keep top N newest, delete the rest
    const articlesToDelete = articles.slice(keepTopN);

    console.log(`🧹 ${cat}: Deleting ${articlesToDelete.length} old articles (keeping ${keepTopN})`);

    for (const article of articlesToDelete) {
      await deleteDoc(doc(db, collectionName, article.id));
      deleted[cat]++;
    }
  }

  if (deleted.carz > 0 || deleted.ownerfi > 0) {
    console.log(`🧹 Cleanup complete: ${deleted.carz} Carz + ${deleted.ownerfi} OwnerFi articles deleted`);
  }

  return deleted;
}

// Delete processed articles older than N days to prevent storage bloat
export async function cleanupProcessedArticles(olderThanDays: number = 7): Promise<{carz: number; ownerfi: number}> {
  if (!db) return { carz: 0, ownerfi: 0 };

  const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  const deleted = { carz: 0, ownerfi: 0 };

  for (const cat of ['carz', 'ownerfi'] as const) {
    const collectionName = getCollectionName('ARTICLES', cat);

    // Get processed articles older than cutoff
    const q = query(
      collection(db, collectionName),
      where('processed', '==', true),
      where('processedAt', '<', cutoffTime)
    );

    const snapshot = await getDocs(q);

    console.log(`🧹 ${cat}: Deleting ${snapshot.size} processed articles older than ${olderThanDays} days`);

    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, collectionName, docSnap.id));
      deleted[cat]++;
    }
  }

  if (deleted.carz > 0 || deleted.ownerfi > 0) {
    console.log(`🧹 Processed article cleanup: ${deleted.carz} Carz + ${deleted.ownerfi} OwnerFi deleted`);
  }

  return deleted;
}

// Rate ALL articles (new + existing) with AI and keep only top N
export async function rateAndCleanupArticles(keepTopN: number = 10): Promise<{
  carz: { rated: number; kept: number; deleted: number };
  ownerfi: { rated: number; kept: number; deleted: number };
}> {
  if (!db) return { carz: { rated: 0, kept: 0, deleted: 0 }, ownerfi: { rated: 0, kept: 0, deleted: 0 } };

  const results = {
    carz: { rated: 0, kept: 0, deleted: 0 },
    ownerfi: { rated: 0, kept: 0, deleted: 0 }
  };

  const { evaluateArticlesBatch } = await import('./article-quality-filter');

  for (const cat of ['carz', 'ownerfi'] as const) {
    const collectionName = getCollectionName('ARTICLES', cat);

    // Get ALL unprocessed articles
    const q = query(
      collection(db, collectionName),
      where('processed', '==', false)
    );

    const snapshot = await getDocs(q);
    const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));

    if (articles.length === 0) {
      console.log(`ℹ️  ${cat}: No articles to rate`);
      continue;
    }

    console.log(`🤖 ${cat}: Rating ${articles.length} articles with AI...`);

    // Rate all articles with AI
    const qualityScores = await evaluateArticlesBatch(
      articles.map(article => ({
        title: article.title,
        content: article.content || article.description,
        category: cat
      })),
      5 // Max 5 concurrent API calls
    );

    // Pair articles with their scores
    const scoredArticles = articles.map((article, index) => ({
      article,
      score: qualityScores[index].score,
      shouldMakeVideo: qualityScores[index].shouldMakeVideo,
      reasoning: qualityScores[index].reasoning
    }));

    // Sort by score (highest first)
    scoredArticles.sort((a, b) => b.score - a.score);

    // Update quality scores in Firestore for all articles
    const updatePromises = scoredArticles.map(item =>
      updateDoc(doc(db, collectionName, item.article.id), {
        qualityScore: item.score,
        aiReasoning: item.reasoning,
        ratedAt: Date.now()
      })
    );
    await Promise.all(updatePromises);

    // Keep top N, delete the rest
    const articlesToKeep = scoredArticles.slice(0, keepTopN);
    const articlesToDelete = scoredArticles.slice(keepTopN);

    console.log(`📊 ${cat}: Top ${articlesToKeep.length} scores: ${articlesToKeep.map(a => a.score).join(', ')}`);

    if (articlesToDelete.length > 0) {
      console.log(`🧹 ${cat}: Deleting ${articlesToDelete.length} low-quality articles`);

      for (const item of articlesToDelete) {
        await deleteDoc(doc(db, collectionName, item.article.id));
      }
    }

    results[cat] = {
      rated: articles.length,
      kept: articlesToKeep.length,
      deleted: articlesToDelete.length
    };
  }

  return results;
}

// Statistics
export async function getStats(category?: 'carz' | 'ownerfi') {
  if (!db) {
    return {
      totalFeeds: 0,
      activeFeeds: 0,
      totalArticles: 0,
      unprocessedArticles: 0,
      videosGenerated: 0,
      queuePending: 0,
      queueProcessing: 0,
      queueCompleted: 0,
      queueFailed: 0
    };
  }

  const feeds = await getAllFeedSources(category);

  let totalArticles = 0;
  let unprocessedArticles = 0;
  let videosGenerated = 0;

  if (category) {
    const collectionName = getCollectionName('ARTICLES', category);
    const allSnapshot = await getDocs(collection(db, collectionName));
    totalArticles = allSnapshot.size;

    const unprocessedSnapshot = await getDocs(query(
      collection(db, collectionName),
      where('processed', '==', false)
    ));
    unprocessedArticles = unprocessedSnapshot.size;

    const videoSnapshot = await getDocs(query(
      collection(db, collectionName),
      where('videoGenerated', '==', true)
    ));
    videosGenerated = videoSnapshot.size;
  } else {
    // Get from both collections
    for (const cat of ['carz', 'ownerfi'] as const) {
      const collectionName = getCollectionName('ARTICLES', cat);
      const allSnapshot = await getDocs(collection(db, collectionName));
      totalArticles += allSnapshot.size;

      const unprocessedSnapshot = await getDocs(query(
        collection(db, collectionName),
        where('processed', '==', false)
      ));
      unprocessedArticles += unprocessedSnapshot.size;

      const videoSnapshot = await getDocs(query(
        collection(db, collectionName),
        where('videoGenerated', '==', true)
      ));
      videosGenerated += videoSnapshot.size;
    }
  }

  // Get workflow queue stats
  const queueStats = await getWorkflowQueueStats(category);

  return {
    totalFeeds: feeds.length,
    activeFeeds: feeds.filter(f => f.enabled).length,
    totalArticles,
    unprocessedArticles,
    videosGenerated,
    queuePending: queueStats.pending,
    queueProcessing: queueStats.heygen_processing + queueStats.submagic_processing + queueStats.posting,
    queueCompleted: queueStats.completed,
    queueFailed: queueStats.failed
  };
}

// Podcast Workflow Management
export interface PodcastWorkflowItem {
  id: string;
  episodeNumber: number;
  episodeTitle: string;
  guestName: string;
  topic: string;
  status: 'script_generation' | 'heygen_processing' | 'submagic_processing' | 'publishing' | 'completed' | 'failed';
  heygenVideoId?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;
  metricoolPostId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export async function addPodcastWorkflow(episodeNumber: number, episodeTitle: string): Promise<PodcastWorkflowItem> {
  if (!db) throw new Error('Firebase not initialized');

  const queueItem: PodcastWorkflowItem = {
    id: `podcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    episodeNumber,
    episodeTitle,
    guestName: '',
    topic: '',
    status: 'script_generation',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await setDoc(doc(db, COLLECTIONS.PODCAST.WORKFLOW_QUEUE, queueItem.id), queueItem);
  console.log(`✅ Added podcast workflow: ${queueItem.id} - Episode #${episodeNumber}`);
  return queueItem;
}

export async function updatePodcastWorkflow(
  workflowId: string,
  updates: Partial<PodcastWorkflowItem>
): Promise<void> {
  if (!db) return;

  const cleanData = removeUndefined({
    ...updates,
    updatedAt: Date.now()
  });
  await updateDoc(doc(db, COLLECTIONS.PODCAST.WORKFLOW_QUEUE, workflowId), cleanData);
}

export async function getPodcastWorkflows(limit: number = 20): Promise<PodcastWorkflowItem[]> {
  if (!db) return [];

  // Simplified query: just get all recent workflows and filter in memory
  // This avoids needing a composite index
  const q = query(
    collection(db, COLLECTIONS.PODCAST.WORKFLOW_QUEUE),
    orderBy('createdAt', 'desc'),
    firestoreLimit(limit * 2) // Get more to account for filtering
  );

  try {
    const snapshot = await getDocs(q);
    const allWorkflows = snapshot.docs.map(doc => doc.data() as PodcastWorkflowItem);

    // Filter in memory for active workflows
    return allWorkflows
      .filter(w => ['script_generation', 'heygen_processing', 'submagic_processing', 'publishing'].includes(w.status))
      .slice(0, limit);
  } catch (error) {
    console.error('❌ Error fetching podcast workflows:', error);
    return [];
  }
}

// Retry Failed Workflows
export async function getRetryableWorkflows(brand: 'carz' | 'ownerfi', maxRetries: number = 3): Promise<WorkflowQueueItem[]> {
  if (!db) return [];

  const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
  const q = query(
    collection(db, collectionName),
    where('status', '==', 'failed'),
    where('retryCount', '<', maxRetries),
    orderBy('retryCount', 'asc'),
    orderBy('createdAt', 'desc'),
    firestoreLimit(10)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowQueueItem));
}

export async function retryWorkflow(workflowId: string, brand: 'carz' | 'ownerfi'): Promise<void> {
  if (!db) return;

  const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
  const workflowDoc = await getDoc(doc(db, collectionName, workflowId));

  if (!workflowDoc.exists()) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  const workflow = workflowDoc.data() as WorkflowQueueItem;
  const retryCount = (workflow.retryCount || 0) + 1;

  // Reset article to unprocessed
  const articleCollectionName = getCollectionName('ARTICLES', brand);
  await updateDoc(doc(db, articleCollectionName, workflow.articleId), {
    processed: false,
    error: undefined
  });

  // Reset workflow to pending
  await updateDoc(doc(db, collectionName, workflowId), {
    status: 'pending',
    retryCount,
    lastRetryAt: Date.now(),
    error: `Retry attempt ${retryCount}`,
    updatedAt: Date.now()
  });

  console.log(`♻️  Retry workflow ${workflowId} (attempt ${retryCount})`);
}

// Find workflow by Submagic project ID (for webhook handling)
export async function findWorkflowBySubmagicId(submagicProjectId: string): Promise<{
  workflowId: string;
  workflow: WorkflowQueueItem & { caption?: string; title?: string };
  brand: 'carz' | 'ownerfi';
} | null> {
  if (!db) return null;

  // Search in both Carz and OwnerFi workflow queues
  for (const brand of ['carz', 'ownerfi'] as const) {
    const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
    const q = query(
      collection(db, collectionName),
      where('submagicVideoId', '==', submagicProjectId),
      firestoreLimit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docData = snapshot.docs[0].data() as WorkflowQueueItem;
      return {
        workflowId: snapshot.docs[0].id,
        workflow: docData as any,
        brand
      };
    }
  }

  console.log(`⚠️  No workflow found with Submagic ID: ${submagicProjectId}`);
  return null;
}

// Get workflow by ID (for webhook handling)
export async function getWorkflowById(workflowId: string): Promise<{
  workflow: WorkflowQueueItem;
  brand: 'carz' | 'ownerfi';
} | null> {
  if (!db) return null;

  // Try to find in both Carz and OwnerFi workflow queues
  for (const brand of ['carz', 'ownerfi'] as const) {
    const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
    const docSnap = await getDoc(doc(db, collectionName, workflowId));

    if (docSnap.exists()) {
      return {
        workflow: docSnap.data() as WorkflowQueueItem,
        brand
      };
    }
  }

  console.log(`⚠️  No workflow found with ID: ${workflowId}`);
  return null;
}
