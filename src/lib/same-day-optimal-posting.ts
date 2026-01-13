/**
 * Same-Day Optimal Platform Posting
 *
 * Posts to each platform at its top performing hour TODAY.
 * - YouTube: Direct API (bypasses Late.dev quota limits)
 * - Other platforms: Late's queue system
 */

import { Brand } from '@/config/constants';
import { getBrandPlatforms } from '@/lib/brand-utils';
import { postToLate, LatePostRequest, LatePostResponse } from '@/lib/late-api';
import { postVideoToYouTube, type YouTubeUploadResult } from '@/lib/youtube-api';
import { getYouTubeCategoryForBrand } from '@/lib/unified-posting';
import { PLATFORM_OPTIMAL_HOURS } from '@/config/platform-optimal-times';

type Platform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'twitter' | 'threads';

/**
 * Get the TOP performing hour for a platform (the first in the list = best)
 */
function getBestHourForPlatform(platform: string): number {
  const hours = PLATFORM_OPTIMAL_HOURS[platform.toLowerCase()];
  // Return the LAST hour (evening prime time) as it's typically the best
  return hours ? hours[hours.length - 1] : 19; // Default to 7 PM
}

/**
 * Get today's datetime for a specific hour in CST
 */
function getTodayAtHour(hour: number): Date {
  const now = new Date();

  // Get current CST time
  const cstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));

  // Create a new date for today at the specified hour in CST
  const scheduled = new Date(cstNow);
  scheduled.setHours(hour, 0, 0, 0);

  // If the hour has already passed today, schedule for tomorrow
  if (scheduled <= cstNow) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  return scheduled;
}

/**
 * Post video to each platform at its optimal time TODAY
 *
 * Creates separate posts for each platform at their best performing hours:
 * - Instagram: 7 PM CST (peak engagement)
 * - TikTok: 7 PM CST (prime evening)
 * - YouTube: 8 PM CST (prime viewing) - via DIRECT API (not Late.dev)
 *
 * @param videoUrl - URL of the video to post
 * @param caption - Post caption
 * @param title - Video title
 * @param brand - Brand identifier
 * @returns Results of all platform posts
 */
export async function postVideoSameDayOptimal(
  videoUrl: string,
  caption: string,
  title: string,
  brand: Brand
): Promise<{
  success: boolean;
  posts: Array<{
    platform: string;
    scheduledFor: string;
    scheduledHour: number;
    result: LatePostResponse;
  }>;
  youtube?: {
    success: boolean;
    videoId?: string;
    videoUrl?: string;
    error?: string;
  };
  totalPosts: number;
  errors: string[];
}> {
  const brandPlatforms = getBrandPlatforms(brand, false) as Platform[];

  // Separate YouTube from other platforms - YouTube uses direct API
  const hasYouTube = brandPlatforms.includes('youtube');
  const latePlatforms = brandPlatforms.filter(p => p !== 'youtube');

  const allPosts: Array<{
    platform: string;
    scheduledFor: string;
    scheduledHour: number;
    result: LatePostResponse;
  }> = [];
  const errors: string[] = [];
  let youtubeResult: YouTubeUploadResult | undefined;

  console.log(`📅 Scheduling same-day optimal posts for ${brand}`);
  console.log(`   YouTube (direct API): ${hasYouTube ? 'YES' : 'NO'}`);
  console.log(`   Late.dev platforms: ${latePlatforms.join(', ') || 'none'}`);

  // Step 1: Post to YouTube via DIRECT API (bypasses Late.dev)
  if (hasYouTube) {
    console.log(`\n📺 Step 1: Uploading to YouTube (direct API)...`);

    try {
      youtubeResult = await postVideoToYouTube(
        videoUrl,
        title,
        caption,
        brand as any,
        {
          category: getYouTubeCategoryForBrand(brand),
          privacy: 'public',
          madeForKids: false,
          isShort: true,
        }
      );

      if (youtubeResult.success) {
        console.log(`   ✅ YouTube upload successful!`);
        console.log(`   Video ID: ${youtubeResult.videoId}`);
      } else {
        const errorMsg = `YouTube: ${youtubeResult.error}`;
        errors.push(errorMsg);
        console.error(`   ❌ YouTube failed: ${youtubeResult.error}`);
      }
    } catch (error) {
      const errorMsg = `YouTube: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(`   ❌ YouTube error:`, error);
      youtubeResult = { success: false, error: errorMsg };
    }
  }

  // Step 2: Post to other platforms via Late.dev at their optimal hours
  if (latePlatforms.length > 0) {
    console.log(`\n📱 Step 2: Scheduling ${latePlatforms.length} platforms via Late.dev...`);

    for (const platform of latePlatforms) {
      const optimalHour = getBestHourForPlatform(platform);
      const scheduledTime = getTodayAtHour(optimalHour);
      const scheduledFor = scheduledTime.toISOString();

      const displayHour = optimalHour > 12 ? optimalHour - 12 : optimalHour;
      const ampm = optimalHour >= 12 ? 'PM' : 'AM';

      console.log(`   ${platform.toUpperCase()}: ${displayHour} ${ampm} CST`);

      try {
        const result = await postToLate({
          videoUrl,
          caption,
          title,
          brand,
          platforms: [platform],
          scheduleTime: scheduledFor,
          useQueue: true,
          timezone: 'America/Chicago'
        });

        if (result.success) {
          allPosts.push({
            platform,
            scheduledFor,
            scheduledHour: optimalHour,
            result
          });
          console.log(`      ✅ Scheduled successfully`);
        } else {
          const errorMsg = `${platform}: ${result.error}`;
          errors.push(errorMsg);
          console.error(`      ❌ Failed: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = `${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(`      ❌ Error:`, error);
      }
    }
  }

  // Calculate total successful posts
  const youtubeSuccess = youtubeResult?.success ? 1 : 0;
  const totalPosts = allPosts.length + youtubeSuccess;
  const success = totalPosts > 0;

  console.log(`\n📊 Results:`);
  console.log(`   YouTube: ${youtubeResult?.success ? `✅ (${youtubeResult.videoId})` : hasYouTube ? '❌' : 'N/A'}`);
  console.log(`   Late.dev: ${allPosts.length}/${latePlatforms.length} platforms`);
  console.log(`   Total successful: ${totalPosts}`);
  if (errors.length > 0) {
    console.log(`   Errors: ${errors.length}`);
  }

  return {
    success,
    posts: allPosts,
    youtube: youtubeResult ? {
      success: youtubeResult.success,
      videoId: youtubeResult.videoId,
      videoUrl: youtubeResult.videoUrl,
      error: youtubeResult.error,
    } : undefined,
    totalPosts,
    errors
  };
}
