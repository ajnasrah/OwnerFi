// RSS Feed Data Store - Firestore Backend for Serverless (Simplified)
// Manages feed subscriptions and article storage in Firestore

import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';

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
  error?: string;
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

// Article management
export async function addArticle(article: Omit<Article, 'createdAt'>, category: 'carz' | 'ownerfi'): Promise<Article> {
  if (!db) throw new Error('Firebase not initialized');

  const newArticle: Article = {
    ...article,
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
    workflowId,
    error
  });
  await updateDoc(doc(db, collectionName, id), cleanData);
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

// Workflow Queue Management
export async function addWorkflowToQueue(articleId: string, articleTitle: string, brand: 'carz' | 'ownerfi'): Promise<WorkflowQueueItem> {
  if (!db) throw new Error('Firebase not initialized');

  const queueItem: WorkflowQueueItem = {
    id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    articleId,
    articleTitle,
    brand,
    status: 'pending',
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
