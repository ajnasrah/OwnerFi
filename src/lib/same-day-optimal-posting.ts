/**
 * Same-Day Optimal Platform Posting
 *
 * Posts to each platform at its top performing hour TODAY using Late's queue.
 * Each platform gets a separate post scheduled for its optimal time.
 */

import { Brand } from '@/config/constants';
import { getBrandPlatforms } from '@/lib/brand-utils';
import { postToLate, LatePostRequest, LatePostResponse } from '@/lib/late-api';
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
 * - YouTube: 8 PM CST (prime viewing)
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
  totalPosts: number;
  errors: string[];
}> {
  const brandPlatforms = getBrandPlatforms(brand, false) as Platform[];
  const allPosts: Array<{
    platform: string;
    scheduledFor: string;
    scheduledHour: number;
    result: LatePostResponse;
  }> = [];
  const errors: string[] = [];

  console.log(`📅 Scheduling same-day optimal posts for ${brand} to ${brandPlatforms.length} platforms`);

  // Post to each platform at its optimal hour
  for (const platform of brandPlatforms) {
    const optimalHour = getBestHourForPlatform(platform);
    const scheduledTime = getTodayAtHour(optimalHour);
    const scheduledFor = scheduledTime.toISOString();

    const displayHour = optimalHour > 12 ? optimalHour - 12 : optimalHour;
    const ampm = optimalHour >= 12 ? 'PM' : 'AM';

    console.log(`📱 ${platform.toUpperCase()}: ${displayHour} ${ampm} CST`);
    console.log(`   Scheduled for: ${scheduledFor}`);

    try {
      const result = await postToLate({
        videoUrl,
        caption,
        title,
        brand,
        platforms: [platform],
        scheduleTime: scheduledFor,
        useQueue: true, // ✅ Use GetLate's queue system
        timezone: 'America/Chicago'
      });

      if (result.success) {
        allPosts.push({
          platform,
          scheduledFor,
          scheduledHour: optimalHour,
          result
        });
        console.log(`   ✅ Scheduled successfully`);
      } else {
        const errorMsg = `${platform}: ${result.error}`;
        errors.push(errorMsg);
        console.error(`   ❌ Failed: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = `${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(`   ❌ Error:`, error);
    }
  }

  const success = allPosts.length > 0;

  console.log(`\n📊 Results:`);
  console.log(`   Total scheduled: ${allPosts.length}/${brandPlatforms.length}`);
  if (errors.length > 0) {
    console.log(`   Errors: ${errors.length}`);
  }

  return {
    success,
    posts: allPosts,
    totalPosts: allPosts.length,
    errors
  };
}
