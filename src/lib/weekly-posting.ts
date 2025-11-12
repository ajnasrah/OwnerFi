/**
 * Weekly Multi-Post Scheduling System
 *
 * Posts each video 3 times across the week at platform-specific optimal times.
 * Replaces the old "3 groups same day" system with "3 posts across 7 days per platform".
 *
 * Example: A video on Instagram posts:
 * - Post 1: Tuesday 11 AM
 * - Post 2: Thursday 2 PM
 * - Post 3: Saturday 10 AM
 */

import { Brand } from '@/config/constants';
import { getBrandPlatforms } from '@/lib/brand-utils';
import { postToLate, LatePostRequest, LatePostResponse } from '@/lib/late-api';
import { getWeeklySchedule, getWeeklyPostingTimes, type Platform } from './weekly-platform-scheduler';

/**
 * Post a single video to all brand platforms, 3 times per week per platform
 *
 * Each platform gets the same video posted 3 times at its optimal weekly times.
 * This maximizes reach without overwhelming followers.
 *
 * @param videoUrl - URL of the video to post
 * @param caption - Post caption
 * @param title - Video title
 * @param brand - Brand identifier
 * @param options - Additional posting options
 * @returns Results of all posts created
 */
export async function postVideoWeekly(
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
  posts: Array<{
    platform: string;
    postNumber: 1 | 2 | 3;
    scheduledFor: string;
    result: LatePostResponse;
  }>;
  totalPosts: number;
  errors: string[];
}> {
  const brandPlatforms = getBrandPlatforms(brand, false) as Platform[];
  const allPosts: Array<{
    platform: string;
    postNumber: 1 | 2 | 3;
    scheduledFor: string;
    result: LatePostResponse;
  }> = [];
  const errors: string[] = [];

  console.log(`📅 Scheduling weekly posts for ${brand} to ${brandPlatforms.length} platforms`);
  console.log(`   Each platform will receive 3 posts this week at optimal times\n`);

  // For each platform the brand uses
  for (const platform of brandPlatforms) {
    const schedule = getWeeklySchedule(platform);
    const postingTimes = getWeeklyPostingTimes(platform);

    console.log(`📱 ${platform.toUpperCase()}:`);
    console.log(`   ${schedule.rationale}`);
    console.log(`   Source: ${schedule.slots[0].source} (confidence: ${schedule.slots[0].confidence})`);

    // Create 3 posts for this platform
    for (let i = 0; i < 3; i++) {
      const slot = schedule.slots[i];
      const scheduledFor = postingTimes[i].toISOString();

      console.log(`   Post ${i + 1}: ${slot.label} (${scheduledFor.split('T')[0]})`);

      try {
        // Create the post using GetLate's queue system
        const result = await postToLate({
          videoUrl,
          caption,
          title,
          brand,
          platforms: [platform],
          scheduleTime: scheduledFor,
          postTypes: options?.postTypes,
          useQueue: true, // ✅ Use GetLate's queue system
          timezone: 'America/Chicago'
        });

        if (result.success) {
          allPosts.push({
            platform,
            postNumber: (i + 1) as 1 | 2 | 3,
            scheduledFor,
            result
          });
          console.log(`      ✅ Created (Post ID: ${result.postId})`);
        } else {
          errors.push(`${platform} post ${i + 1}: ${result.error}`);
          console.log(`      ❌ Failed: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${platform} post ${i + 1}: ${errorMsg}`);
        console.log(`      ❌ Error: ${errorMsg}`);
      }

      // Rate limit: wait 1 second between posts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log();
  }

  const success = allPosts.length > 0;

  console.log(`${'='.repeat(80)}`);
  console.log(`📊 WEEKLY POSTING SUMMARY`);
  console.log(`   Total posts created: ${allPosts.length}`);
  console.log(`   Platforms: ${brandPlatforms.length}`);
  console.log(`   Expected total: ${brandPlatforms.length * 3}`);
  if (errors.length > 0) {
    console.log(`   Errors: ${errors.length}`);
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
 * Helper to format posting schedule description
 */
export function getPostingScheduleDescription(brand: Brand): string {
  const platforms = getBrandPlatforms(brand, false) as Platform[];
  const descriptions: string[] = [];

  for (const platform of platforms) {
    const schedule = getWeeklySchedule(platform);
    const times = schedule.slots.map(s => s.label).join(', ');
    descriptions.push(`${platform}: ${times}`);
  }

  return descriptions.join(' | ');
}
