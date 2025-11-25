/**
 * YouTube Analytics Integration
 * Fetches video performance metrics directly from YouTube Data API v3
 * Tracks: views, likes, comments, watch time, CTR, etc.
 */

import { google } from 'googleapis';
import { getAdminDb } from './firebase-admin';

const youtube = google.youtube('v3');

interface YouTubeCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface YouTubeVideoStats {
  videoId: string;
  title: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  description: string;
  thumbnailUrl?: string;
  tags?: string[];

  // Core metrics
  viewCount: number;
  likeCount: number;
  commentCount: number;

  // Engagement
  engagementRate: number; // (likes + comments) / views * 100

  // Duration
  duration: string; // ISO 8601 format
  durationSeconds: number;

  // Status
  isShort: boolean;
  privacyStatus: string;

  // Timestamps
  fetchedAt: number;
}

export interface YouTubeChannelStats {
  channelId: string;
  channelTitle: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  fetchedAt: number;
}

export interface YouTubeAnalyticsSummary {
  brand: string;
  channelId: string;
  channelTitle: string;

  // Channel totals
  totalSubscribers: number;
  totalViews: number;
  totalVideos: number;

  // Recent performance (last 30 days)
  recentVideos: YouTubeVideoStats[];

  // Top performers
  topByViews: YouTubeVideoStats[];
  topByEngagement: YouTubeVideoStats[];

  // Aggregated metrics
  avgViewsPerVideo: number;
  avgEngagementRate: number;
  totalRecentViews: number;
  totalRecentLikes: number;
  totalRecentComments: number;

  fetchedAt: number;
}

/**
 * Get YouTube credentials for a brand
 */
function getYouTubeCredentials(brand: string): YouTubeCredentials | null {
  const brandUpper = brand.toUpperCase();

  // Shared credentials
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  // Brand-specific refresh token
  const refreshToken = process.env[`YOUTUBE_${brandUpper}_REFRESH_TOKEN`];

  if (!clientId || !clientSecret || !refreshToken) {
    console.error(`❌ [YouTube Analytics] Missing credentials for ${brand}`);
    return null;
  }

  return { clientId, clientSecret, refreshToken };
}

/**
 * Get OAuth2 client for YouTube API
 */
function getOAuth2Client(credentials: YouTubeCredentials) {
  const oauth2Client = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: credentials.refreshToken,
  });

  return oauth2Client;
}

/**
 * Parse ISO 8601 duration to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Get channel info for authenticated user
 */
export async function getChannelInfo(brand: string): Promise<YouTubeChannelStats | null> {
  const credentials = getYouTubeCredentials(brand);
  if (!credentials) return null;

  try {
    const auth = getOAuth2Client(credentials);

    const response = await youtube.channels.list({
      auth,
      part: ['snippet', 'statistics'],
      mine: true,
    });

    const channel = response.data.items?.[0];
    if (!channel) {
      console.error(`❌ [YouTube Analytics] No channel found for ${brand}`);
      return null;
    }

    return {
      channelId: channel.id || '',
      channelTitle: channel.snippet?.title || '',
      subscriberCount: parseInt(channel.statistics?.subscriberCount || '0', 10),
      videoCount: parseInt(channel.statistics?.videoCount || '0', 10),
      viewCount: parseInt(channel.statistics?.viewCount || '0', 10),
      fetchedAt: Date.now(),
    };
  } catch (error) {
    console.error(`❌ [YouTube Analytics] Error fetching channel info for ${brand}:`, error);
    return null;
  }
}

/**
 * Get video statistics by video ID
 */
export async function getVideoStats(
  brand: string,
  videoId: string
): Promise<YouTubeVideoStats | null> {
  const credentials = getYouTubeCredentials(brand);
  if (!credentials) return null;

  try {
    const auth = getOAuth2Client(credentials);

    const response = await youtube.videos.list({
      auth,
      part: ['snippet', 'statistics', 'contentDetails', 'status'],
      id: [videoId],
    });

    const video = response.data.items?.[0];
    if (!video) {
      console.error(`❌ [YouTube Analytics] Video ${videoId} not found`);
      return null;
    }

    const viewCount = parseInt(video.statistics?.viewCount || '0', 10);
    const likeCount = parseInt(video.statistics?.likeCount || '0', 10);
    const commentCount = parseInt(video.statistics?.commentCount || '0', 10);
    const durationSeconds = parseDuration(video.contentDetails?.duration || 'PT0S');

    // Calculate engagement rate
    const engagementRate = viewCount > 0
      ? ((likeCount + commentCount) / viewCount) * 100
      : 0;

    // Determine if it's a Short (vertical, < 60 seconds)
    const isShort = durationSeconds <= 60;

    return {
      videoId: video.id || videoId,
      title: video.snippet?.title || '',
      publishedAt: video.snippet?.publishedAt || '',
      channelId: video.snippet?.channelId || '',
      channelTitle: video.snippet?.channelTitle || '',
      description: video.snippet?.description || '',
      thumbnailUrl: video.snippet?.thumbnails?.high?.url,
      tags: video.snippet?.tags,
      viewCount,
      likeCount,
      commentCount,
      engagementRate,
      duration: video.contentDetails?.duration || '',
      durationSeconds,
      isShort,
      privacyStatus: video.status?.privacyStatus || 'unknown',
      fetchedAt: Date.now(),
    };
  } catch (error) {
    console.error(`❌ [YouTube Analytics] Error fetching video ${videoId}:`, error);
    return null;
  }
}

