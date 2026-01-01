/**
 * Blog Queue Management
 *
 * Manages automated blog post generation and scheduling
 * Focuses on tips, knowledge, and educational content (NO promotional)
 */

import { getAdminDb } from './firebase-admin';
import { Brand } from '@/config/constants';

/**
 * Blog queue item
 */
export interface BlogQueueItem {
  id: string;
  brand: Brand;
  topic: string; // e.g., "5 mistakes first-time home buyers make with owner financing"
  pillar: string;
  status: 'pending' | 'generating' | 'generated' | 'scheduled' | 'posted' | 'failed';
  priority: number; // 1-10, higher = sooner
  scheduledFor?: Date; // When to generate/post
  generatedBlogId?: string; // Reference to created blog post
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

/**
 * Brand-specific topic templates (tips & knowledge focused for 25-40 demo)
 */
export const BLOG_TOPIC_TEMPLATES = {
  ownerfi: [
    // Owner Finance Education (tips & knowledge)
    "5 Common Mistakes First-Time Buyers Make With Owner Financing",
    "7 Things To Know Before Signing an Owner Finance Contract",
    "How Balloon Payments Actually Work in Seller Financing Deals",
    "What Credit Score Do You Really Need for Owner Financing?",
    "Understanding Down Payments: Why Sellers Ask for 10-20%",
    "Contract for Deed vs Subject-To: Key Differences Explained",
    "How to Calculate Your Real Monthly Payment in an Owner Finance Deal",
    "What Happens If You Miss a Payment in Seller Financing?",
    "5 Questions to Ask Before Accepting an Owner Finance Offer",
    "How Interest Rates Work in Owner Financing (And Why They're Higher)",
  ],
  carz: [
    // Car Buying Education (insider tips)
    "5 Red Flags When Buying a Used Car That Dealers Won't Tell You",
    "How Long Cars Actually Sit on Dealer Lots Before Price Drops",
    "What Happens at Auto Auctions: Behind the Scenes",
    "Why Wholesale Prices Are 20-30% Lower Than Retail",
    "5 Cars Mechanics Refuse to Buy (And Why)",
    "How to Spot Flood Damage That Dealers Try to Hide",
    "The Real Cost of Financing a Car: What They Don't Tell You",
    "Best Times of Year to Buy a Car (Data-Backed)",
    "How to Read a CarFax Report Like a Pro",
    "5 Negotiation Tactics That Actually Work at Dealerships",
  ],
  abdullah: [
    // Entrepreneurship & Money Education (real talk)
    "5 Money Mistakes I Made in My First Year of Business",
    "How to Actually Build Credit From Scratch",
    "Why Most Side Hustles Fail in the First 90 Days",
    "The Real Cost of Being Your Own Boss Nobody Talks About",
    "How I Manage Cash Flow Across 3 Different Businesses",
    "5 Automation Tools That Save Me 20 Hours a Week",
    "What I Wish I Knew About Taxes Before Starting a Business",
    "How to Know When to Quit Your W-2 (Real Numbers)",
    "5 Books That Actually Changed How I Think About Money",
    "The Difference Between Being Busy and Being Productive",
  ],
} as const;

/**
 * Get Firestore collection for blog queue
 */
function getBlogQueueCollection(brand: Brand): string {
  return `${brand}_blog_queue`;
}

/**
 * Add topic to blog queue
 */
export async function addToBlogQueue(
  brand: Brand,
  topic: string,
  pillar: string,
  options: {
    priority?: number;
    scheduledFor?: Date;
  } = {}
): Promise<BlogQueueItem> {
  const db = await getAdminDb();
  if (!db) throw new Error('Firebase not initialized');
  const collection = getBlogQueueCollection(brand);

  const { priority = 5, scheduledFor } = options;

  const queueItem: Omit<BlogQueueItem, 'id'> = {
    brand,
    topic,
    pillar,
    status: 'pending',
    priority,
    ...(scheduledFor && { scheduledFor }),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const docRef = await db.collection(collection).add(queueItem);

  console.log(`✅ Added to blog queue: ${topic}`);
  console.log(`   Brand: ${brand}, Priority: ${priority}`);

  return {
    id: docRef.id,
    ...queueItem,
  };
}

/**
 * Populate blog queue with template topics
 */
export async function populateBlogQueue(
  brand: Brand,
  count: number = 10,
  options: {
    startDate?: Date; // Start scheduling from this date
    daysApart?: number; // Days between each post (default: 2)
  } = {}
): Promise<BlogQueueItem[]> {
  const { startDate = new Date(), daysApart = 2 } = options;

  const templates = BLOG_TOPIC_TEMPLATES[brand];
  if (!templates || templates.length === 0) {
    throw new Error(`No topic templates found for brand: ${brand}`);
  }

  const topics = templates.slice(0, count);
  const queueItems: BlogQueueItem[] = [];

  console.log(`📝 Populating blog queue for ${brand}...`);
  console.log(`   Topics: ${topics.length}`);
  console.log(`   Starting: ${startDate.toLocaleDateString()}`);
  console.log(`   Frequency: Every ${daysApart} days`);

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];

    // Schedule each topic X days apart
    const scheduledFor = new Date(startDate);
    scheduledFor.setDate(scheduledFor.getDate() + (i * daysApart));

    // Auto-detect pillar (simple matching)
    let pillar = 'general';
    const topicLower = topic.toLowerCase();

    if (brand === 'ownerfi') {
      if (topicLower.includes('mistake') || topicLower.includes('know') || topicLower.includes('understand')) {
        pillar = 'owner-finance-101';
      } else if (topicLower.includes('deal') || topicLower.includes('example')) {
        pillar = 'deal-breakdowns';
      } else if (topicLower.includes('payment') || topicLower.includes('credit') || topicLower.includes('rate')) {
        pillar = 'market-money';
      }
    } else if (brand === 'carz') {
      if (topicLower.includes('dealer') || topicLower.includes('hidden') || topicLower.includes('tell you')) {
        pillar = 'dealer-secrets';
      } else if (topicLower.includes('auction') || topicLower.includes('wholesale')) {
        pillar = 'behind-auction';
      } else if (topicLower.includes('financing') || topicLower.includes('credit')) {
        pillar = 'financing-credit';
      }
    } else if (brand === 'abdullah') {
      if (topicLower.includes('money') || topicLower.includes('credit') || topicLower.includes('tax')) {
        pillar = 'real-talk-money';
      } else if (topicLower.includes('business') || topicLower.includes('side hustle')) {
        pillar = 'entrepreneurship';
      } else if (topicLower.includes('automation') || topicLower.includes('tools')) {
        pillar = 'systems-automation';
      }
    }

    const item = await addToBlogQueue(brand, topic, pillar, {
      priority: 5,
      scheduledFor,
    });

    queueItems.push(item);
  }

