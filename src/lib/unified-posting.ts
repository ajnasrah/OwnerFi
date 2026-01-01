/**
 * Unified Social Media Posting
 *
 * Posts to multiple platforms:
 * - YouTube: Direct API for immediate posting + Late.dev for scheduling
 * - Other platforms: Late.dev API (Instagram, TikTok, Facebook, LinkedIn)
 */

import { postToLate, type LatePostRequest, type LatePostResponse } from './late-api';
import { postVideoToYouTube, type YouTubeUploadResult } from './youtube-api';

interface UnifiedPostOptions {
  videoUrl: string;
  caption: string;
  title: string;
  platforms: ('instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'threads' | 'twitter')[];
  brand: 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza';
  hashtags?: string[];
  useQueue?: boolean;
  timezone?: string;
  firstComment?: string;

  // YouTube-specific options
  youtubeCategory?: string;
  youtubeMadeForKids?: boolean;
  youtubePrivacy?: 'public' | 'unlisted' | 'private';
  youtubeUseSchedule?: boolean; // If true, use schedule slots for YouTube

  // Idempotency - skip if already posted
  existingYoutubeVideoId?: string; // If set, skip YouTube upload
  existingLatePostId?: string; // If set, skip Late.dev posting
}

interface UnifiedPostResult {
  success: boolean;
  youtube?: {
    success: boolean;
    videoId?: string;
    videoUrl?: string;
    error?: string;
  };
  otherPlatforms?: {
    success: boolean;
    postId?: string;
    platforms?: string[];
    error?: string;
  };
  totalPublished: number;
  errors: string[];
}

/**
 * Post video to all platforms
 * - YouTube: Direct API ONLY (once)
 * - Other platforms: Late.dev (excludes YouTube)
 * - Stores both YouTube videoId AND Late.dev postId
 */
export async function postToAllPlatforms(options: UnifiedPostOptions): Promise<UnifiedPostResult> {
  const result: UnifiedPostResult = {
    success: false,
    totalPublished: 0,
    errors: [],
  };

  console.log(`\n📤 [UNIFIED] Posting for ${options.brand}...`);
  console.log(`   Platforms requested: ${options.platforms.join(', ')}`);
  console.log(`   Video URL: ${options.videoUrl.substring(0, 80)}...`);
  console.log(`   Title: ${options.title}`);

  const hasYouTube = options.platforms.includes('youtube');
  // Remove YouTube from Late.dev platforms - we handle it directly
  const latePlatforms = options.platforms.filter(p => p !== 'youtube') as any[];

  console.log(`   YouTube (direct API): ${hasYouTube ? 'YES' : 'NO'}`);
  console.log(`   Late.dev platforms: ${latePlatforms.join(', ') || 'none'}`);

  // Step 1: Upload to YouTube via DIRECT API (only once)
  if (hasYouTube) {
    // IDEMPOTENCY CHECK: Skip if already uploaded
    if (options.existingYoutubeVideoId) {
      console.log(`\n📺 Step 1: YouTube SKIPPED - already uploaded (${options.existingYoutubeVideoId})`);
      result.youtube = {
        success: true,
        videoId: options.existingYoutubeVideoId,
        videoUrl: `https://youtube.com/shorts/${options.existingYoutubeVideoId}`,
      };
      result.totalPublished++;
    } else {
      console.log(`\n📺 Step 1: Uploading to YouTube (direct API)...`);

      try {
        const youtubeResult = await postVideoToYouTube(
          options.videoUrl,
          options.title,
          options.caption,
          options.brand,
          {
            tags: options.hashtags,
            category: options.youtubeCategory,
            privacy: options.youtubePrivacy || 'public',
            madeForKids: options.youtubeMadeForKids || false,
            isShort: true,
            useSchedule: options.youtubeUseSchedule,
          }
        );

        result.youtube = youtubeResult;

        if (youtubeResult.success) {
          console.log(`✅ YouTube upload successful!`);
          console.log(`   Video ID: ${youtubeResult.videoId}`);
          if (youtubeResult.scheduledAt) {
            console.log(`   📅 Scheduled for: ${youtubeResult.scheduledAt}`);
          }
          result.totalPublished++;
        } else {
          console.error(`❌ YouTube upload failed: ${youtubeResult.error}`);
          result.errors.push(`YouTube: ${youtubeResult.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ YouTube upload error:`, error);
        result.youtube = {
          success: false,
          error: errorMsg,
        };
        result.errors.push(`YouTube: ${errorMsg}`);
      }
    }
  }

  // Step 2: Post to other platforms via Late.dev (NOT YouTube)
  if (latePlatforms.length > 0) {
    // IDEMPOTENCY CHECK: Skip if already posted
    if (options.existingLatePostId) {
      console.log(`\n📱 Step 2: Late.dev SKIPPED - already posted (${options.existingLatePostId})`);
      result.otherPlatforms = {
        success: true,
        postId: options.existingLatePostId,
        platforms: latePlatforms,
      };
      result.totalPublished += latePlatforms.length;
    } else {
      console.log(`\n📱 Step 2: Posting to Late.dev...`);
      console.log(`   Platforms: ${latePlatforms.join(', ')}`);

      try {
        const lateResult = await postToLate({
          videoUrl: options.videoUrl,
          caption: options.caption,
          title: options.title,
          platforms: latePlatforms,
          brand: options.brand,
          hashtags: options.hashtags,
          useQueue: options.useQueue,
          timezone: options.timezone,
          firstComment: options.firstComment,
        });

        result.otherPlatforms = {
          success: lateResult.success,
          postId: lateResult.postId,
          platforms: lateResult.platforms,
          error: lateResult.error,
        };

        if (lateResult.success) {
          const publishedCount = lateResult.platforms?.length || 0;
          console.log(`✅ Late.dev posting successful!`);
          console.log(`   Post ID: ${lateResult.postId}`);
          console.log(`   Platforms queued: ${publishedCount}`);
          result.totalPublished += publishedCount;
        } else {
          console.error(`❌ Late.dev posting failed: ${lateResult.error}`);
          result.errors.push(`Late.dev: ${lateResult.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Late.dev posting error:`, error);
        result.otherPlatforms = {
          success: false,
          error: errorMsg,
        };
        result.errors.push(`Late.dev: ${errorMsg}`);
      }
    }
  }

  // Determine overall success
  result.success = result.totalPublished > 0 || (result.youtube?.success ?? false);

  console.log(`\n📊 Posting Summary:`);
  console.log(`   YouTube: ${result.youtube?.success ? `✅ (${result.youtube.videoId})` : '❌'}`);
  console.log(`   Late.dev: ${result.otherPlatforms?.success ? `✅ (${result.otherPlatforms.postId})` : '❌'}`);
  console.log(`   Total platforms: ${result.totalPublished}`);
  if (result.errors.length > 0) {
    console.log(`   Errors: ${result.errors.join(', ')}`);
  }

  return result;
}

/**
 * Get YouTube category for a brand
 */
export function getYouTubeCategoryForBrand(brand: string): string {
  const categoryMap: Record<string, string> = {
    'carz': 'Autos & Vehicles',
    'ownerfi': 'Howto & Style',
    'benefit': 'Howto & Style',
    'abdullah': 'People & Blogs',
    'personal': 'People & Blogs',
    'gaza': 'News & Politics',
  };

  return categoryMap[brand] || 'People & Blogs';
}
