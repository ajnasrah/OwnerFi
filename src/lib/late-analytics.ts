/**
 * Late.dev Analytics Integration
 *
 * Comprehensive system for tracking video performance metrics from Late.dev
 * Analyzes: Time, Content Type, Hook Style, Platform Performance, etc.
 */

import { getAdminDb } from './firebase-admin';
import { fetchWithTimeout, TIMEOUTS } from './api-utils';

const LATE_BASE_URL = 'https://getlate.dev/api/v1';

interface LatePostAnalytics {
  _id: string; // Late.dev uses _id, not postId
  postId?: string; // Keep for backward compatibility
  profileId?: string;
  brand?: string;
  scheduledFor: string;
  postedAt?: string;
  content?: string; // Late.dev uses 'content' for caption
  platforms: {
    platform: string;
    accountId: string;
    platformPostId?: string;
    analytics?: {
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
      saves?: number;
      reach?: number;
      impressions?: number;
      engagement_rate?: number;
      engagementRate?: number;
    };
    stats?: {
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
      saves?: number;
      reach?: number;
      impressions?: number;
      engagement_rate?: number;
    };
  }[];
  mediaUrl?: string;
  caption?: string;
  status: 'scheduled' | 'posted' | 'failed' | 'pending';
}

interface VideoPerformanceMetrics {
  workflowId: string;
  latePostId?: string;
  brand: string;
  contentType: 'viral' | 'benefit' | 'property' | 'podcast' | 'abdullah';
  variant?: '15sec' | '30sec';

  // Timing
  scheduledTime: string;
  postedTime?: string;
  timeSlot: string; // e.g., "07:00-08:00"
  dayOfWeek: string; // Monday, Tuesday, etc.

  // Content metadata
  hook?: string;
  hookType?: string; // 'controversy', 'question', 'storytelling', etc.
  caption?: string;
  title?: string;
  script?: string;

  // Platform performance
  platformMetrics: {
    [platform: string]: {
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
      saves?: number;
      reach?: number;
      impressions?: number;
      engagement_rate?: number;
      clickthrough_rate?: number;
    };
  };

  // Aggregated metrics
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  overallEngagementRate: number;

  // Analysis
  lastUpdated: number;
  dataSource: 'late_api' | 'platform_api' | 'manual';
}

/**
 * Get Late.dev API Key
 */
function getLateApiKey(): string | undefined {
  return process.env.LATE_API_KEY;
}

/**
 * Fetch post analytics from Late.dev
 */
