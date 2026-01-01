// RSS Feed Data Store - Firestore Backend for Serverless (Simplified)
// Manages feed subscriptions and article storage in Firestore

import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit as firestoreLimit, runTransaction } from 'firebase/firestore';
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
  videoIndex?: number; // Which post of the day this is (0-4 for 5 posts/day)
  error?: string;
  retryCount?: number;
  lastRetryAt?: number;

  // A/B Testing fields
  abTestId?: string; // ID of active A/B test
  abTestVariantId?: string; // Which variant (A, B, C, etc.)
  abTestResultId?: string; // ID of result document for tracking

  createdAt: number;
  updatedAt: number; // Updates when meaningful progress happens (video received, etc)
  statusChangedAt?: number; // When status last changed (for tracking stuck workflows)
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
  },
  ABDULLAH: {
    CONTENT: 'abdullah_daily_content',
    WORKFLOW_QUEUE: 'abdullah_workflow_queue',
  },
  GAZA: {
    FEEDS: 'gaza_rss_feeds',
    ARTICLES: 'gaza_articles',
    WORKFLOW_QUEUE: 'gaza_workflow_queue',
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
function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
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
    // Get from all collections
    const carzSnapshot = await getDocs(collection(db, COLLECTIONS.CARZ.FEEDS));
    const ownerfiSnapshot = await getDocs(collection(db, COLLECTIONS.OWNERFI.FEEDS));
    const vassdistroSnapshot = await getDocs(collection(db, COLLECTIONS.VASSDISTRO.FEEDS));
    const gazaSnapshot = await getDocs(collection(db, COLLECTIONS.GAZA.FEEDS));
    carzSnapshot.docs.forEach(doc => sources.push(doc.data() as FeedSource));
    ownerfiSnapshot.docs.forEach(doc => sources.push(doc.data() as FeedSource));
    vassdistroSnapshot.docs.forEach(doc => sources.push(doc.data() as FeedSource));
    gazaSnapshot.docs.forEach(doc => sources.push(doc.data() as FeedSource));
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
// PRIORITY ORDER:
// 1. Social trends (TikTok, Twitter, Reddit, Google Trends) - what's viral RIGHT NOW
// 2. High quality RSS articles (qualityScore >= 30)
// Uses Firestore transactions to ensure only one process can lock each article
export async function getAndLockArticle(category: Brand): Promise<Article | null> {
  if (!db) return null;

  const collectionName = getCollectionName('ARTICLES', category);

  // Get all unprocessed articles (no orderBy to avoid index requirement)
  const q = query(
    collection(db, collectionName),
    where('processed', '==', false),
    firestoreLimit(100) // Get more to have good selection
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log(`⚠️  No unprocessed articles available for ${category}`);
    console.log(`   Collection: ${collectionName}`);
    return null;
  }

  // Convert to articles
  const articles = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }) as Article & { source?: string; engagementScore?: number; platform?: string; velocity?: string });

  // Separate social trends from RSS articles
  const socialTrends = articles.filter(a => a.source === 'social_trends');
  const rssArticles = articles.filter(a => a.source !== 'social_trends');

  console.log(`📊 [${category}] Found ${articles.length} unprocessed articles`);
  console.log(`   🔥 Social trends: ${socialTrends.length}`);
  console.log(`   📰 RSS articles: ${rssArticles.length}`);

  // PRIORITY 1: Social trends (sorted by engagement score)
  // These are ALREADY proven viral - use them first!
  const sortedSocialTrends = socialTrends
    .filter(a => {
      // Social trends from last 48 hours only (they're time-sensitive)
      const hoursOld = (Date.now() - (a.pubDate || a.createdAt)) / (1000 * 60 * 60);
      return hoursOld < 48;
    })
    .sort((a, b) => (b.engagementScore || 0) - (a.engagementScore || 0));

  if (sortedSocialTrends.length > 0) {
    console.log(`🔥 [${category}] Prioritizing ${sortedSocialTrends.length} social trends!`);
    console.log(`   Top trend: [${sortedSocialTrends[0].platform}] ${sortedSocialTrends[0].title?.substring(0, 50)}...`);
  }

  // PRIORITY 2: High quality RSS articles (fallback)
  // Lowered from 50 to 30 to ensure articles get processed
  const threshold = 30;
  const sortedRssArticles = rssArticles
    .filter(a => typeof a.qualityScore === 'number' && a.qualityScore >= threshold)
    .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));

  // Combine: social trends first, then RSS
  const prioritizedArticles = [...sortedSocialTrends, ...sortedRssArticles];

  console.log(`✅ [${category}] Total eligible: ${prioritizedArticles.length} (${sortedSocialTrends.length} trends + ${sortedRssArticles.length} RSS)`);

  if (prioritizedArticles.length === 0) {
    console.log(`⚠️  No eligible articles available for ${category}`);
    console.log(`   Reasons:`);
    console.log(`     - Social trends (< 48hrs old): ${sortedSocialTrends.length}`);
    console.log(`     - RSS with score >= ${threshold}: ${sortedRssArticles.length}`);
    console.log(`     - Total unprocessed: ${articles.length}`);
    return null;
  }

  // Try to lock articles in order (social trends first, then highest quality RSS)
  // Use transaction to ensure atomic read-write (prevents race conditions)
  for (const candidate of prioritizedArticles) {
    try {
      // ✅ ATOMIC OPERATION: Read + Write in single transaction
      // This ensures only ONE process can lock each article, even if multiple processes
      // are trying to lock at the exact same time
      const lockedArticle = await runTransaction(db, async (transaction) => {
        const articleRef = doc(db, collectionName, candidate.id);
        const freshDoc = await transaction.get(articleRef);

        // Check if article still exists and is still unprocessed
        // (another process might have locked it between our initial query and now)
        if (!freshDoc.exists()) {
          throw new Error('Article no longer exists');
        }

        const freshData = freshDoc.data();
        if (freshData.processed === true) {
          throw new Error('Article already locked by another process');
        }

        // Lock it atomically - transaction ensures this write only happens
        // if no other process has modified the document since we read it
        transaction.update(articleRef, {
          processed: true,
          processedAt: Date.now(),
          processingStartedAt: Date.now()
        });

        return {
          id: freshDoc.id,
          ...freshData
        } as Article;
      });

      // Log what type of content we locked
      const articleData = lockedArticle as Article & { source?: string; platform?: string; engagementScore?: number };
      const isSocialTrend = articleData.source === 'social_trends';
      const platform = articleData.platform || 'rss';
      const score = isSocialTrend
        ? articleData.engagementScore || 0
        : lockedArticle.qualityScore || 0;

      if (isSocialTrend) {
        console.log(`🔥 Locked SOCIAL TREND [${platform}] (engagement: ${score}): ${lockedArticle.title.substring(0, 60)}...`);
      } else {
        console.log(`📰 Locked RSS article (quality: ${score}): ${lockedArticle.title.substring(0, 60)}...`);
      }
      return lockedArticle;

    } catch (error) {
      // Article was already locked by another process, try next one in the list
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`⚠️  Could not lock article "${candidate.title.substring(0, 40)}..." (${errorMessage}), trying next...`);
      continue;
    }
  }

  // All high-quality articles were already locked by other processes
  console.log(`⚠️  All high-quality articles already locked for ${category}`);
  return null;
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

