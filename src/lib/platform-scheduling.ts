/**
 * Platform-Specific Scheduling System
 *
 * Schedules posts to different social media platforms at their optimal engagement times.
 * Based on 2025 analytics showing different platforms have different peak times.
 *
 * Strategy: 3 platform groups posting at different times throughout the day
 * - Professional platforms (LinkedIn, Twitter, Bluesky): 8 AM CST
 * - Midday platforms (Facebook, YouTube): 1 PM CST
 * - Evening entertainment (TikTok, Instagram, Threads): 7 PM CST
 */

import { Brand } from '@/config/constants';
import { getBrandPlatforms } from '@/lib/brand-utils';
import { postToLate, LatePostRequest, LatePostResponse } from '@/lib/late-api';

/**
 * Platform group with scheduled posting time
 */
export interface PlatformGroup {
  platforms: string[];
  hourCST: number; // Hour in CST (0-23)
  label: string;
  description: string;
}

/**
 * Get platform groups for a brand with optimal posting times
 *
 * @param brand - Brand identifier
 * @returns Array of platform groups with their scheduled times
 */
export function getPlatformGroups(brand: Brand): PlatformGroup[] {
  // Base groups optimized for engagement (2025 data)
  const baseGroups: PlatformGroup[] = [
    {
      platforms: ['linkedin', 'twitter', 'bluesky'],
      hourCST: 8, // 8 AM - Professional morning audience
      label: 'Professional Platforms',
      description: 'B2B audience checking feeds before work starts',
    },
    {
      platforms: ['facebook', 'youtube'],
      hourCST: 13, // 1 PM - Lunch/afternoon break
      label: 'Midday Platforms',
      description: 'Lunch scrolling and afternoon break audience',
    },
    {
      platforms: ['instagram', 'tiktok', 'threads'],
      hourCST: 19, // 7 PM - Evening entertainment peak
      label: 'Evening Platforms',
      description: 'Peak engagement for entertainment-focused platforms',
    },
  ];

  // Brand-specific customizations
  const groups = [...baseGroups];

  // Abdullah: Include Twitter and Threads
  if (brand === 'abdullah') {
    groups[0].platforms = ['linkedin', 'twitter'];
    groups[2].platforms = ['instagram', 'tiktok', 'threads'];
  }

  // Carz: No Twitter/Bluesky
  if (brand === 'carz') {
    groups[0].platforms = ['linkedin'];
  }

  // Benefit & Property: Use OwnerFi platforms (all platforms available)
  // No changes needed - they use all 3 groups

  // Filter groups to only include platforms that the brand actually uses
  const brandPlatforms = getBrandPlatforms(brand, false);

  return groups
    .map(group => ({
      ...group,
      platforms: group.platforms.filter(p => brandPlatforms.includes(p))
    }))
    .filter(group => group.platforms.length > 0); // Remove empty groups
}

/**
 * Create schedule time for a specific hour in CST
 *
 * @param hourCST - Hour in CST (0-23)
 * @param baseDate - Base date to add 24 hours to (defaults to now)
 * @param dayOffset - Number of days to add (0 = today+24h, 1 = today+48h, etc.)
 * @returns ISO 8601 UTC timestamp
 */
export function createScheduleTime(hourCST: number, baseDate: Date = new Date(), dayOffset: number = 0): string {
  // Add 24 hours + dayOffset to base date
  const targetDate = new Date(baseDate.getTime() + ((24 + (dayOffset * 24)) * 60 * 60 * 1000));

  // Set hour in CST timezone
  // Note: toLocaleString creates a date in CST, then we parse it back
  const cstDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  cstDate.setHours(hourCST, 0, 0, 0);

  // Calculate offset to convert CST time back to UTC
  const offset = cstDate.getTime() - targetDate.getTime();
  const utcSchedule = new Date(targetDate.getTime() - offset);

  return utcSchedule.toISOString();
}

