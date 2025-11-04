/**
 * Brand Posting Schedule Configuration
 *
 * Defines how many times per day each brand posts and at what times
 */

import { Brand } from './constants';

export interface BrandPostingConfig {
  brand: Brand;
  postsPerDay: number;
  description: string;

  /**
   * Top performing hours (CST) for this brand based on analytics
   * These are the times when THIS specific brand gets best engagement
   */
  topPerformingHours: number[];

  /**
   * Use platform-specific timing (8 AM, 1 PM, 7 PM) or brand-specific hours
   * - false: Use topPerformingHours for ALL platforms (same time)
   * - true: Use platform groups (8 AM = LinkedIn, 1 PM = FB/YT, 7 PM = IG/TikTok)
   */
  usePlatformSpecificTiming?: boolean;

  /**
   * Spread posts across multiple days vs same day
   * - true: Each post goes to different day (5 posts = 5 days)
   * - false: All posts go same day at different times from topPerformingHours
   */
  spreadAcrossDays?: boolean;
}

/**
 * Brand posting configuration
 *
 * Strategy Options:
 * 1. Same Day Multi-Time: Post to different platforms at different times SAME day
 *    - Set sameDaySlots: [10, 14, 18] for 10 AM, 2 PM, 6 PM
 *    - Good for: High-volume content that shouldn't spam same platforms
 *
 * 2. Multi-Day Spread: Post to ALL platforms but spread across days
 *    - Set useDayOffset: true
 *    - Each post hits all platforms (8 AM, 1 PM, 7 PM) but on different days
 *    - Good for: Quality content you want maximum reach on
 */
export const BRAND_POSTING_CONFIGS: Record<Brand, BrandPostingConfig> = {
  carz: {
    brand: 'carz',
    postsPerDay: 5,
    description: 'Automotive content - 5 posts/day at top performing times',
    topPerformingHours: [8, 12, 15, 18, 21], // 8 AM, 12 PM, 3 PM, 6 PM, 9 PM CST
    spreadAcrossDays: false, // All 5 posts same day at different hours
    usePlatformSpecificTiming: true, // Use 8AM=LinkedIn, 1PM=FB/YT, 7PM=IG/TikTok for each hour
  },

  ownerfi: {
    brand: 'ownerfi',
    postsPerDay: 5,
    description: 'Real estate content - 5 posts/day at top performing times',
    topPerformingHours: [8, 12, 15, 18, 21], // 8 AM, 12 PM, 3 PM, 6 PM, 9 PM CST
    spreadAcrossDays: false, // All 5 posts same day
    usePlatformSpecificTiming: true,
  },

  podcast: {
    brand: 'podcast',
    postsPerDay: 5,
    description: 'Podcast episodes - 5 posts/day at top performing times',
    topPerformingHours: [8, 12, 15, 18, 21], // 8 AM, 12 PM, 3 PM, 6 PM, 9 PM CST
    spreadAcrossDays: false, // All 5 posts same day
    usePlatformSpecificTiming: true,
  },

  benefit: {
    brand: 'benefit',
    postsPerDay: 5,
    description: 'Owner finance benefits - 5 posts/day at top performing times',
    topPerformingHours: [9, 12, 15, 18, 21], // 9 AM, 12 PM, 3 PM, 6 PM, 9 PM CST (offset by 20 min in cron)
    spreadAcrossDays: false, // All 5 posts same day
    usePlatformSpecificTiming: true,
  },

  abdullah: {
    brand: 'abdullah',
    postsPerDay: 5,
    description: 'Personal brand - 5 posts/day at top performing times',
    topPerformingHours: [8, 12, 15, 18, 21], // 8 AM, 12 PM, 3 PM, 6 PM, 9 PM CST
    spreadAcrossDays: false, // All 5 posts same day
    usePlatformSpecificTiming: true,
  },

  vassdistro: {
    brand: 'vassdistro',
    postsPerDay: 1,
    description: 'B2B vape distribution - 1 post/day at 10 AM',
    topPerformingHours: [10], // 10 AM CST
    spreadAcrossDays: false,
    usePlatformSpecificTiming: true,
  },

  property: {
    brand: 'property',
    postsPerDay: 1,
    description: 'Individual property videos - posted as properties are added',
    topPerformingHours: [14], // 2 PM CST - good time for real estate browsing
    spreadAcrossDays: false,
    usePlatformSpecificTiming: true,
  },
};

/**
 * Get posting configuration for a brand
 */
export function getBrandPostingConfig(brand: Brand): BrandPostingConfig {
  return BRAND_POSTING_CONFIGS[brand];
}

/**
 * Calculate day offset for a specific post index
 *
 * @param brand - Brand identifier
 * @param postIndex - Index of post (0 = first post, 1 = second post, etc.)
 * @returns Day offset (0 = tomorrow, 1 = day after, etc.)
 */
export function calculateDayOffset(brand: Brand, postIndex: number): number {
  const config = getBrandPostingConfig(brand);

  if (!config.spreadAcrossDays) {
    return 0; // All posts go same day
  }

  // Spread posts across days
  // Post 0 = tomorrow (offset 0)
  // Post 1 = day after (offset 1)
  // Post 2 = 2 days later (offset 2)
  // etc.
  return postIndex;
}

/**
 * Get the hour for a specific post index
 *
 * @param brand - Brand identifier
 * @param postIndex - Index of post (0 = first post, 1 = second post, etc.)
 * @returns Hour in CST (0-23)
 */
export function getHourForPost(brand: Brand, postIndex: number): number {
  const config = getBrandPostingConfig(brand);

  if (config.topPerformingHours.length === 0) {
    throw new Error(`No top performing hours configured for brand: ${brand}`);
  }

  // If we have enough hours for all posts, use them in order
  if (postIndex < config.topPerformingHours.length) {
    return config.topPerformingHours[postIndex];
  }

  // If we have more posts than hours, cycle through the hours
  return config.topPerformingHours[postIndex % config.topPerformingHours.length];
}

/**
 * Get schedule description for a brand
 */
export function getScheduleDescription(brand: Brand): string {
  const config = getBrandPostingConfig(brand);

  if (config.spreadAcrossDays && config.postsPerDay > 1) {
    // Multi-day spread strategy
    return `${config.postsPerDay} posts spread across ${config.postsPerDay} days - each hits all platforms at optimal times (8 AM, 1 PM, 7 PM CST)`;
  } else if (config.topPerformingHours.length > 1) {
    // Same-day multi-post strategy
    const times = config.topPerformingHours.map(h => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${hour} ${ampm}`;
    }).join(', ');
    return `${config.postsPerDay} posts/day at ${times} CST${config.usePlatformSpecificTiming ? ' (platform-optimized)' : ''}`;
  } else {
    // Single post per day
    const hour = config.topPerformingHours[0];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hourStr = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${config.postsPerDay} post/day at ${hourStr} ${ampm} CST`;
  }
}
