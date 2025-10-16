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
  qualityScore?: number;      // AI quality rating (0-100)
  aiReasoning?: string;        // AI explanation for rating
  ratedAt?: number;            // Timestamp when rated
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
  latePostId?: string; // Late API post ID (replaced Metricool)
  caption?: string; // Store for webhooks
  title?: string; // Store for webhooks
  scheduledFor?: number; // Timestamp for when post should go live
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
export function getCollectionName(type: 'FEEDS' | 'ARTICLES' | 'WORKFLOW_QUEUE', category: 'carz' | 'ownerfi'): string {
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
// Selects the top-rated article (must be pre-rated with qualityScore)
export async function getAndLockArticle(category: 'carz' | 'ownerfi'): Promise<Article | null> {
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

  // Filter only articles with quality scores and sort
  const ratedArticles = articles
    .filter(a => typeof a.qualityScore === 'number' && a.qualityScore !== undefined)
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

// Smart Scheduling: Get next available time slot for social media posting
// Posting schedule: 9 AM, 11 AM, 2 PM, 6 PM, 8 PM (Eastern Time)
const POSTING_SCHEDULE_HOURS = [9, 11, 14, 18, 20];

export async function getNextAvailableTimeSlot(brand: 'carz' | 'ownerfi'): Promise<Date> {
  if (!db) {
    // Fallback: return current time + 1 minute if DB not available
    return new Date(Date.now() + 60000);
  }

  try {
    // Get current time in Eastern Time
    const now = new Date();
    const nowEastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

    // Start of today at midnight Eastern
    const todayStart = new Date(nowEastern);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = todayStart.getTime();

    // End of today at 11:59:59 PM Eastern
    const todayEnd = new Date(nowEastern);
    todayEnd.setHours(23, 59, 59, 999);
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

    // Build set of taken hours for fast lookup
    const takenHours = new Set<number>();
    scheduledTimestamps.forEach(timestamp => {
      const date = new Date(timestamp);
      const hour = date.getHours();
      takenHours.add(hour);
    });

    console.log(`📅 Scheduling for ${brand.toUpperCase()}: ${takenHours.size} slots taken today (hours: ${Array.from(takenHours).join(', ')})`);

    // Find next available slot
    for (const hour of POSTING_SCHEDULE_HOURS) {
      // Create a date for this slot today
      const slotTime = new Date(todayStart);
      slotTime.setHours(hour, 0, 0, 0);

      // Skip if this slot has already passed
      if (slotTime.getTime() < now.getTime()) {
        continue;
      }

      // Skip if this slot is already taken
      if (takenHours.has(hour)) {
        continue;
      }

      // Found available slot!
      console.log(`✅ Next available slot for ${brand}: ${slotTime.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })}`);
      return slotTime;
    }

    // All slots today are taken or past - schedule for first slot tomorrow
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(POSTING_SCHEDULE_HOURS[0], 0, 0, 0);

    console.log(`⏭️  All slots taken today for ${brand}, scheduling for tomorrow: ${tomorrowStart.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}`);
    return tomorrowStart;

  } catch (error) {
    console.error('❌ Error calculating next time slot:', error);
    // Fallback: return current time + 1 hour
    return new Date(Date.now() + 3600000);
  }
}
