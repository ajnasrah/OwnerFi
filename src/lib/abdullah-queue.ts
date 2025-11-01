/**
 * Abdullah Content Queue System
 *
 * Manages a daily queue of 5 video scripts that are generated once per day
 * and then processed one at a time throughout the day at staggered intervals.
 *
 * Flow:
 * 1. Daily cron (11am) generates 5 scripts and adds to queue
 * 2. Processing cron (5x daily) picks ONE pending item and generates video
 * 3. Each video is posted immediately after Submagic completes
 *
 * This prevents:
 * - Overwhelming HeyGen API with 5 simultaneous requests
 * - Race conditions in webhook processing
 * - Scheduling conflicts where all posts try to go out at once
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { AbdullahVideoScript } from './abdullah-content-generator';

// Initialize Firebase Admin (server-side only!)
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

export interface AbdullahQueueItem {
  id?: string;

  // Script details
  theme: 'mindset' | 'business' | 'money' | 'freedom' | 'story';
  title: string;
  script: string;
  caption: string;
  hook: string;

  // Queue metadata
  status: 'pending' | 'generating' | 'completed' | 'failed';
  priority: number; // 1-5, determines order (1 = first)

  // Scheduling
  scheduledGenerationTime: Date; // When to generate video (staggered)
  scheduledPostTime: Date; // When to post after generation

  // Workflow tracking
  workflowId?: string;
  heygenVideoId?: string;
  submagicVideoId?: string;
  latePostId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  generatedAt?: Date;
  completedAt?: Date;

  // Error tracking
  error?: string;
  retryCount: number;
}

const COLLECTION_NAME = 'abdullah_content_queue';

/**
 * Add scripts to queue (called by daily cron)
 */
export async function addScriptsToQueue(scripts: AbdullahVideoScript[]): Promise<string[]> {
  const queueIds: string[] = [];

  // Define posting times (CDT): 9am, 12pm, 3pm, 6pm, 9pm
  const postingHours = [9, 12, 15, 18, 21];

  // Define generation times (30 min before posting to allow processing time)
  const generationHours = [8, 11, 14, 17, 20];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];

    // Set generation time (staggered throughout day)
    const generationTime = new Date(today);
    generationTime.setHours(generationHours[i], 30, 0, 0);

    // If generation time has passed today, schedule for tomorrow
    if (generationTime < new Date()) {
      generationTime.setDate(generationTime.getDate() + 1);
    }

    // Set post time (30 min after generation)
    const postTime = new Date(generationTime);
    postTime.setMinutes(postTime.getMinutes() + 30);

    const queueItem: Omit<AbdullahQueueItem, 'id'> = {
      theme: script.theme,
      title: script.title,
      script: script.script,
      caption: script.caption,
      hook: script.hook,

      status: 'pending',
      priority: i + 1, // 1 = Mindset (first), 5 = Story (last)

      scheduledGenerationTime: generationTime,
      scheduledPostTime: postTime,

      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
    };

    try {
      const docRef = await db.collection(COLLECTION_NAME).add({
        ...queueItem,
        createdAt: Timestamp.fromDate(queueItem.createdAt),
        updatedAt: Timestamp.fromDate(queueItem.updatedAt),
        scheduledGenerationTime: Timestamp.fromDate(queueItem.scheduledGenerationTime),
        scheduledPostTime: Timestamp.fromDate(queueItem.scheduledPostTime),
      });

      queueIds.push(docRef.id);
      console.log(`✅ Added to queue: ${script.theme} (${script.title}) - ID: ${docRef.id}`);
      console.log(`   Generate at: ${generationTime.toLocaleString('en-US', { timeZone: 'America/Chicago' })} CDT`);
      console.log(`   Post at: ${postTime.toLocaleString('en-US', { timeZone: 'America/Chicago' })} CDT`);

    } catch (error) {
      console.error(`❌ Failed to add ${script.theme} to queue:`, error);
    }
  }

  return queueIds;
}

/**
 * Get next pending queue item ready for processing
 */