/**
 * Get recent videos from channel with stats
 */
export async function getRecentVideos(
  brand: string,
  maxResults: number = 50
): Promise<YouTubeVideoStats[]> {
  const credentials = getYouTubeCredentials(brand);
  if (!credentials) return [];

  try {
    const auth = getOAuth2Client(credentials);

    // First, get the channel's uploads playlist
    const channelResponse = await youtube.channels.list({
      auth,
      part: ['contentDetails'],
      mine: true,
    });

    const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.error(`❌ [YouTube Analytics] No uploads playlist found for ${brand}`);
      return [];
    }

    // Get videos from uploads playlist
    const playlistResponse = await youtube.playlistItems.list({
      auth,
      part: ['snippet', 'contentDetails'],
      playlistId: uploadsPlaylistId,
      maxResults,
    });

    const videoIds = playlistResponse.data.items
      ?.map(item => item.contentDetails?.videoId)
      .filter((id): id is string => !!id) || [];

    if (videoIds.length === 0) {
      return [];
    }

    // Get detailed stats for each video (batch request)
    const videosResponse = await youtube.videos.list({
      auth,
      part: ['snippet', 'statistics', 'contentDetails', 'status'],
      id: videoIds,
    });

    const videos: YouTubeVideoStats[] = [];

    for (const video of videosResponse.data.items || []) {
      const viewCount = parseInt(video.statistics?.viewCount || '0', 10);
      const likeCount = parseInt(video.statistics?.likeCount || '0', 10);
      const commentCount = parseInt(video.statistics?.commentCount || '0', 10);
      const durationSeconds = parseDuration(video.contentDetails?.duration || 'PT0S');

      const engagementRate = viewCount > 0
        ? ((likeCount + commentCount) / viewCount) * 100
        : 0;

      videos.push({
        videoId: video.id || '',
        title: video.snippet?.title || '',
        publishedAt: video.snippet?.publishedAt || '',
        channelId: video.snippet?.channelId || '',
        channelTitle: video.snippet?.channelTitle || '',
        description: video.snippet?.description || '',
        thumbnailUrl: video.snippet?.thumbnails?.high?.url,
        tags: video.snippet?.tags,
        viewCount,
        likeCount,
        commentCount,
        engagementRate,
        duration: video.contentDetails?.duration || '',
        durationSeconds,
        isShort: durationSeconds <= 60,
        privacyStatus: video.status?.privacyStatus || 'unknown',
        fetchedAt: Date.now(),
      });
    }

    // Sort by published date (newest first)
    videos.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    return videos;
  } catch (error) {
    console.error(`❌ [YouTube Analytics] Error fetching recent videos for ${brand}:`, error);
    return [];
  }
}

/**
 * Get comprehensive analytics summary for a brand
 */
export async function getAnalyticsSummary(
  brand: string
): Promise<YouTubeAnalyticsSummary | null> {
  console.log(`📊 [YouTube Analytics] Fetching summary for ${brand}...`);

  // Get channel info
  const channelStats = await getChannelInfo(brand);
  if (!channelStats) {
    return null;
  }

  // Get recent videos
  const recentVideos = await getRecentVideos(brand, 50);

  // Calculate aggregated metrics
  let totalRecentViews = 0;
  let totalRecentLikes = 0;
  let totalRecentComments = 0;
  let totalEngagement = 0;

  for (const video of recentVideos) {
    totalRecentViews += video.viewCount;
    totalRecentLikes += video.likeCount;
    totalRecentComments += video.commentCount;
    totalEngagement += video.engagementRate;
  }

  const avgViewsPerVideo = recentVideos.length > 0
    ? totalRecentViews / recentVideos.length
    : 0;

  const avgEngagementRate = recentVideos.length > 0
    ? totalEngagement / recentVideos.length
    : 0;

  // Top performers by views
  const topByViews = [...recentVideos]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 10);

  // Top performers by engagement
  const topByEngagement = [...recentVideos]
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 10);

  console.log(`✅ [YouTube Analytics] Summary complete for ${brand}`);
  console.log(`   Channel: ${channelStats.channelTitle}`);
  console.log(`   Subscribers: ${channelStats.subscriberCount.toLocaleString()}`);
  console.log(`   Recent videos analyzed: ${recentVideos.length}`);
  console.log(`   Avg views/video: ${avgViewsPerVideo.toFixed(0)}`);
  console.log(`   Avg engagement: ${avgEngagementRate.toFixed(2)}%`);

  return {
    brand,
    channelId: channelStats.channelId,
    channelTitle: channelStats.channelTitle,
    totalSubscribers: channelStats.subscriberCount,
    totalViews: channelStats.viewCount,
    totalVideos: channelStats.videoCount,
    recentVideos,
    topByViews,
    topByEngagement,
    avgViewsPerVideo,
    avgEngagementRate,
    totalRecentViews,
    totalRecentLikes,
    totalRecentComments,
    fetchedAt: Date.now(),
  };
}

