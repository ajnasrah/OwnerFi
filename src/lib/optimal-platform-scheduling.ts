/**
 * Optimal Platform Scheduling System
 *
 * Schedules videos to post at platform-specific optimal engagement times.
 * Same video posts to different platforms at different times based on when
 * each platform has highest engagement.
 */

import { Brand } from '@/config/constants';
import { postToLate, LatePostRequest } from '@/lib/late-api';
import {
  getPlatformTimeGroups,
  getPostingHourForVideo,
  PLATFORM_OPTIMAL_HOURS,
} from '@/config/platform-optimal-times';
import { getBrandPlatforms } from '@/lib/brand-utils';

/**
 * Create schedule time for a specific hour in CST, 24 hours from now
 *
 * @param hourCST - Hour in CST (0-23)
 * @param baseDate - Base date (defaults to now)
 * @returns ISO 8601 UTC timestamp for 24 hours from baseDate at specified hour
 */
export function createScheduleTime(hourCST: number, baseDate: Date = new Date()): string {
  // Start with tomorrow (24 hours from now)
  const tomorrow = new Date(baseDate.getTime() + (24 * 60 * 60 * 1000));

  // Format as YYYY-MM-DD in CST timezone
  const tomorrowStr = tomorrow.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // Parse the date parts (format is MM/DD/YYYY)
  const [month, day, year] = tomorrowStr.split('/');

  // Create ISO 8601 datetime string
  // Format: YYYY-MM-DDTHH:MM:SS
  const scheduleTime = `${year}-${month}-${day}T${String(hourCST).padStart(2, '0')}:00:00`;

  return scheduleTime;
}

/**
 * Schedule a single video to all platforms at their optimal times
 *
 * This creates multiple Late.dev posts for the same video:
 * - Each platform group posts at its optimal time
 * - All posts are for tomorrow (24 hours advance)
 *
 * @param videoUrl - URL of video to post
 * @param caption - Post caption
 * @param title - Video title
 * @param brand - Brand identifier
 * @param videoIndex - Index of this video (0-4 for 5 videos/day) - determines which of the 3 time slots to use
 * @param options - Additional options
 */
export async function scheduleVideoToAllPlatforms(
  videoUrl: string,
  caption: string,
  title: string,
  brand: Brand,
  videoIndex: number,
  options?: {
    firstComment?: string;
    hashtags?: string[];
    postTypes?: LatePostRequest['postTypes'];
  }
): Promise<{
  success: boolean;
  scheduledPosts: {
    hour: number;
    platforms: string[];
    postId?: string;
    error?: string;
  }[];
  totalScheduled: number;
  errors: string[];
}> {
  const brandPlatforms = getBrandPlatforms(brand, false);
  const scheduledPosts: {
    hour: number;
    platforms: string[];
    postId?: string;
    error?: string;
  }[] = [];
  const errors: string[] = [];

  console.log(`\n📅 Scheduling Video ${videoIndex + 1} for ${brand} to all platforms at optimal times:`);
  console.log(`   Brand platforms: ${brandPlatforms.join(', ')}`);

  // Group platforms by their optimal hour for this video index
  const hourPlatforms: Record<number, string[]> = {};

  for (const platform of brandPlatforms) {
    const optimalHour = getPostingHourForVideo(platform, videoIndex);

    if (!hourPlatforms[optimalHour]) {
      hourPlatforms[optimalHour] = [];
    }

    hourPlatforms[optimalHour].push(platform);
  }

  console.log(`\n   Grouped into ${Object.keys(hourPlatforms).length} time slots:\n`);

  // Schedule a post for each hour group
  for (const [hourStr, platforms] of Object.entries(hourPlatforms).sort(([a], [b]) => parseInt(a) - parseInt(b))) {
    const hour = parseInt(hourStr);
    const scheduleTime = createScheduleTime(hour);

    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);

    const cstTime = new Date(scheduleTime).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    console.log(`   ${displayHour} ${ampm} CST (${cstTime})`);
    console.log(`      Platforms: ${platforms.join(', ')}`);

    try {
      const result = await postToLate({
        videoUrl,
        caption,
        title,
        hashtags: options?.hashtags,
        platforms: platforms as any[],
        scheduleTime, // Time in CST format (YYYY-MM-DDTHH:MM:SS)
        timezone: 'America/Chicago', // Tell Late.dev this is CST
        useQueue: false,
        brand: brand as any,
        firstComment: options?.firstComment,
        postTypes: options?.postTypes,
      });

      if (result.success) {
        console.log(`      ✅ Scheduled (Post ID: ${result.postId})`);
        scheduledPosts.push({
          hour,
          platforms,
          postId: result.postId,
        });
      } else {
        console.error(`      ❌ Failed: ${result.error}`);
        errors.push(`${displayHour} ${ampm} (${platforms.join(', ')}): ${result.error}`);
        scheduledPosts.push({
          hour,
          platforms,
          error: result.error,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`      ❌ Error: ${errorMsg}`);
      errors.push(`${displayHour} ${ampm} (${platforms.join(', ')}): ${errorMsg}`);
      scheduledPosts.push({
        hour,
        platforms,
        error: errorMsg,
      });
    }
  }

  const totalScheduled = scheduledPosts.filter(p => p.postId).length;
  const success = totalScheduled > 0;

  console.log(`\n   ${success ? '✅' : '❌'} Scheduled ${totalScheduled}/${Object.keys(hourPlatforms).length} time slots`);
  if (errors.length > 0) {
    console.warn(`   ⚠️  Errors: ${errors.length}`);
  }

  return {
    success,
    scheduledPosts,
    totalScheduled,
    errors,
  };
}

/**
 * Get human-readable description of when this video will post
 */
export function getVideoScheduleDescription(brand: Brand, videoIndex: number): string {
  const brandPlatforms = getBrandPlatforms(brand, false);

  const hourPlatforms: Record<number, string[]> = {};

  for (const platform of brandPlatforms) {
    const optimalHour = getPostingHourForVideo(platform, videoIndex);

    if (!hourPlatforms[optimalHour]) {
      hourPlatforms[optimalHour] = [];
    }

    hourPlatforms[optimalHour].push(platform);
  }

  const descriptions = Object.entries(hourPlatforms)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([hourStr, platforms]) => {
      const hour = parseInt(hourStr);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      return `${platforms.join('/')} at ${displayHour}${ampm}`;
    });

  return `Tomorrow: ${descriptions.join(', ')}`;
}
