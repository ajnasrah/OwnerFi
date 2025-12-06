/**
 * Direct YouTube API Integration
 * Bypasses Late.dev to avoid quota limits
 * Uses YouTube Data API v3 for direct uploads
 */

import { google } from 'googleapis';
import { fetchWithTimeout, TIMEOUTS } from './api-utils';

const youtube = google.youtube('v3');

interface YouTubeCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface YouTubeUploadOptions {
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  category?: string;
  privacy?: 'public' | 'unlisted' | 'private';
  madeForKids?: boolean;
  isShort?: boolean;
  brand: 'carz' | 'ownerfi' | 'podcast' | 'property' | 'property-spanish' | 'vassdistro' | 'benefit' | 'abdullah' | 'personal' | 'gaza';
  // Scheduling options
  publishAt?: string; // ISO 8601 datetime for scheduled publishing
  useSchedule?: boolean; // If true, auto-pick next available slot from brand schedule
}

interface YouTubeUploadResult {
  success: boolean;
  videoId?: string;
  videoUrl?: string;
  error?: string;
  scheduledAt?: string; // ISO datetime if scheduled
}

/**
 * Get YouTube credentials for a brand
 * Supports both shared credentials (recommended) and brand-specific credentials
 */
function getYouTubeCredentials(brand: string): YouTubeCredentials | null {
  const brandUpper = brand.toUpperCase();

  console.log(`🔍 [YouTube] Getting credentials for ${brand}...`);

  // Try shared credentials first (recommended setup)
  let clientId = process.env.YOUTUBE_CLIENT_ID;
  let clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  console.log(`🔍 [YouTube] Shared CLIENT_ID: ${clientId ? 'SET' : 'MISSING'}`);
  console.log(`🔍 [YouTube] Shared CLIENT_SECRET: ${clientSecret ? 'SET' : 'MISSING'}`);

  // Fall back to brand-specific credentials if shared ones don't exist
  if (!clientId || !clientSecret) {
    clientId = process.env[`YOUTUBE_${brandUpper}_CLIENT_ID`];
    clientSecret = process.env[`YOUTUBE_${brandUpper}_CLIENT_SECRET`];
    console.log(`🔍 [YouTube] Brand-specific CLIENT_ID: ${clientId ? 'SET' : 'MISSING'}`);
    console.log(`🔍 [YouTube] Brand-specific CLIENT_SECRET: ${clientSecret ? 'SET' : 'MISSING'}`);
  }

  // Refresh token is always brand-specific (one per YouTube channel)
  const refreshToken = process.env[`YOUTUBE_${brandUpper}_REFRESH_TOKEN`];
  console.log(`🔍 [YouTube] ${brandUpper} REFRESH_TOKEN: ${refreshToken ? 'SET (first 20 chars: ' + refreshToken.substring(0, 20) + '...)' : 'MISSING'}`);

  if (!clientId || !clientSecret || !refreshToken) {
    console.error(`❌ [YouTube] Missing credentials for ${brand}`);
    console.error(`   Shared CLIENT_ID: ${!!process.env.YOUTUBE_CLIENT_ID}`);
    console.error(`   Shared CLIENT_SECRET: ${!!process.env.YOUTUBE_CLIENT_SECRET}`);
    console.error(`   Brand REFRESH_TOKEN (YOUTUBE_${brandUpper}_REFRESH_TOKEN): ${!!refreshToken}`);
    console.error(`   Option 1 (Recommended - Shared): Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_${brandUpper}_REFRESH_TOKEN`);
    console.error(`   Option 2 (Per-brand): Set YOUTUBE_${brandUpper}_CLIENT_ID, YOUTUBE_${brandUpper}_CLIENT_SECRET, YOUTUBE_${brandUpper}_REFRESH_TOKEN`);
    return null;
  }

  console.log(`✅ [YouTube] Credentials found for ${brand}`);
  return { clientId, clientSecret, refreshToken };
}