/**
 * Get workflows created today for a brand
 * Used to determine videoIndex (which post of the day this is)
 */
export async function getWorkflowsCreatedToday(brand: Brand): Promise<WorkflowQueueItem[]> {
  if (!db) throw new Error('Firebase not initialized');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartTimestamp = todayStart.getTime();

  const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
  const querySnapshot = await getDocs(
    query(
      collection(db, collectionName),
      where('createdAt', '>=', todayStartTimestamp),
      orderBy('createdAt', 'asc')
    )
  );

  return querySnapshot.docs.map(doc => doc.data() as WorkflowQueueItem);
}

/**
 * Add a workflow to the queue with ATOMIC deduplication.
 *
 * CRITICAL: Uses Firestore transaction to atomically check for existing workflow
 * AND create new one. This prevents race conditions where two processes both
 * pass the deduplication check and create duplicate workflows.
 *
 * @returns The workflow item (newly created)
 * @throws Error if a duplicate workflow exists (non-failed status)
 */
export async function addWorkflowToQueue(
  articleId: string,
  articleTitle: string,
  brand: Brand,
  videoIndex?: number
): Promise<WorkflowQueueItem> {
  if (!db) throw new Error('Firebase not initialized');

  const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

  // Generate workflow ID upfront so we can use it in transaction
  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // Use a dedicated deduplication document to ensure atomicity
  // Key is based on articleId + date to allow same article after 24h
  const dedupKey = `dedup_${articleId}_${new Date().toISOString().split('T')[0]}`;
  const dedupRef = doc(db, collectionName, dedupKey);
  const workflowRef = doc(db, collectionName, workflowId);

  try {
    const queueItem = await runTransaction(db, async (transaction) => {
      // Check deduplication document
      const dedupDoc = await transaction.get(dedupRef);

      if (dedupDoc.exists()) {
        const dedupData = dedupDoc.data();
        const existingWorkflowId = dedupData.workflowId;
        const existingStatus = dedupData.status;
        const createdAt = dedupData.createdAt;

        // Only block if within 24 hours AND not failed
        if (createdAt >= twentyFourHoursAgo && existingStatus !== 'failed') {
          throw new Error(`Duplicate workflow blocked: Article ${articleId} already has workflow ${existingWorkflowId} (status: ${existingStatus})`);
        }

        // If failed or older than 24h, allow retry
        console.log(`♻️  Previous workflow for article ${articleId} was ${existingStatus}, allowing retry`);
      }

      const now = Date.now();
      const item: WorkflowQueueItem = {
        id: workflowId,
        articleId,
        articleTitle,
        brand,
        status: 'pending',
        retryCount: 0,
        createdAt: now,
        updatedAt: now,
        ...(videoIndex !== undefined && { videoIndex }),
      };

      // Create/update deduplication document (tracks latest workflow for this articleId)
      transaction.set(dedupRef, {
        articleId,
        workflowId,
        status: 'pending',
        createdAt: now,
      });

      // Create workflow document
      transaction.set(workflowRef, item);

      return item;
    });

    console.log(`✅ Added workflow to queue: ${queueItem.id} (${brand}, videoIndex: ${videoIndex})`);
    return queueItem;

  } catch (error) {
    if (error instanceof Error && error.message.includes('Duplicate workflow blocked')) {
      console.warn(`⚠️  ${error.message}`);
      throw error; // Re-throw duplicate error for caller to handle
    }
    console.error(`❌ Failed to add workflow to queue:`, error);
    throw error;
  }
}

