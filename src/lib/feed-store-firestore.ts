// RSS Feed Data Store - Firestore Backend for Serverless (Simplified)
// Manages feed subscriptions and article storage in Firestore

import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { Brand } from '@/config/constants';

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  category: Brand;
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
  qualityScore?: number;      // AI quality rating (0-100)
  aiReasoning?: string;        // AI explanation for rating
  ratedAt?: number;            // Timestamp when rated
  createdAt: number;
}

export interface WorkflowQueueItem {
  id: string;
  articleId: string;
  brand: Brand;
  status: 'pending' | 'heygen_processing' | 'submagic_processing' | 'posting' | 'completed' | 'failed';
  articleTitle: string;
  workflowId?: string;
  heygenVideoId?: string;
  submagicVideoId?: string;
  latePostId?: string; // Late API post ID (replaced Metricool)
  finalVideoUrl?: string; // Completed video URL from R2
  caption?: string; // Store for webhooks
  title?: string; // Store for webhooks
  scheduledFor?: number; // Timestamp for when post should go live
  platforms?: string[]; // Platforms posted to
  error?: string;
  retryCount?: number;
  lastRetryAt?: number;

  // A/B Testing fields
  abTestId?: string; // ID of active A/B test
  abTestVariantId?: string; // Which variant (A, B, C, etc.)
  abTestResultId?: string; // ID of result document for tracking

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
  VASSDISTRO: {
    FEEDS: 'vassdistro_rss_feeds',
    ARTICLES: 'vassdistro_articles',
    WORKFLOW_QUEUE: 'vassdistro_workflow_queue',
  },
  PODCAST: {
    WORKFLOW_QUEUE: 'podcast_workflow_queue',
  },
  BENEFIT: {
    WORKFLOW_QUEUE: 'benefit_workflow_queue',
  }
};

