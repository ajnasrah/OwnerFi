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
 * All brands post 3x/day at optimal cross-platform times:
 * - 8 AM CST: LinkedIn/Twitter morning peak
 * - 12 PM CST: Universal lunch peak (all platforms)
 * - 7 PM CST: Evening prime time (Instagram/TikTok/YouTube)
 */
export const BRAND_POSTING_CONFIGS: Record<Brand, BrandPostingConfig> = {
  carz: {
    brand: 'carz',
    postsPerDay: 3,
    description: 'Automotive content - 3 posts/day at optimal times',
    topPerformingHours: [8, 12, 19], // 8 AM, 12 PM, 7 PM CST
    spreadAcrossDays: false,
    usePlatformSpecificTiming: true,
  },

  ownerfi: {
    brand: 'ownerfi',
    postsPerDay: 3,
    description: 'Real estate content - 3 posts/day at optimal times',
    topPerformingHours: [8, 12, 19], // 8 AM, 12 PM, 7 PM CST
    spreadAcrossDays: false,
    usePlatformSpecificTiming: true,
  },

  benefit: {
    brand: 'benefit',
    postsPerDay: 3,
    description: 'Owner finance benefits - 3 posts/day at optimal times',
    topPerformingHours: [8, 12, 19], // 8 AM, 12 PM, 7 PM CST
    spreadAcrossDays: false,
    usePlatformSpecificTiming: true,
  },

  abdullah: {
    brand: 'abdullah',
    postsPerDay: 3,
    description: 'Personal brand - 3 posts/day at optimal times',
    topPerformingHours: [8, 12, 19], // 8 AM, 12 PM, 7 PM CST
    spreadAcrossDays: false,
    usePlatformSpecificTiming: true,
  },

  personal: {
    brand: 'personal',
    postsPerDay: 3,
    description: 'Personal videos - 3 posts/day at optimal times',
    topPerformingHours: [8, 12, 19], // 8 AM, 12 PM, 7 PM CST
    spreadAcrossDays: false,
    usePlatformSpecificTiming: true,
  },

  gaza: {
    brand: 'gaza',
    postsPerDay: 3,
    description: 'Gaza humanitarian news - 3 posts/day at optimal times',
    topPerformingHours: [8, 12, 19], // 8 AM, 12 PM, 7 PM CST
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