export async function fetchLatePostAnalytics(postId: string): Promise<LatePostAnalytics | null> {
  const LATE_API_KEY = getLateApiKey();
  if (!LATE_API_KEY) {
    console.error('❌ LATE_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      `${LATE_BASE_URL}/posts/${postId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      },
      TIMEOUTS.EXTERNAL_API
    );

    if (!response.ok) {
      console.error(`❌ Late API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data as LatePostAnalytics;
  } catch (error) {
    console.error('❌ Error fetching Late post analytics:', error);
    return null;
  }
}

/**
 * Fetch all posts for a profile (with date range)
 */
export async function fetchProfilePosts(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'vassdistro' | 'abdullah',
  startDate?: Date,
  endDate?: Date
): Promise<LatePostAnalytics[]> {
  const LATE_API_KEY = getLateApiKey();
  if (!LATE_API_KEY) {
    throw new Error('LATE_API_KEY not configured');
  }

  // Get profile ID for brand
  const profileIdMap: Record<string, string | undefined> = {
    'carz': process.env.LATE_CARZ_PROFILE_ID,
    'ownerfi': process.env.LATE_OWNERFI_PROFILE_ID,
    'podcast': process.env.LATE_PODCAST_PROFILE_ID,
    'vassdistro': process.env.LATE_VASSDISTRO_PROFILE_ID,
    'abdullah': process.env.LATE_ABDULLAH_PROFILE_ID,
  };

  const profileId = profileIdMap[brand];
  if (!profileId) {
    throw new Error(`Profile ID not configured for ${brand}`);
  }

  try {
    // Build query params
    const params = new URLSearchParams({
      profileId,
      limit: '100', // Get last 100 posts
    });

    if (startDate) {
      params.append('startDate', startDate.toISOString());
    }
    if (endDate) {
      params.append('endDate', endDate.toISOString());
    }

    const response = await fetchWithTimeout(
      `${LATE_BASE_URL}/posts?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LATE_API_KEY}`,
          'Content-Type': 'application/json',
        }
      },
      TIMEOUTS.EXTERNAL_API
    );

    if (!response.ok) {
      throw new Error(`Late API error: ${response.status}`);
    }

    const data = await response.json();
    return data.posts || [];
  } catch (error) {
    console.error(`❌ Error fetching posts for ${brand}:`, error);
    return [];
  }
}

/**
 * Extract hour from ISO timestamp
 */
function getTimeSlot(timestamp: string): string {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const nextHour = (hour + 1) % 24;
  return `${hour.toString().padStart(2, '0')}:00-${nextHour.toString().padStart(2, '0')}:00`;
}

/**
 * Get day of week from timestamp
 */
function getDayOfWeek(timestamp: string): string {
  const date = new Date(timestamp);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Calculate engagement rate
 */
function calculateEngagementRate(
  likes: number,
  comments: number,
  shares: number,
  views: number
): number {
  if (views === 0) return 0;
  return ((likes + comments + shares) / views) * 100;
}

/**
 * Process analytics from a Late post and save to Firestore
 */
async function processPostAnalytics(
  workflowId: string,
  workflowData: any,
  post: LatePostAnalytics,
  brand: string
): Promise<void> {
  try {
    const adminDb = await getAdminDb();
    if (!adminDb) {
      console.error('❌ Firebase Admin not initialized');
      return;
    }

    if (!post.platforms || !Array.isArray(post.platforms)) {
      console.warn(`⚠️  No platforms data for workflow ${workflowId}`);
      return;
    }

    // Build performance metrics
    const platformMetrics: any = {};
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;

    post.platforms.forEach(p => {
      const stats = p.analytics || p.stats;
      if (stats) {
        platformMetrics[p.platform] = stats;
        totalViews += stats.views || 0;
        totalLikes += stats.likes || 0;
        totalComments += stats.comments || 0;
        totalShares += stats.shares || 0;
        totalSaves += stats.saves || 0;
      }
    });

    const overallEngagementRate = calculateEngagementRate(
      totalLikes,
      totalComments,
      totalShares,
      totalViews
    );

    // Extract hook from script (first sentence)
    const hook = workflowData.script
      ? workflowData.script.split('.')[0] + '.'
      : undefined;

    // Determine content type
    let contentType: 'viral' | 'benefit' | 'property' | 'podcast' | 'abdullah' = 'viral';
    if (brand === 'benefit' || workflowData.audience) {
      contentType = 'benefit';
    } else if (brand === 'property' || workflowData.propertyId) {
      contentType = 'property';
    } else if (brand === 'podcast') {
      contentType = 'podcast';
    } else if (brand === 'abdullah') {
      contentType = 'abdullah';
    }

    // Build metrics object (filter out undefined values)
    const metrics: any = {
      workflowId,
      latePostId: post._id || post.postId,
      brand,
      contentType,

      // Timing
      scheduledTime: post.scheduledFor,
      timeSlot: getTimeSlot(post.scheduledFor),
      dayOfWeek: getDayOfWeek(post.scheduledFor),

      // Metrics
      platformMetrics,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
      overallEngagementRate,

      // Meta
      lastUpdated: Date.now(),
      dataSource: 'late_api'
    };

    // Add optional fields only if they exist
    if (workflowData.variant) metrics.variant = workflowData.variant;
    if (post.postedAt) metrics.postedTime = post.postedAt;
    if (hook) metrics.hook = hook;
    if (workflowData.hookType || workflowData.captionTemplate) {
      metrics.hookType = workflowData.hookType || workflowData.captionTemplate;
    }
    if (workflowData.caption || post.content || post.caption) {
      metrics.caption = workflowData.caption || post.content || post.caption;
    }
    if (workflowData.title) metrics.title = workflowData.title;
    if (workflowData.script) metrics.script = workflowData.script;

    // Store in analytics collection
    await (adminDb as any).collection('workflow_analytics').doc(workflowId).set(metrics, { merge: true });

    console.log(`✅ Synced analytics for ${workflowId}`);
    console.log(`   Views: ${totalViews}, Engagement: ${overallEngagementRate.toFixed(2)}%`);

  } catch (error) {
    console.error(`❌ Error syncing analytics for ${workflowId}:`, error);
  }
}

/**
 * Sync Late analytics to Firestore (enriches workflow data)
 */
export async function syncLateAnalyticsToFirestore(
  workflowId: string,
  brand: string,
  collection: string = 'workflow_analytics'
): Promise<void> {
  try {
    // Initialize Firebase Admin
    const adminDb = await getAdminDb();
    if (!adminDb) {
      console.error('❌ Firebase Admin not initialized');
      return;
    }

    // Get workflow data from Firestore
    const workflowRef = (adminDb as any).collection(getWorkflowCollection(brand)).doc(workflowId);
    const workflowSnap = await workflowRef.get();

    if (!workflowSnap.exists) {
      console.warn(`⚠️  Workflow ${workflowId} not found`);
      return;
    }

    const workflowData = workflowSnap.data() as any;
    const latePostId = workflowData.latePostId;

    if (!latePostId) {
      console.warn(`⚠️  No Late post ID for workflow ${workflowId}`);
      return;
    }

    // Fetch analytics from Late
    const analytics = await fetchLatePostAnalytics(latePostId);

    if (!analytics) {
      console.warn(`⚠️  Could not fetch analytics for post ${latePostId}`);
      return;
    }

    if (!analytics.platforms || !Array.isArray(analytics.platforms)) {
      console.warn(`⚠️  No platforms data for post ${latePostId}`);
      return;
    }

    // Build performance metrics
    const platformMetrics: any = {};
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;

    analytics.platforms.forEach(p => {
      // Late.dev uses 'analytics' field, not 'stats'
      const stats = p.analytics || p.stats;
      if (stats) {
        platformMetrics[p.platform] = stats;
        totalViews += stats.views || 0;
        totalLikes += stats.likes || 0;
        totalComments += stats.comments || 0;
        totalShares += stats.shares || 0;
        totalSaves += stats.saves || 0;
      }
    });

    const overallEngagementRate = calculateEngagementRate(
      totalLikes,
      totalComments,
      totalShares,
      totalViews
    );

    // Extract hook from script (first 3-5 seconds / first sentence)
    const hook = workflowData.script
      ? workflowData.script.split('.')[0] + '.'
      : undefined;

    // Determine content type
    let contentType: 'viral' | 'benefit' | 'property' | 'podcast' | 'abdullah' = 'viral';
    if (brand === 'benefit' || workflowData.audience) {
      contentType = 'benefit';
    } else if (brand === 'property' || workflowData.propertyId) {
      contentType = 'property';
    } else if (brand === 'podcast') {
      contentType = 'podcast';
    } else if (brand === 'abdullah') {
      contentType = 'abdullah';
    }

    // Build metrics object
    const metrics: VideoPerformanceMetrics = {
      workflowId,
      latePostId,
      brand,
      contentType,
      variant: workflowData.variant as '15sec' | '30sec' | undefined,

      // Timing
      scheduledTime: analytics.scheduledFor,
      postedTime: analytics.postedAt,
      timeSlot: getTimeSlot(analytics.scheduledFor),
      dayOfWeek: getDayOfWeek(analytics.scheduledFor),

      // Content
      hook,
      hookType: workflowData.hookType || workflowData.captionTemplate,
      caption: workflowData.caption || analytics.content || analytics.caption,
      title: workflowData.title,
      script: workflowData.script,

      // Metrics
      platformMetrics,
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      totalSaves,
      overallEngagementRate,

      // Meta
      lastUpdated: Date.now(),
      dataSource: 'late_api'
    };

    // Store in analytics collection
    await (adminDb as any).collection(collection).doc(workflowId).set(metrics, { merge: true });

    console.log(`✅ Synced analytics for ${workflowId}`);
    console.log(`   Views: ${totalViews}, Engagement: ${overallEngagementRate.toFixed(2)}%`);

  } catch (error) {
    console.error(`❌ Error syncing analytics for ${workflowId}:`, error);
  }
}

/**
 * Get workflow collection name by brand
 */
function getWorkflowCollection(brand: string): string {
  const collectionMap: Record<string, string> = {
    'carz': 'carz_workflow_queue',
    'ownerfi': 'ownerfi_workflow_queue',
    'podcast': 'podcast_workflow_queue',
    'benefit': 'benefit_workflow_queue',
    'property': 'property_videos',
    'vassdistro': 'vassdistro_workflow_queue',
    'abdullah': 'abdullah_workflow_queue',
  };
  return collectionMap[brand] || 'workflow_queue';
}

/**
 * Sync all recent posts for a brand (last 7 days)
 */
export async function syncBrandAnalytics(
  brand: 'carz' | 'ownerfi' | 'podcast' | 'vassdistro' | 'abdullah',
  days: number = 7
): Promise<void> {
  console.log(`📊 Syncing ${brand} analytics for last ${days} days...`);

  // Initialize Firebase Admin
  const adminDb = await getAdminDb();
  if (!adminDb) {
    console.error('❌ Firebase Admin not initialized');
    return;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const posts = await fetchProfilePosts(brand, startDate);

  console.log(`   Found ${posts.length} posts`);

  for (const post of posts) {
    // Late.dev uses _id field
    const postId = post._id || post.postId;

    if (!postId) {
      console.log(`   ⚠️  Skipping post without ID`);
      continue;
    }

    // Find workflow by Late post ID
    const collection = getWorkflowCollection(brand);
    const workflowSnap = await (adminDb as any).collection(collection)
      .where('latePostId', '==', postId)
      .limit(1)
      .get();

    if (!workflowSnap.empty) {
      const workflowId = workflowSnap.docs[0].id;
      const workflowData = workflowSnap.docs[0].data();

      // Process analytics directly from the post data (no need to fetch again)
      await processPostAnalytics(workflowId, workflowData, post, brand);
    }
  }

  console.log(`✅ Completed ${brand} analytics sync`);
}

/**
 * Sync analytics for all brands
 */
export async function syncAllBrandAnalytics(days: number = 7): Promise<void> {
  const brands: Array<'carz' | 'ownerfi' | 'podcast' | 'vassdistro' | 'abdullah'> = [
    'carz',
    'ownerfi',
    'podcast',
    'vassdistro',
    'abdullah'
  ];

  for (const brand of brands) {
    try {
      await syncBrandAnalytics(brand, days);
    } catch (error) {
      console.error(`❌ Error syncing ${brand}:`, error);
    }
  }
}