/**
 * Post to platforms with day offset for multi-post-per-day schedules
 *
 * @param videoUrl - URL of video to post
 * @param caption - Post caption
 * @param title - Video title
 * @param brand - Brand identifier
 * @param dayOffset - Days to offset (0 = tomorrow, 1 = day after, 2 = 2 days later, etc.)
 * @param options - Additional options
 */
export async function postToMultiplePlatformGroupsWithOffset(
  videoUrl: string,
  caption: string,
  title: string,
  brand: Brand,
  dayOffset: number = 0,
  options?: {
    firstComment?: string;
    hashtags?: string[];
    postTypes?: LatePostRequest['postTypes'];
  }
): Promise<{
  success: boolean;
  groups: {
    group: PlatformGroup;
    result: LatePostResponse;
  }[];
  totalPlatforms: number;
  scheduledPlatforms: number;
  errors: string[];
}> {
  const groups = getPlatformGroups(brand);
  const results: { group: PlatformGroup; result: LatePostResponse }[] = [];
  const errors: string[] = [];

  console.log(`📅 Scheduling to ${groups.length} platform groups for ${brand} (day offset: +${dayOffset}):`);

  for (const group of groups) {
    // Create schedule time with day offset
    const scheduleTime = createScheduleTime(group.hourCST, new Date(), dayOffset);

    // Format for logging
    const cstTime = new Date(scheduleTime).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    console.log(`   ${group.label} (${group.platforms.join(', ')})`);
    console.log(`     → Scheduled for: ${cstTime} CST`);
    console.log(`     → UTC: ${scheduleTime}`);

    try {
      // Post to this platform group
      // NOTE: When useQueue=true, Late.so manages scheduling via its queue system
      // Do NOT pass scheduleTime when using queue - it would be ignored anyway
      // and creates confusing code. Let the queue determine optimal timing.
      const result = await postToLate({
        videoUrl,
        caption,
        title,
        hashtags: options?.hashtags,
        platforms: group.platforms as any[],
        // scheduleTime intentionally omitted - queue handles timing
        useQueue: true, // Use GetLate's queue system
        brand,
        firstComment: options?.firstComment,
        postTypes: options?.postTypes,
        timezone: 'America/Chicago', // CST timezone for queue
      });

      results.push({ group, result });

      if (result.success) {
        console.log(`     ✅ Scheduled (Post ID: ${result.postId})`);
      } else {
        console.error(`     ❌ Failed: ${result.error}`);
        errors.push(`${group.label}: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`     ❌ Error: ${errorMsg}`);
      errors.push(`${group.label}: ${errorMsg}`);
    }
  }

  // Calculate totals
  const totalPlatforms = groups.reduce((sum, g) => sum + g.platforms.length, 0);
  const scheduledPlatforms = results
    .filter(r => r.result.success)
    .reduce((sum, r) => sum + (r.result.platforms?.length || r.group.platforms.length), 0);

  const success = scheduledPlatforms > 0;

  console.log(`\n${success ? '✅' : '❌'} Scheduled ${scheduledPlatforms}/${totalPlatforms} platforms`);
  if (errors.length > 0) {
    console.warn(`⚠️  Errors: ${errors.join('; ')}`);
  }

  return {
    success,
    groups: results,
    totalPlatforms,
    scheduledPlatforms,
    errors,
  };
}

/**
 * Post to multiple platform groups at their optimal times
 *
 * Each platform group gets posted at a different time for maximum engagement.
 *
 * @param videoUrl - URL of the video to post
 * @param caption - Post caption
 * @param title - Video title (for YouTube, etc.)
 * @param brand - Brand identifier
 * @param options - Additional posting options
 * @returns Array of posting results (one per platform group)
 */
export async function postToMultiplePlatformGroups(
  videoUrl: string,
  caption: string,
  title: string,
  brand: Brand,
  options?: {
    firstComment?: string;
    hashtags?: string[];
    postTypes?: LatePostRequest['postTypes'];
  }
): Promise<{
  success: boolean;
  groups: {
    group: PlatformGroup;
    result: LatePostResponse;
  }[];
  totalPlatforms: number;
  scheduledPlatforms: number;
  errors: string[];
}> {
  const groups = getPlatformGroups(brand);
  const results: { group: PlatformGroup; result: LatePostResponse }[] = [];
  const errors: string[] = [];

  console.log(`📅 Scheduling to ${groups.length} platform groups for ${brand}:`);

  for (const group of groups) {
    // Create schedule time 24 hours from now at the group's optimal hour
    const scheduleTime = createScheduleTime(group.hourCST);

    // Format for logging
    const cstTime = new Date(scheduleTime).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    console.log(`   ${group.label} (${group.platforms.join(', ')})`);
    console.log(`     → Scheduled for: ${cstTime} CST`);
    console.log(`     → UTC: ${scheduleTime}`);

    try {
      // Post to this platform group
      const result = await postToLate({
        videoUrl,
        caption,
        title,
        platforms: group.platforms as any[],
        scheduleTime,
        timezone: 'America/Chicago',
        useQueue: true, // Use GetLate's queue system
        brand: brand as any,
        firstComment: options?.firstComment,
        hashtags: options?.hashtags,
        postTypes: options?.postTypes,
      });

      results.push({ group, result });

      if (!result.success) {
        errors.push(`${group.label}: ${result.error}`);
        console.error(`     ❌ Failed: ${result.error}`);
      } else {
        console.log(`     ✅ Scheduled successfully (Post ID: ${result.postId})`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${group.label}: ${errorMsg}`);
      console.error(`     ❌ Error: ${errorMsg}`);

      // Add failed result to track the attempt
      results.push({
        group,
        result: {
          success: false,
          error: errorMsg,
        },
      });
    }
  }

  // Calculate totals
  const totalPlatforms = groups.reduce((sum, g) => sum + g.platforms.length, 0);
  const scheduledPlatforms = results
    .filter(r => r.result.success)
    .reduce((sum, r) => sum + r.group.platforms.length, 0);

  const allSuccess = results.every(r => r.result.success);

  console.log(`\n📊 Platform Scheduling Summary:`);
  console.log(`   Total platforms: ${totalPlatforms}`);
  console.log(`   Scheduled: ${scheduledPlatforms}`);
  console.log(`   Failed: ${totalPlatforms - scheduledPlatforms}`);
  console.log(`   Groups: ${results.filter(r => r.result.success).length}/${groups.length}`);

  return {
    success: allSuccess,
    groups: results,
    totalPlatforms,
    scheduledPlatforms,
    errors,
  };
}

/**
 * Helper: Get human-readable description of when platforms will post
 *
 * @param brand - Brand identifier
 * @returns Description of posting schedule
 */
export function getScheduleDescription(brand: Brand): string {
  const groups = getPlatformGroups(brand);

  const descriptions = groups.map(group => {
    const timeStr = `${group.hourCST % 12 || 12}${group.hourCST >= 12 ? 'PM' : 'AM'} CST`;
    return `${group.platforms.join(', ')} at ${timeStr}`;
  });

  return `Posts tomorrow at: ${descriptions.join(' | ')}`;
}

/**
 * Validate that all brand platforms are covered by groups
 *
 * @param brand - Brand identifier
 * @returns Validation result
 */
export function validatePlatformGroups(brand: Brand): {
  valid: boolean;
  missingPlatforms: string[];
  coveredPlatforms: string[];
} {
  const brandPlatforms = getBrandPlatforms(brand, false);
  const groups = getPlatformGroups(brand);

  const coveredPlatforms = groups.flatMap(g => g.platforms);
  const missingPlatforms = brandPlatforms.filter(p => !coveredPlatforms.includes(p));

  return {
    valid: missingPlatforms.length === 0,
    missingPlatforms,
    coveredPlatforms,
  };
}