// Helper to get collection name based on category
export function getCollectionName(type: 'FEEDS' | 'ARTICLES' | 'WORKFLOW_QUEUE', category: Brand): string {
  const brandKey = category.toUpperCase();
  const collections = COLLECTIONS[brandKey as keyof typeof COLLECTIONS];
  if (!collections || !(type in collections)) {
    throw new Error(`Collection ${type} not found for brand ${category}`);
  }
  return collections[type as keyof typeof collections] as string;
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

export async function getAllFeedSources(category?: Brand): Promise<FeedSource[]> {
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
export async function addArticle(article: Omit<Article, 'createdAt'>, category: Brand): Promise<Article> {
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

export async function getArticle(id: string, category: Brand): Promise<Article | null> {
  if (!db) return null;

  const collectionName = getCollectionName('ARTICLES', category);
  const docSnap = await getDoc(doc(db, collectionName, id));
  return docSnap.exists() ? docSnap.data() as Article : null;
}

export async function getUnprocessedArticles(category: Brand, limitCount: number = 20): Promise<Article[]> {
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

export async function markArticleProcessed(id: string, category: Brand, workflowId?: string, error?: string): Promise<void> {
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
// Selects the top-rated article (must be pre-rated with qualityScore)
export async function getAndLockArticle(category: Brand): Promise<Article | null> {
  if (!db) return null;

  const collectionName = getCollectionName('ARTICLES', category);

  // Get all unprocessed articles (no orderBy to avoid index requirement)
  const q = query(
    collection(db, collectionName),
    where('processed', '==', false),
    firestoreLimit(50) // Get more to sort in memory
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log(`⚠️  No unprocessed articles available for ${category}`);
    return null;
  }

  // Convert to articles and sort by qualityScore in memory
  const articles = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Article));

  // Filter only high-quality articles (score >= 70) and not too old (max 3 days)
  const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
  const ratedArticles = articles
    .filter(a => {
      // Must have quality score >= 70 (video-worthy threshold)
      if (typeof a.qualityScore !== 'number' || a.qualityScore < 70) {
        return false;
      }
      // Must be recent (published within 3 days)
      if (a.pubDate && a.pubDate < threeDaysAgo) {
        return false;
      }
      return true;
    })
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));

  if (ratedArticles.length === 0) {
    console.log(`⚠️  No rated articles available for ${category}`);
    return null;
  }

  const bestArticle = ratedArticles[0];
  const qualityScore = bestArticle.qualityScore || 0;

  console.log(`🔒 Locked top-rated article (score: ${qualityScore}): ${bestArticle.title.substring(0, 60)}...`);

  // Immediately mark as processed to prevent another process from picking it up
  await updateDoc(doc(db, collectionName, bestArticle.id), {
    processed: true,
    processedAt: Date.now(),
    processingStartedAt: Date.now()
  });

  return bestArticle;
}

export async function markArticleVideoGenerated(id: string, category: Brand, videoId: string): Promise<void> {
  if (!db) return;

  const collectionName = getCollectionName('ARTICLES', category);
  await updateDoc(doc(db, collectionName, id), {
    videoGenerated: true,
    videoId
  });
}

// Check if article already exists (by link)
export async function articleExists(link: string, category: Brand): Promise<boolean> {
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
  category: Brand
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
export async function addWorkflowToQueue(articleId: string, articleTitle: string, brand: Brand): Promise<WorkflowQueueItem> {
  if (!db) throw new Error('Firebase not initialized');

  const queueItem: WorkflowQueueItem = {
    id: `wf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
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
  brand: Brand,
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

export async function getWorkflowQueueStats(category?: Brand) {
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
      await deleteDoc(docSnap.ref);
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
export async function getStats(category?: Brand) {
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
  latePostId?: string; // Late API post ID (replaced Metricool)
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export async function addPodcastWorkflow(episodeNumber: number, episodeTitle: string): Promise<PodcastWorkflowItem> {
  if (!db) throw new Error('Firebase not initialized');

  const queueItem: PodcastWorkflowItem = {
    id: `podcast_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
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
export async function getRetryableWorkflows(brand: Brand, maxRetries: number = 3): Promise<WorkflowQueueItem[]> {
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

export async function retryWorkflow(workflowId: string, brand: Brand): Promise<void> {
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

// Find podcast workflow by Submagic project ID (for webhook handling)
export async function findPodcastBySubmagicId(submagicProjectId: string): Promise<{
  workflowId: string;
  workflow: PodcastWorkflowItem;
} | null> {
  if (!db) return null;

  const q = query(
    collection(db, COLLECTIONS.PODCAST.WORKFLOW_QUEUE),
    where('submagicProjectId', '==', submagicProjectId),
    firestoreLimit(1)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const docData = snapshot.docs[0].data() as PodcastWorkflowItem;
    return {
      workflowId: snapshot.docs[0].id,
      workflow: docData
    };
  }

  console.log(`⚠️  No podcast workflow found with Submagic ID: ${submagicProjectId}`);
  return null;
}

// Get workflow by ID (for webhook handling)
export async function getWorkflowById(workflowId: string): Promise<{
  workflow: WorkflowQueueItem;
  brand: Brand;
} | null> {
  if (!db) return null;

  // Try to find in all brand workflow queues
  for (const brand of ['carz', 'ownerfi', 'vassdistro'] as const) {
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

// Get podcast workflow by ID (for webhook handling)
export async function getPodcastWorkflowById(workflowId: string): Promise<PodcastWorkflowItem | null> {
  if (!db) return null;

  const docSnap = await getDoc(doc(db, COLLECTIONS.PODCAST.WORKFLOW_QUEUE, workflowId));

  if (docSnap.exists()) {
    return docSnap.data() as PodcastWorkflowItem;
  }

  console.log(`⚠️  No podcast workflow found with ID: ${workflowId}`);
  return null;
}

// ====== BENEFIT VIDEO WORKFLOW MANAGEMENT ======

export interface BenefitWorkflowItem {
  id: string;
  benefitId: string;
  audience: 'seller' | 'buyer';
  benefitTitle: string;
  status: 'heygen_processing' | 'submagic_processing' | 'posting' | 'completed' | 'failed';
  heygenVideoId?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;
  latePostId?: string; // Late API post ID
  caption?: string;
  title?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export async function addBenefitWorkflow(
  benefitId: string,
  audience: 'seller' | 'buyer',
  benefitTitle: string
): Promise<BenefitWorkflowItem> {
  if (!db) throw new Error('Firebase not initialized');

  const queueItem: BenefitWorkflowItem = {
    id: `benefit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    benefitId,
    audience,
    benefitTitle,
    status: 'heygen_processing',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await setDoc(doc(db, COLLECTIONS.BENEFIT.WORKFLOW_QUEUE, queueItem.id), queueItem);
  console.log(`✅ Added benefit workflow: ${queueItem.id} - ${benefitTitle} (${audience})`);
  return queueItem;
}

export async function updateBenefitWorkflow(
  workflowId: string,
  updates: Partial<BenefitWorkflowItem>
): Promise<void> {
  if (!db) return;

  const cleanData = removeUndefined({
    ...updates,
    updatedAt: Date.now()
  });
  await updateDoc(doc(db, COLLECTIONS.BENEFIT.WORKFLOW_QUEUE, workflowId), cleanData);
}

export async function getBenefitWorkflowById(workflowId: string): Promise<BenefitWorkflowItem | null> {
  if (!db) return null;

  const docSnap = await getDoc(doc(db, COLLECTIONS.BENEFIT.WORKFLOW_QUEUE, workflowId));

  if (docSnap.exists()) {
    return docSnap.data() as BenefitWorkflowItem;
  }

  console.log(`⚠️  No benefit workflow found with ID: ${workflowId}`);
  return null;
}

// Find benefit workflow by Submagic project ID (for webhook handling)
export async function findBenefitBySubmagicId(submagicProjectId: string): Promise<{
  workflowId: string;
  workflow: BenefitWorkflowItem;
} | null> {
  if (!db) return null;

  const q = query(
    collection(db, COLLECTIONS.BENEFIT.WORKFLOW_QUEUE),
    where('submagicProjectId', '==', submagicProjectId),
    firestoreLimit(1)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const docData = snapshot.docs[0].data() as BenefitWorkflowItem;
    return {
      workflowId: snapshot.docs[0].id,
      workflow: docData
    };
  }

  console.log(`⚠️  No benefit workflow found with Submagic ID: ${submagicProjectId}`);
  return null;
}

// Find benefit workflow by HeyGen callback ID (for webhook handling)
export async function findBenefitByHeyGenId(heygenVideoId: string): Promise<{
  workflowId: string;
  workflow: BenefitWorkflowItem;
} | null> {
  if (!db) return null;

  const q = query(
    collection(db, COLLECTIONS.BENEFIT.WORKFLOW_QUEUE),
    where('heygenVideoId', '==', heygenVideoId),
    firestoreLimit(1)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const docData = snapshot.docs[0].data() as BenefitWorkflowItem;
    return {
      workflowId: snapshot.docs[0].id,
      workflow: docData
    };
  }

  console.log(`⚠️  No benefit workflow found with HeyGen ID: ${heygenVideoId}`);
  return null;
}

// Find workflow by callback_id (used by HeyGen webhook)
// This searches across all workflow types (articles, podcasts, benefits)
export async function findWorkflowByCallbackId(callbackId: string): Promise<{
  workflowId: string;
  workflow: any;
  type: 'article' | 'podcast' | 'benefit';
  brand?: Brand;
} | null> {
  if (!db) return null;

  // Check benefit workflows first (callback_id is the workflow id)
  const benefitWorkflow = await getBenefitWorkflowById(callbackId);
  if (benefitWorkflow) {
    return {
      workflowId: callbackId,
      workflow: benefitWorkflow,
      type: 'benefit'
    };
  }

  // Check podcast workflows
  const podcastWorkflow = await getPodcastWorkflowById(callbackId);
  if (podcastWorkflow) {
    return {
      workflowId: callbackId,
      workflow: podcastWorkflow,
      type: 'podcast'
    };
  }

  // Check article workflows (carz and ownerfi)
  for (const brand of ['carz', 'ownerfi'] as const) {
    const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
    const docSnap = await getDoc(doc(db, collectionName, callbackId));

    if (docSnap.exists()) {
      return {
        workflowId: callbackId,
        workflow: docSnap.data() as WorkflowQueueItem,
        type: 'article',
        brand
      };
    }
  }

  console.log(`⚠️  No workflow found with callback ID: ${callbackId}`);
  return null;
}

// Smart Scheduling: Get next available time slot for social media posting
// Posting schedule: 9 AM, 12 PM, 3 PM, 6 PM, 9 PM (Central Daylight Time)
// No posts before 9am or after 10pm CDT per user requirements
// Optimized for cross-platform engagement (Instagram, TikTok, YouTube, LinkedIn, Twitter, Facebook)
const POSTING_SCHEDULE_HOURS = [9, 12, 15, 18, 21]; // 9am, 12pm, 3pm, 6pm, 9pm CDT

/**
 * Helper: Convert Central Time to proper UTC Date object
 * This ensures that when we call .toISOString(), it returns the correct UTC time
 */
function createCentralTimeAsUTC(year: number, month: number, day: number, hour: number): Date {
  // Determine if we're in CDT (UTC-5) or CST (UTC-6) for this date
  // Create a test date at noon on the target day
  const testDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const centralHourStr = testDate.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    hour12: false
  });
  const centralHour = parseInt(centralHourStr);

  // Calculate offset: 12 UTC - centralHour = offset in hours
  // CDT: 12 UTC = 7 AM Central (offset = 5)
  // CST: 12 UTC = 6 AM Central (offset = 6)
  const offsetHours = 12 - centralHour;

  // Create UTC date for the desired Central Time hour
  // If we want 9 AM Central and offset is 5 (CDT), then UTC time is 9 + 5 = 14:00 UTC
  return new Date(Date.UTC(year, month, day, hour + offsetHours, 0, 0));
}

export async function getNextAvailableTimeSlot(brand: Brand): Promise<Date> {
  if (!db) {
    // Fallback: return current time + 1 minute if DB not available
    return new Date(Date.now() + 60000);
  }

  try {
    // Get current date components in Central Time
    const now = new Date();
    const centralYear = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Chicago', year: 'numeric' }));
    const centralMonth = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'numeric' })) - 1;
    const centralDay = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Chicago', day: 'numeric' }));

    // Start of today at midnight Central (converted to UTC)
    const todayStart = createCentralTimeAsUTC(centralYear, centralMonth, centralDay, 0);
    const todayStartTimestamp = todayStart.getTime();

    // End of today at 11:59:59 PM Central (converted to UTC)
    const todayEnd = createCentralTimeAsUTC(centralYear, centralMonth, centralDay, 23);
    todayEnd.setUTCMinutes(59);
    todayEnd.setUTCSeconds(59);
    todayEnd.setUTCMilliseconds(999);
    const todayEndTimestamp = todayEnd.getTime();

    // Query Firestore for all workflows scheduled for today (for this brand)
    const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
    const q = query(
      collection(db, collectionName),
      where('scheduledFor', '>=', todayStartTimestamp),
      where('scheduledFor', '<=', todayEndTimestamp)
    );

    const snapshot = await getDocs(q);
    const scheduledTimestamps = snapshot.docs
      .map(doc => doc.data().scheduledFor)
      .filter(ts => typeof ts === 'number') as number[];

    // Build set of taken hours (in Central Time) for fast lookup
    const takenHours = new Set<number>();
    scheduledTimestamps.forEach(timestamp => {
      const date = new Date(timestamp);
      // Get the hour in Central Time for this timestamp
      const centralHourStr = date.toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        hour12: false
      });
      const centralHour = parseInt(centralHourStr);
      takenHours.add(centralHour);
    });

    console.log(`📅 Scheduling for ${brand.toUpperCase()}: ${takenHours.size} slots taken today (hours: ${Array.from(takenHours).join(', ')} CDT)`);

    // Find next available slot
    for (const hour of POSTING_SCHEDULE_HOURS) {
      // Create a proper UTC date for this Central Time slot
      const slotTime = createCentralTimeAsUTC(centralYear, centralMonth, centralDay, hour);

      // Skip if this slot has already passed
      if (slotTime.getTime() < now.getTime()) {
        continue;
      }

      // Skip if this slot is already taken
      if (takenHours.has(hour)) {
        continue;
      }

      // Found available slot!
      console.log(`✅ Next available slot for ${brand}: ${slotTime.toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true })} CDT (UTC: ${slotTime.toISOString()})`);
      return slotTime;
    }

    // All slots today are taken or past - schedule for first slot tomorrow
    const tomorrowYear = centralYear;
    let tomorrowMonth = centralMonth;
    let tomorrowDay = centralDay + 1;

    // Handle month/year rollover
    const daysInMonth = new Date(tomorrowYear, tomorrowMonth + 1, 0).getDate();
    if (tomorrowDay > daysInMonth) {
      tomorrowDay = 1;
      tomorrowMonth += 1;
      if (tomorrowMonth > 11) {
        tomorrowMonth = 0;
      }
    }

    const tomorrowSlot = createCentralTimeAsUTC(tomorrowYear, tomorrowMonth, tomorrowDay, POSTING_SCHEDULE_HOURS[0]);

    console.log(`⏭️  All slots taken today for ${brand}, scheduling for tomorrow: ${tomorrowSlot.toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })} CDT (UTC: ${tomorrowSlot.toISOString()})`);
    return tomorrowSlot;

  } catch (error) {
    console.error('❌ Error calculating next time slot:', error);
    // Fallback: return current time + 1 hour
    return new Date(Date.now() + 3600000);
  }
}

// ====== PODCAST GUEST PROFILE MANAGEMENT ======

export interface GuestProfile {
  id: string;
  name: string;
  title: string;
  expertise: string;
  avatar_type: 'avatar' | 'talking_photo';
  avatar_id: string;
  voice_id: string;
  scale: number;
  description: string;
  question_topics: string[];
  tone: string;
  background_color: string;
  enabled: boolean;
  _note?: string;
}

export interface HostProfile {
  name: string;
  avatar_type: 'avatar' | 'talking_photo';
  avatar_id: string;
  voice_id: string;
  scale: number;
  background_color: string;
  description: string;
}

export interface VideoSettings {
  dimension: {
    width: number;
    height: number;
  };
  questions_per_episode: number;
  scene_count: number;
  target_duration_minutes: number;
}

export interface PodcastConfig {
  profiles: { [key: string]: GuestProfile };
  host: HostProfile;
  video_settings: VideoSettings;
}

// Get podcast configuration from Firestore
export async function getPodcastConfig(): Promise<PodcastConfig | null> {
  if (!db) return null;

  try {
    const configDoc = await getDoc(doc(db, 'podcast_config', 'main'));
    if (configDoc.exists()) {
      return configDoc.data() as PodcastConfig;
    }
    return null;
  } catch (error) {
    console.error('❌ Error fetching podcast config:', error);
    return null;
  }
}

// Get all guest profiles
export async function getGuestProfiles(): Promise<{ [key: string]: GuestProfile }> {
  const config = await getPodcastConfig();
  return config?.profiles || {};
}

// Get enabled guest profiles only
export async function getEnabledGuestProfiles(): Promise<GuestProfile[]> {
  const profiles = await getGuestProfiles();
  return Object.values(profiles).filter(profile => profile.enabled !== false);
}

// Get specific guest profile
export async function getGuestProfile(guestId: string): Promise<GuestProfile | null> {
  const profiles = await getGuestProfiles();
  return profiles[guestId] || null;
}

// Update guest profile
export async function updateGuestProfile(guestId: string, updates: Partial<GuestProfile>): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  try {
    const config = await getPodcastConfig();
    if (!config) throw new Error('Podcast config not found');

    // Update the specific profile
    config.profiles[guestId] = {
      ...config.profiles[guestId],
      ...removeUndefined(updates)
    };

    // Save back to Firestore
    await updateDoc(doc(db, 'podcast_config', 'main'), {
      [`profiles.${guestId}`]: config.profiles[guestId]
    });

    console.log(`✅ Updated guest profile: ${guestId}`);
  } catch (error) {
    console.error(`❌ Error updating guest profile ${guestId}:`, error);
    throw error;
  }
}

// Update host profile
export async function updateHostProfile(updates: Partial<HostProfile>): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  try {
    const config = await getPodcastConfig();
    if (!config) throw new Error('Podcast config not found');

    const cleanUpdates = removeUndefined(updates);
    const updatedHost = {
      ...config.host,
      ...cleanUpdates
    };

    await updateDoc(doc(db, 'podcast_config', 'main'), {
      host: updatedHost
    });

    console.log('✅ Updated host profile');
  } catch (error) {
    console.error('❌ Error updating host profile:', error);
    throw error;
  }
}

// Get host profile
export async function getHostProfile(): Promise<HostProfile | null> {
  const config = await getPodcastConfig();
  return config?.host || null;
}

// ============================================================================
// PROPERTY VIDEO ROTATION QUEUE FUNCTIONS
// ============================================================================

export interface PropertyRotationQueue {
  id: string;                      // Same as propertyId
  propertyId: string;

  // Quick display info
  address: string;
  city: string;
  state: string;
  downPayment: number;
  imageUrl: string;

  // Queue position
  position: number;                // Lower = processes sooner
  lastVideoGenerated?: number;     // Timestamp of last video
  videoCount: number;              // Total times showcased (across all cycles)
  currentCycleCount: number;       // Times shown in current cycle

  // Status
  status: 'queued' | 'processing' | 'completed'; // Completed = done this cycle
  updatedAt: number;
}

/**
 * Add property to rotation queue
 */
export async function addToPropertyRotationQueue(propertyId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  // Check if already in queue
  const existing = await getDoc(doc(db, 'property_rotation_queue', propertyId));
  if (existing.exists()) {
    console.log(`Property ${propertyId} already in rotation queue`);
    return;
  }

  // Get property data
  const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
  if (!propertyDoc.exists()) {
    throw new Error(`Property ${propertyId} not found`);
  }

  const property = propertyDoc.data() as any;

  // Get current max position
  const maxQuery = query(
    collection(db, 'property_rotation_queue'),
    orderBy('position', 'desc'),
    firestoreLimit(1)
  );
  const maxSnapshot = await getDocs(maxQuery);
  const maxPosition = maxSnapshot.empty ? 0 : maxSnapshot.docs[0].data().position;

  // Add to queue
  const queueItem: PropertyRotationQueue = {
    id: propertyId,
    propertyId,
    address: property.address || 'Unknown Address',
    city: property.city || 'Unknown City',
    state: property.state || 'Unknown',
    downPayment: property.downPaymentAmount || 0,
    imageUrl: property.imageUrls?.[0] || '',
    position: maxPosition + 1,
    videoCount: 0,
    currentCycleCount: 0,
    status: 'queued',
    updatedAt: Date.now()
  };

  await setDoc(doc(db, 'property_rotation_queue', propertyId), queueItem);
  console.log(`✅ Added to rotation queue: ${property.address} (position ${maxPosition + 1})`);
}

/**
 * Get next property from rotation queue
 */
export async function getNextPropertyFromRotation(): Promise<PropertyRotationQueue | null> {
  if (!db) return null;

  const q = query(
    collection(db, 'property_rotation_queue'),
    where('status', '==', 'queued'),
    orderBy('position', 'asc'),
    firestoreLimit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const queueItem = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PropertyRotationQueue;

  // Mark as processing
  await updateDoc(doc(db, 'property_rotation_queue', queueItem.id), {
    status: 'processing',
    updatedAt: Date.now()
  });

  return queueItem;
}

/**
 * Mark property as completed (done for this cycle)
 */
export async function markPropertyCompleted(propertyId: string): Promise<void> {
  if (!db) return;

  // Get current item data
  const currentDoc = await getDoc(doc(db, 'property_rotation_queue', propertyId));
  const currentData = currentDoc.data();

  // Mark as completed (will be reset when cycle refreshes)
  await updateDoc(doc(db, 'property_rotation_queue', propertyId), {
    status: 'completed',
    lastVideoGenerated: Date.now(),
    videoCount: (currentData?.videoCount || 0) + 1,
    currentCycleCount: (currentData?.currentCycleCount || 0) + 1,
    updatedAt: Date.now()
  });

  console.log(`✅ Property ${propertyId} marked as completed for this cycle`);
}

/**
 * Reset queue for new cycle (all properties back to queued)
 */
export async function resetPropertyQueueCycle(): Promise<number> {
  if (!db) return 0;

  // Get all completed properties
  const completedQuery = query(
    collection(db, 'property_rotation_queue'),
    where('status', '==', 'completed')
  );

  const snapshot = await getDocs(completedQuery);

  if (snapshot.empty) {
    console.log('No completed properties to reset');
    return 0;
  }

  console.log(`🔄 Resetting ${snapshot.size} properties for new cycle...`);

  // Reset all to queued with fresh positions
  let position = 1;
  for (const docSnap of snapshot.docs) {
    await updateDoc(doc(db, 'property_rotation_queue', docSnap.id), {
      status: 'queued',
      position: position++,
      currentCycleCount: 0, // Reset cycle count
      updatedAt: Date.now()
    });
  }

  console.log(`✅ Queue reset complete - ${snapshot.size} properties ready for new cycle`);
  return snapshot.size;
}

/**
 * Get rotation queue stats
 */
export async function getPropertyRotationStats(): Promise<{
  total: number;
  queued: number;
  processing: number;
  nextProperty?: PropertyRotationQueue;
}> {
  if (!db) return { total: 0, queued: 0, processing: 0 };

  const allSnapshot = await getDocs(collection(db, 'property_rotation_queue'));
  const queuedSnapshot = await getDocs(query(
    collection(db, 'property_rotation_queue'),
    where('status', '==', 'queued')
  ));
  const processingSnapshot = await getDocs(query(
    collection(db, 'property_rotation_queue'),
    where('status', '==', 'processing')
  ));

  // Get next property
  const nextQuery = query(
    collection(db, 'property_rotation_queue'),
    where('status', '==', 'queued'),
    orderBy('position', 'asc'),
    firestoreLimit(1)
  );
  const nextSnapshot = await getDocs(nextQuery);
  const nextProperty = nextSnapshot.empty ? undefined : nextSnapshot.docs[0].data() as PropertyRotationQueue;

  return {
    total: allSnapshot.size,
    queued: queuedSnapshot.size,
    processing: processingSnapshot.size,
    nextProperty
  };
}

// ============================================================================
// PROPERTY VIDEO WORKFLOW FUNCTIONS
// ============================================================================

/**
 * Update property video workflow
 */
export async function updatePropertyVideo(
  workflowId: string,
  updates: Record<string, any>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  await updateDoc(doc(db, 'property_videos', workflowId), {
    ...updates,
    updatedAt: Date.now()
  });
}

/**
 * Find property video by Submagic project ID
 */
export async function findPropertyVideoBySubmagicId(submagicProjectId: string): Promise<{
  workflowId: string;
  workflow: any;
} | null> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, 'property_videos'),
    where('submagicProjectId', '==', submagicProjectId),
    firestoreLimit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];
  return {
    workflowId: docSnap.id,
    workflow: docSnap.data()
  };
}