/**
 * Clean object by removing undefined values (Firestore doesn't accept undefined)
 */
function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item));
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Save YouTube analytics to Firestore
 */
export async function saveYouTubeAnalytics(
  brand: string,
  summary: YouTubeAnalyticsSummary
): Promise<void> {
  try {
    const adminDb = await getAdminDb();
    if (!adminDb) {
      console.error('❌ Firebase Admin not initialized');
      return;
    }

    // Clean data for Firestore (remove undefined values)
    const cleanedSummary = cleanForFirestore({
      ...summary,
      recentVideos: summary.recentVideos.slice(0, 20), // Limit stored videos
      topByViews: summary.topByViews.slice(0, 10),
      topByEngagement: summary.topByEngagement.slice(0, 10),
      updatedAt: Date.now(),
    });

    // Save channel summary
    await (adminDb as any).collection('youtube_analytics').doc(brand).set(cleanedSummary);

    // Save individual video stats
    const batch = (adminDb as any).batch();

    for (const video of summary.recentVideos) {
      const videoRef = (adminDb as any)
        .collection('youtube_analytics')
        .doc(brand)
        .collection('videos')
        .doc(video.videoId);

      const cleanedVideo = cleanForFirestore({
        ...video,
        brand,
        updatedAt: Date.now(),
      });

      batch.set(videoRef, cleanedVideo, { merge: true });
    }

    await batch.commit();

    console.log(`✅ [YouTube Analytics] Saved analytics for ${brand} to Firestore`);
  } catch (error) {
    console.error(`❌ [YouTube Analytics] Error saving to Firestore:`, error);
  }
}

/**
 * Sync YouTube analytics for a brand
 */
export async function syncYouTubeAnalytics(brand: string): Promise<YouTubeAnalyticsSummary | null> {
  const summary = await getAnalyticsSummary(brand);

  if (summary) {
    await saveYouTubeAnalytics(brand, summary);
  }

  return summary;
}

/**
 * Sync YouTube analytics for all brands
 */
export async function syncAllYouTubeAnalytics(): Promise<Map<string, YouTubeAnalyticsSummary | null>> {
  const brands = ['abdullah', 'ownerfi', 'carz'];
  const results = new Map<string, YouTubeAnalyticsSummary | null>();

  for (const brand of brands) {
    try {
      const summary = await syncYouTubeAnalytics(brand);
      results.set(brand, summary);
    } catch (error) {
      console.error(`❌ Error syncing ${brand}:`, error);
      results.set(brand, null);
    }
  }

  return results;
}

/**
 * Analyze top performing content patterns
 */
export function analyzeContentPatterns(videos: YouTubeVideoStats[]): {
  bestHooks: string[];
  bestPostingTimes: { hour: number; avgViews: number }[];
  avgDuration: number;
  shortsVsLongForm: { shorts: { count: number; avgViews: number }; longForm: { count: number; avgViews: number } };
} {
  // Extract hooks (first ~50 chars of title)
  const topVideos = [...videos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 10);
  const bestHooks = topVideos.map(v => v.title.substring(0, 50));

  // Analyze posting times
  const hourStats = new Map<number, { views: number; count: number }>();
  for (const video of videos) {
    const hour = new Date(video.publishedAt).getHours();
    const current = hourStats.get(hour) || { views: 0, count: 0 };
    hourStats.set(hour, {
      views: current.views + video.viewCount,
      count: current.count + 1,
    });
  }

  const bestPostingTimes = Array.from(hourStats.entries())
    .map(([hour, stats]) => ({
      hour,
      avgViews: stats.count > 0 ? stats.views / stats.count : 0,
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 5);

  // Average duration
  const totalDuration = videos.reduce((sum, v) => sum + v.durationSeconds, 0);
  const avgDuration = videos.length > 0 ? totalDuration / videos.length : 0;

  // Shorts vs long form
  const shorts = videos.filter(v => v.isShort);
  const longForm = videos.filter(v => !v.isShort);

  const shortsVsLongForm = {
    shorts: {
      count: shorts.length,
      avgViews: shorts.length > 0
        ? shorts.reduce((sum, v) => sum + v.viewCount, 0) / shorts.length
        : 0,
    },
    longForm: {
      count: longForm.length,
      avgViews: longForm.length > 0
        ? longForm.reduce((sum, v) => sum + v.viewCount, 0) / longForm.length
        : 0,
    },
  };

  return {
    bestHooks,
    bestPostingTimes,
    avgDuration,
    shortsVsLongForm,
  };
}

export default {
  getChannelInfo,
  getVideoStats,
  getRecentVideos,
  getAnalyticsSummary,
  saveYouTubeAnalytics,
  syncYouTubeAnalytics,
  syncAllYouTubeAnalytics,
  analyzeContentPatterns,
};