/**
 * Get OAuth2 client for YouTube API
 */
function getOAuth2Client(credentials: YouTubeCredentials) {
  const oauth2Client = new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    'https://developers.google.com/oauthplayground' // Redirect URI (if using OAuth playground)
  );

  oauth2Client.setCredentials({
    refresh_token: credentials.refreshToken,
  });

  return oauth2Client;
}

/**
 * Get YouTube category ID by name
 */
function getCategoryId(categoryName?: string): string {
  const categories: Record<string, string> = {
    'Autos & Vehicles': '2',
    'Education': '27',
    'Entertainment': '24',
    'Film & Animation': '1',
    'Gaming': '20',
    'Howto & Style': '26',
    'Music': '10',
    'News & Politics': '25',
    'Nonprofits & Activism': '29',
    'People & Blogs': '22',
    'Pets & Animals': '15',
    'Science & Technology': '28',
    'Sports': '17',
    'Travel & Events': '19',
  };

  return categories[categoryName || 'People & Blogs'] || '22';
}

/**
 * Download video from URL to buffer
 */
async function downloadVideo(videoUrl: string): Promise<Buffer> {
  console.log(`   📥 Downloading video from: ${videoUrl.substring(0, 80)}...`);

  const response = await fetchWithTimeout(videoUrl, {}, TIMEOUTS.VIDEO_DOWNLOAD);

  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`   ✅ Video downloaded: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  return buffer;
}

/**
 * Upload video directly to YouTube
 */
export async function uploadToYouTube(options: YouTubeUploadOptions): Promise<YouTubeUploadResult> {
  try {
    console.log(`📺 Uploading to YouTube (${options.brand})...`);

    // Get credentials for this brand
    const credentials = getYouTubeCredentials(options.brand);
    if (!credentials) {
      return {
        success: false,
        error: `YouTube credentials not configured for ${options.brand}`
      };
    }

    // Create OAuth2 client
    const auth = getOAuth2Client(credentials);

    // Download video
    const videoBuffer = await downloadVideo(options.videoUrl);

    // Prepare video metadata
    const categoryId = getCategoryId(options.category);

    const snippet: any = {
      title: options.title.substring(0, 100), // YouTube max 100 chars
      description: options.description.substring(0, 5000), // YouTube max 5000 chars
      categoryId,
    };

    if (options.tags && options.tags.length > 0) {
      // YouTube max 500 chars total for all tags, max 30 tags
      snippet.tags = options.tags.slice(0, 30).map(tag =>
        tag.replace(/^#/, '').substring(0, 30)
      );
    }

    // Determine publish time and privacy status
    let publishAt: string | undefined;
    let scheduledSlotIndex: number | undefined;

    if (options.useSchedule) {
      // Auto-pick next available slot from brand schedule
      const { getNextScheduledTime, markSlotUsed } = await import('./youtube-schedule');
      const nextSlot = getNextScheduledTime(options.brand);

      if (nextSlot) {
        publishAt = nextSlot.publishAt;
        scheduledSlotIndex = nextSlot.slotIndex;
        console.log(`   📅 Auto-scheduled for: ${publishAt}`);
      } else {
        console.log(`   ⚠️ No available slots, posting immediately`);
      }
    } else if (options.publishAt) {
      // Use provided publish time
      publishAt = options.publishAt;
      console.log(`   📅 Scheduled for: ${publishAt}`);
    }

    // If scheduling, must use 'private' initially, then YouTube publishes at publishAt
    const status: any = {
      privacyStatus: publishAt ? 'private' : (options.privacy || 'public'),
      selfDeclaredMadeForKids: options.madeForKids || false,
    };

    if (publishAt) {
      status.publishAt = publishAt;
      status.privacyStatus = 'private'; // Required for scheduled videos
    }

    // NOTE: YouTube automatically categorizes vertical videos <60s as Shorts
    // No need to add #Shorts to title - it's redundant and wastes characters

    console.log(`   Title: ${snippet.title}`);
    console.log(`   Category: ${options.category || 'People & Blogs'}`);
    console.log(`   Privacy: ${status.privacyStatus}${publishAt ? ' (scheduled)' : ''}`);
    console.log(`   Is Short: ${options.isShort ? 'Yes' : 'No'}`);

    // Upload video
    console.log(`   🚀 Uploading to YouTube API...`);

    const response = await youtube.videos.insert({
      auth,
      part: ['snippet', 'status'],
      requestBody: {
        snippet,
        status,
      },
      media: {
        body: require('stream').Readable.from(videoBuffer),
      },
    });

    const videoId = response.data.id;
    if (!videoId) {
      throw new Error('YouTube API did not return video ID');
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log(`   ✅ Uploaded successfully!`);
    console.log(`   Video ID: ${videoId}`);
    console.log(`   URL: ${videoUrl}`);
    if (publishAt) {
      console.log(`   📅 Scheduled to publish: ${publishAt}`);
    }

    // Mark slot as used if we auto-scheduled
    if (options.useSchedule && scheduledSlotIndex !== undefined) {
      const { markSlotUsed } = await import('./youtube-schedule');
      markSlotUsed(options.brand, scheduledSlotIndex);
      console.log(`   ✅ Marked slot ${scheduledSlotIndex} as used`);
    }

    // Track cost
    try {
      const { trackCost } = await import('@/lib/cost-tracker');
      await trackCost(
        options.brand,
        'youtube',
        'video_upload',
        1,
        0, // YouTube API is free (quota-based)
        undefined
      );
      console.log(`💰 [${options.brand}] Tracked YouTube upload cost: $0.00 (quota-based)`);
    } catch (costError) {
      console.error(`⚠️  Failed to track YouTube cost:`, costError);
    }

    return {
      success: true,
      videoId,
      videoUrl,
      scheduledAt: publishAt,
    };

  } catch (error) {
    console.error('❌ YouTube upload error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific YouTube errors
    if (errorMessage.includes('quota')) {
      return {
        success: false,
        error: 'YouTube quota exceeded. Try again tomorrow.',
      };
    }

    if (errorMessage.includes('authentication') || errorMessage.includes('credentials')) {
      return {
        success: false,
        error: 'YouTube authentication failed. Check credentials.',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Helper function to post video to YouTube with retries
 */
export async function postVideoToYouTube(
  videoUrl: string,
  title: string,
  description: string,
  brand: 'carz' | 'ownerfi' | 'podcast' | 'property' | 'property-spanish' | 'vassdistro' | 'benefit' | 'abdullah' | 'personal' | 'gaza',
  options?: {
    tags?: string[];
    category?: string;
    privacy?: 'public' | 'unlisted' | 'private';
    madeForKids?: boolean;
    isShort?: boolean;
    publishAt?: string; // ISO 8601 datetime for scheduled publishing
    useSchedule?: boolean; // If true, auto-pick next available slot from brand schedule
  }
): Promise<YouTubeUploadResult> {
  // Retry logic
  const maxRetries = 2;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      console.log(`   Retry attempt ${attempt}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
    }

    const result = await uploadToYouTube({
      videoUrl,
      title,
      description,
      brand,
      tags: options?.tags,
      category: options?.category,
      privacy: options?.privacy,
      madeForKids: options?.madeForKids,
      isShort: options?.isShort ?? true, // Default to Shorts
      publishAt: options?.publishAt,
      useSchedule: options?.useSchedule,
    });

    if (result.success) {
      return result;
    }

    lastError = result.error;

    // Don't retry on quota errors
    if (result.error?.includes('quota')) {
      break;
    }
  }

  return {
    success: false,
    error: lastError || 'Upload failed after retries',
  };
}

// Re-export types and schedule functions for convenience
export type { YouTubeUploadResult };
export { getNextScheduledTime, getAvailableSlotsToday, getScheduleInfo, getAllSchedules } from './youtube-schedule';
