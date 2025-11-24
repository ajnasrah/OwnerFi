/**
 * Unified Social Media Posting
 *
 * Posts to multiple platforms efficiently:
 * - YouTube: Direct API (bypasses Late.dev quota)
 * - Other platforms: Late.dev API (Instagram, TikTok, Facebook, LinkedIn)
 */

import { postToLate, type LatePostRequest, type LatePostResponse } from './late-api';
import { postVideoToYouTube, type YouTubeUploadResult } from './youtube-api';

interface UnifiedPostOptions {
  videoUrl: string;
  caption: string;
  title: string;
  platforms: ('instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'threads' | 'twitter')[];
  brand: 'carz' | 'ownerfi' | 'podcast' | 'property' | 'vassdistro' | 'benefit' | 'abdullah' | 'personal';
  hashtags?: string[];
  useQueue?: boolean;
  timezone?: string;
  firstComment?: string;

  // YouTube-specific options
  youtubeCategory?: string;
  youtubeMadeForKids?: boolean;
  youtubePrivacy?: 'public' | 'unlisted' | 'private';
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
 * Post video to all platforms with YouTube direct upload
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

  // Separate YouTube from other platforms
  const hasYouTube = options.platforms.includes('youtube');
  const otherPlatforms = options.platforms.filter(p => p !== 'youtube') as any[];

  console.log(`   Has YouTube: ${hasYouTube ? 'YES' : 'NO'}`);
  console.log(`   Other platforms: ${otherPlatforms.join(', ')}`);

  // Step 1: Upload to YouTube directly (if requested)
  if (hasYouTube) {
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
          isShort: true, // All short-form videos
        }
      );

      result.youtube = youtubeResult;

      if (youtubeResult.success) {
        console.log(`✅ YouTube upload successful!`);
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

  // Step 2: Post to other platforms via Late.dev (if any)
  if (otherPlatforms.length > 0) {
    console.log(`\n📱 Step 2: Posting to other platforms via Late.dev...`);
    console.log(`   Platforms: ${otherPlatforms.join(', ')}`);

    try {
      const lateResult = await postToLate({
        videoUrl: options.videoUrl,
        caption: options.caption,
        title: options.title,
        platforms: otherPlatforms,
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
        console.log(`✅ Late.dev posting successful! Published to ${publishedCount} platforms`);
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

  // Determine overall success
  result.success = result.totalPublished > 0;

  console.log(`\n📊 Posting Summary:`);
  console.log(`   Total platforms published: ${result.totalPublished}/${options.platforms.length}`);
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
    'property': 'Howto & Style',
    'podcast': 'Education',
    'benefit': 'Howto & Style',
    'abdullah': 'People & Blogs',
    'personal': 'People & Blogs',
    'vassdistro': 'People & Blogs',
  };

  return categoryMap[brand] || 'People & Blogs';
}
