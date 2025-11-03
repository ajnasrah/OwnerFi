/**
 * Same-Day Multi-Platform Posting System
 *
 * Posts the SAME video to ALL brand platforms on the SAME DAY
 * Each platform posts at its optimal hour for that specific day
 *
 * Example: Video posted on Monday:
 * - TikTok: Monday 7 AM
 * - Instagram: Monday 11 AM
 * - YouTube: Monday 3 PM
 * - Facebook: Monday 1 PM
 * - LinkedIn: Monday 10 AM
 * etc.
 */

import { Brand } from '@/config/constants';
import { getBrandPlatforms } from '@/lib/brand-utils';
import { postToLate, LatePostRequest, LatePostResponse } from '@/lib/late-api';
import {
  getAllPlatformTimesForDay,
  getScheduleDescriptionForDay,
  type Platform
} from './same-day-platform-scheduler';

/**
 * Post a video to all brand platforms on the SAME DAY at optimal hours
 *
 * @param videoUrl - URL of the video to post
 * @param caption - Post caption
 * @param title - Video title
 * @param brand - Brand identifier
 * @param options - Additional posting options
 * @param targetDate - Date to post on (defaults to today). All platforms will post on this date at their optimal hours.
 * @returns Results of all posts created
 */
export async function postVideoSameDay(
  videoUrl: string,
  caption: string,
  title: string,
  brand: Brand,
  options?: {
    firstComment?: string;
    hashtags?: string[];
    postTypes?: LatePostRequest['postTypes'];
    targetDate?: Date; // Date to post on (defaults to today)
  }
): Promise<{
  success: boolean;
  posts: Array<{
    platform: string;
    scheduledFor: string;
    result: LatePostResponse;
  }>;
  totalPosts: number;
  errors: string[];
}> {
  const brandPlatforms = getBrandPlatforms(brand, false) as Platform[];
  const targetDate = options?.targetDate || new Date();
  const dayOfWeek = targetDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  const allPosts: Array<{
    platform: string;
    scheduledFor: string;
    result: LatePostResponse;
  }> = [];
  const errors: string[] = [];

  console.log(`📅 Scheduling same-day posts for ${brand} to ${brandPlatforms.length} platforms`);
  console.log(`   Target date: ${targetDate.toDateString()}`);
  console.log(`   Schedule: ${getScheduleDescriptionForDay(brandPlatforms, dayOfWeek)}\n`);

  // Get optimal posting times for all platforms on the target date
  const platformTimes = getAllPlatformTimesForDay(brandPlatforms, targetDate);

  // Create posts for each platform at its optimal time
  for (const platform of brandPlatforms) {
    const scheduledFor = platformTimes.get(platform)!.toISOString();
    const hour = platformTimes.get(platform)!.getHours();
    const timeStr = `${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;

    console.log(`📱 ${platform.toUpperCase()}: ${timeStr}`);

    try {
      // Create the post
      const result = await postToLate({
        videoUrl,
        caption,
        title,
        brand,
        platforms: [platform],
        scheduledFor,
        postTypes: options?.postTypes,
        firstComment: options?.firstComment,
        hashtags: options?.hashtags
      });

      if (result.success) {
        allPosts.push({
          platform,
          scheduledFor,
          result
        });
        console.log(`   ✅ Scheduled (Post ID: ${result.postId})`);
      } else {
        errors.push(`${platform}: ${result.error}`);
        console.log(`   ❌ Failed: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${platform}: ${errorMsg}`);
      console.log(`   ❌ Error: ${errorMsg}`);
    }

    // Rate limit: wait 1 second between posts
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log();
  const success = allPosts.length > 0;

  console.log(`${'='.repeat(80)}`);
  console.log(`📊 SAME-DAY POSTING SUMMARY`);
  console.log(`   Date: ${targetDate.toDateString()}`);
  console.log(`   Posts created: ${allPosts.length}/${brandPlatforms.length}`);
  if (errors.length > 0) {
    console.log(`   Errors: ${errors.length}`);
    errors.forEach(err => console.log(`      - ${err}`));
  }
  console.log(`${'='.repeat(80)}\n`);

  return {
    success,
    posts: allPosts,
    totalPosts: allPosts.length,
    errors
  };
}

/**
 * Helper to get a preview of the posting schedule for today
 */
export function getPostingSchedulePreview(brand: Brand, targetDate: Date = new Date()): string {
  const platforms = getBrandPlatforms(brand, false) as Platform[];
  const dayOfWeek = targetDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  return getScheduleDescriptionForDay(platforms, dayOfWeek);
}