export async function getNextPendingItem(): Promise<AbdullahQueueItem | null> {
  try {
    const now = new Date();

    // Query for pending items where scheduled time has arrived
    const snapshot = await db.collection(COLLECTION_NAME)
      .where('status', '==', 'pending')
      .where('scheduledGenerationTime', '<=', Timestamp.fromDate(now))
      .orderBy('scheduledGenerationTime', 'asc')
      .orderBy('priority', 'asc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      id: doc.id,
      theme: data.theme,
      title: data.title,
      script: data.script,
      caption: data.caption,
      hook: data.hook,
      status: data.status,
      priority: data.priority,
      scheduledGenerationTime: data.scheduledGenerationTime.toDate(),
      scheduledPostTime: data.scheduledPostTime.toDate(),
      workflowId: data.workflowId,
      heygenVideoId: data.heygenVideoId,
      submagicVideoId: data.submagicVideoId,
      latePostId: data.latePostId,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      generatedAt: data.generatedAt?.toDate(),
      completedAt: data.completedAt?.toDate(),
      error: data.error,
      retryCount: data.retryCount || 0,
    };

  } catch (error) {
    console.error('❌ Error getting next pending item:', error);
    return null;
  }
}

/**
 * Update queue item status
 */
export async function updateQueueItem(
  queueId: string,
  updates: Partial<AbdullahQueueItem>
): Promise<void> {
  try {
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    // Convert Date objects to Timestamps
    if (updates.generatedAt) {
      updateData.generatedAt = Timestamp.fromDate(updates.generatedAt);
    }
    if (updates.completedAt) {
      updateData.completedAt = Timestamp.fromDate(updates.completedAt);
    }
    if (updates.scheduledGenerationTime) {
      updateData.scheduledGenerationTime = Timestamp.fromDate(updates.scheduledGenerationTime);
    }
    if (updates.scheduledPostTime) {
      updateData.scheduledPostTime = Timestamp.fromDate(updates.scheduledPostTime);
    }

    await db.collection(COLLECTION_NAME).doc(queueId).update(updateData);

  } catch (error) {
    console.error(`❌ Error updating queue item ${queueId}:`, error);
    throw error;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  try {
    // Get pending count
    const pendingSnap = await db.collection(COLLECTION_NAME)
      .where('status', '==', 'pending')
      .get();

    // Get generating count
    const generatingSnap = await db.collection(COLLECTION_NAME)
      .where('status', '==', 'generating')
      .get();

    // Get completed today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const completedSnap = await db.collection(COLLECTION_NAME)
      .where('status', '==', 'completed')
      .where('completedAt', '>=', Timestamp.fromDate(todayStart))
      .get();

    // Get failed count
    const failedSnap = await db.collection(COLLECTION_NAME)
      .where('status', '==', 'failed')
      .get();

    return {
      pending: pendingSnap.size,
      generating: generatingSnap.size,
      completedToday: completedSnap.size,
      failed: failedSnap.size,
      total: pendingSnap.size + generatingSnap.size + completedSnap.size + failedSnap.size,
    };

  } catch (error) {
    console.error('❌ Error getting queue stats:', error);
    return {
      pending: 0,
      generating: 0,
      completedToday: 0,
      failed: 0,
      total: 0,
    };
  }
}

/**
 * Check if queue already has items for today
 */
export async function hasQueuedItemsForToday(): Promise<boolean> {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const snapshot = await db.collection(COLLECTION_NAME)
      .where('createdAt', '>=', Timestamp.fromDate(todayStart))
      .where('createdAt', '<', Timestamp.fromDate(todayEnd))
      .limit(1)
      .get();

    return !snapshot.empty;

  } catch (error) {
    console.error('❌ Error checking today\'s queue:', error);
    return false;
  }
}

/**
 * Get queue item by ID
 */
export async function getQueueItemById(queueId: string): Promise<AbdullahQueueItem | null> {
  try {
    const docSnap = await db.collection(COLLECTION_NAME).doc(queueId).get();

    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data()!;

    return {
      id: docSnap.id,
      theme: data.theme,
      title: data.title,
      script: data.script,
      caption: data.caption,
      hook: data.hook,
      status: data.status,
      priority: data.priority,
      scheduledGenerationTime: data.scheduledGenerationTime.toDate(),
      scheduledPostTime: data.scheduledPostTime.toDate(),
      workflowId: data.workflowId,
      heygenVideoId: data.heygenVideoId,
      submagicVideoId: data.submagicVideoId,
      latePostId: data.latePostId,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
      generatedAt: data.generatedAt?.toDate(),
      completedAt: data.completedAt?.toDate(),
      error: data.error,
      retryCount: data.retryCount || 0,
    };

  } catch (error) {
    console.error(`❌ Error getting queue item ${queueId}:`, error);
    return null;
  }
}