export async function updateWorkflowStatus(
  workflowId: string,
  brand: Brand,
  updates: Partial<WorkflowQueueItem>
): Promise<void> {
  if (!db) return;

  const collectionName = getCollectionName('WORKFLOW_QUEUE', brand);

  // Prepare update data
  const updateData: Record<string, unknown> = { ...updates };

  // Always update statusChangedAt when status changes
  if (updates.status) {
    updateData.statusChangedAt = Date.now();
  }

  // Only update updatedAt when meaningful progress happens
  const hasProgress = Boolean(
    updates.heygenVideoId ||
    updates.heygenVideoUrl ||
    updates.submagicVideoId ||
    updates.submagicDownloadUrl ||
    updates.finalVideoUrl ||
    updates.latePostId ||
    updates.status === 'completed' ||
    updates.status === 'failed'
  );

  if (hasProgress) {
    updateData.updatedAt = Date.now();
  }

  const cleanData = removeUndefined(updateData);
  await updateDoc(doc(db, collectionName, workflowId), cleanData);

  // CRITICAL: Also update dedup document when status changes
  // This ensures the dedup check reflects current workflow state
  if (updates.status) {
    try {
      // Get the workflow to find its articleId
      const workflowDoc = await getDoc(doc(db, collectionName, workflowId));
      if (workflowDoc.exists()) {
        const workflow = workflowDoc.data();
        const articleId = workflow.articleId;

        if (articleId) {
          // Update the dedup document with new status
          const dedupKey = `dedup_${articleId}_${new Date(workflow.createdAt).toISOString().split('T')[0]}`;
          const dedupRef = doc(db, collectionName, dedupKey);

          await updateDoc(dedupRef, {
            status: updates.status,
            updatedAt: Date.now(),
          }).catch(() => {
            // Dedup doc might not exist for older workflows, ignore error
          });
        }
      }
    } catch (error) {
      // Don't fail the main update if dedup update fails
      console.warn(`⚠️  Failed to update dedup document for workflow ${workflowId}:`, error);
    }
  }
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

    // Get all unprocessed articles (no orderBy to avoid index requirement)
    const q = query(
      collection(db, collectionName),
      where('processed', '==', false)
    );

    const snapshot = await getDocs(q);
    // Sort in memory by pubDate descending
    const articles = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Article))
      .sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));

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

    // Get all processed articles (filter by date in memory to avoid index requirement)
    const q = query(
      collection(db, collectionName),
      where('processed', '==', true)
    );

    const snapshot = await getDocs(q);

    // Filter in memory by processedAt
    const oldArticles = snapshot.docs.filter(docSnap => {
      const data = docSnap.data();
      const processedAt = data.processedAt || 0;
      return processedAt < cutoffTime;
    });

    console.log(`🧹 ${cat}: Deleting ${oldArticles.length} processed articles older than ${olderThanDays} days`);

    for (const docSnap of oldArticles) {
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
  vassdistro: { rated: number; kept: number; deleted: number };
}> {
  if (!db) return {
    carz: { rated: 0, kept: 0, deleted: 0 },
    ownerfi: { rated: 0, kept: 0, deleted: 0 },
    vassdistro: { rated: 0, kept: 0, deleted: 0 }
  };

  const results = {
    carz: { rated: 0, kept: 0, deleted: 0 },
    ownerfi: { rated: 0, kept: 0, deleted: 0 },
    vassdistro: { rated: 0, kept: 0, deleted: 0 }
  };

  const { evaluateArticlesBatch } = await import('./article-quality-filter');

  for (const cat of ['carz', 'ownerfi', 'vassdistro'] as const) {
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
      const docData = snapshot.docs[0].data() as WorkflowQueueItem & { caption?: string; title?: string };
      return {
        workflowId: snapshot.docs[0].id,
        workflow: docData,
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

  // CRITICAL FIX: Create workflow with 'pending' status initially
  // Status will be changed to 'heygen_processing' AFTER we get video ID
  const queueItem: BenefitWorkflowItem = {
    id: `benefit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    benefitId,
    audience,
    benefitTitle,
    status: 'pending',  // ✅ Start with pending, not heygen_processing
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
  workflow: WorkflowQueueItem | PodcastWorkflowItem | BenefitWorkflowItem;
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

  // Check if already in queue (using property_videos collection - the actual queue)
  const queueQuery = query(
    collection(db, 'property_videos'),
    where('propertyId', '==', propertyId)
  );
  const existingQueue = await getDocs(queueQuery);

  if (!existingQueue.empty) {
    console.log(`Property ${propertyId} already in rotation queue`);
    return;
  }

  // Get property data
  const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
  if (!propertyDoc.exists()) {
    throw new Error(`Property ${propertyId} not found`);
  }

  const property = propertyDoc.data() as { imageUrls?: string[] };

  // Validate property has images
  if (!property.imageUrls || property.imageUrls.length === 0) {
    throw new Error(`Property ${propertyId} has no images - cannot add to video queue`);
  }

  // Create workflow entry in property_videos collection
  const workflowId = `prop-${propertyId}-${Date.now()}`;
  const workflowData = {
    propertyId,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'auto_add',
  };

  await setDoc(doc(db, 'property_videos', workflowId), workflowData);
  console.log(`✅ Added property ${propertyId} to rotation queue (workflow: ${workflowId})`);
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
 * Reset a single property back to queued status (for validation errors)
 */
export async function resetPropertyToQueued(propertyId: string): Promise<void> {
  if (!db) return;

  await updateDoc(doc(db, 'property_rotation_queue', propertyId), {
    status: 'queued',
    updatedAt: Date.now()
  });

  console.log(`↩️  Property ${propertyId} reset to queued status`);
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
 * Get property video workflow by ID
 */
export async function getPropertyVideoById(workflowId: string): Promise<Record<string, unknown> | null> {
  if (!db) return null;

  const docSnap = await getDoc(doc(db, 'property_videos', workflowId));

  if (docSnap.exists()) {
    return docSnap.data();
  }

  console.log(`⚠️  No property video workflow found with ID: ${workflowId}`);
  return null;
}

/**
 * Update property video workflow
 * ALSO syncs workflowStatus to the main properties collection for UI display
 */
export async function updatePropertyVideo(
  workflowId: string,
  updates: Record<string, unknown>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  // Prepare update data
  const updateData: Record<string, unknown> = { ...updates };

  // Always update statusChangedAt when status changes
  if (updates.status) {
    updateData.statusChangedAt = Date.now();
  }

  // Only update updatedAt when meaningful progress happens
  const hasProgress = Boolean(
    updates.heygenVideoId ||
    updates.heygenVideoUrl ||
    updates.submagicVideoId ||
    updates.submagicProjectId ||
    updates.submagicDownloadUrl ||
    updates.finalVideoUrl ||
    updates.latePostId ||
    updates.status === 'completed' ||
    updates.status === 'failed'
  );

  if (hasProgress) {
    updateData.updatedAt = Date.now();
  }

  // Update property_videos workflow collection
  await updateDoc(doc(db, 'property_videos', workflowId), updateData);

  // CRITICAL: Also sync workflowStatus to main properties collection for UI
  // Get the property_videos doc to find the propertyId
  try {
    const workflowDoc = await getDoc(doc(db, 'property_videos', workflowId));
    if (workflowDoc.exists()) {
      const workflowData = workflowDoc.data();
      const propertyId = workflowData.propertyId;

      if (propertyId) {
        // Map status to workflowStatus.stage for properties collection
        const propertyUpdates: Record<string, unknown> = {};

        if (updates.status) {
          // Map internal statuses to UI-friendly stages
          const stageMap: Record<string, string> = {
            'heygen_processing': 'Processing',
            'submagic_processing': 'Processing',
            'video_processing': 'Processing',
            'posting': 'Posting',
            'completed': 'Completed',
            'failed': 'Failed'
          };
          propertyUpdates['workflowStatus.stage'] = stageMap[updates.status] || 'Processing';
        }

        if (updates.heygenVideoId) {
          propertyUpdates['workflowStatus.heygenVideoId'] = updates.heygenVideoId;
        }

        if (updates.submagicVideoId || updates.submagicProjectId) {
          propertyUpdates['workflowStatus.submagicVideoId'] = updates.submagicVideoId || updates.submagicProjectId;
        }

        if (updates.finalVideoUrl) {
          propertyUpdates['workflowStatus.finalVideoUrl'] = updates.finalVideoUrl;
        }

        if (updates.latePostId) {
          propertyUpdates['workflowStatus.latePostId'] = updates.latePostId;
        }

        if (updates.error) {
          propertyUpdates['workflowStatus.error'] = updates.error;
        }

        if (updates.completedAt) {
          propertyUpdates['workflowStatus.completedAt'] = updates.completedAt;
        }

        // Always update lastUpdated
        propertyUpdates['workflowStatus.lastUpdated'] = Date.now();

        // Update the main properties collection
        await updateDoc(doc(db, 'properties', propertyId), propertyUpdates);
      }
    }
  } catch (error) {
    // Don't fail the whole update if properties sync fails
    console.error('Warning: Failed to sync workflowStatus to properties collection:', error);
  }
}

/**
 * Find property video by Submagic project ID
 */
export async function findPropertyVideoBySubmagicId(submagicProjectId: string): Promise<{
  workflowId: string;
  workflow: Record<string, unknown>;
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