  console.log(`✅ Added ${queueItems.length} topics to queue`);

  return queueItems;
}

/**
 * Get next pending blog from queue
 */
export async function getNextBlogFromQueue(brand: Brand): Promise<BlogQueueItem | null> {
  const db = await getAdminDb();
  if (!db) throw new Error('Firebase not initialized');
  const collection = getBlogQueueCollection(brand);

  const snapshot = await db
    .collection(collection)
    .where('status', '==', 'pending')
    .orderBy('priority', 'desc')
    .orderBy('createdAt', 'asc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
    scheduledFor: doc.data().scheduledFor?.toDate(),
    processedAt: doc.data().processedAt?.toDate(),
  } as BlogQueueItem;
}

/**
 * Update blog queue item status
 */
export async function updateBlogQueueStatus(
  brand: Brand,
  itemId: string,
  status: BlogQueueItem['status'],
  updates: {
    generatedBlogId?: string;
    error?: string;
  } = {}
): Promise<void> {
  const db = await getAdminDb();
  if (!db) throw new Error('Firebase not initialized');
  const collection = getBlogQueueCollection(brand);

  await db.collection(collection).doc(itemId).update({
    status,
    updatedAt: new Date(),
    ...(status === 'posted' || status === 'failed' ? { processedAt: new Date() } : {}),
    ...updates,
  });

  console.log(`📝 Updated queue item ${itemId}: ${status}`);
}

/**
 * Get queue stats for a brand
 */
export async function getBlogQueueStats(brand: Brand): Promise<{
  total: number;
  pending: number;
  generating: number;
  generated: number;
  scheduled: number;
  posted: number;
  failed: number;
}> {
  const db = await getAdminDb();
  if (!db) throw new Error('Firebase not initialized');
  const collection = getBlogQueueCollection(brand);

  const [total, pending, generating, generated, scheduled, posted, failed] = await Promise.all([
    db.collection(collection).count().get(),
    db.collection(collection).where('status', '==', 'pending').count().get(),
    db.collection(collection).where('status', '==', 'generating').count().get(),
    db.collection(collection).where('status', '==', 'generated').count().get(),
    db.collection(collection).where('status', '==', 'scheduled').count().get(),
    db.collection(collection).where('status', '==', 'posted').count().get(),
    db.collection(collection).where('status', '==', 'failed').count().get(),
  ]);

  return {
    total: total.data().count,
    pending: pending.data().count,
    generating: generating.data().count,
    generated: generated.data().count,
    scheduled: scheduled.data().count,
    posted: posted.data().count,
    failed: failed.data().count,
  };
}
