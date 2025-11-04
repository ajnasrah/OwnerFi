/**
 * Platform-Specific Optimal Posting Times
 *
 * Based on 2025 social media engagement analytics showing when each platform
 * has highest user activity and engagement rates.
 *
 * All times in CST (Central Standard Time)
 */

/**
 * Top 3 performing hours for each social media platform
 * Based on industry analytics for maximum engagement
 */
export const PLATFORM_OPTIMAL_HOURS: Record<string, number[]> = {
  // Instagram: Best engagement during lunch, afternoon break, and evening
  instagram: [11, 14, 19], // 11 AM, 2 PM, 7 PM CST

  // TikTok: Peak evening entertainment hours
  tiktok: [12, 16, 19], // 12 PM, 4 PM, 7 PM CST

  // Facebook: Midday and evening engagement peaks
  facebook: [12, 15, 19], // 12 PM, 3 PM, 7 PM CST

  // LinkedIn: Professional hours - morning, lunch, end of day
  linkedin: [8, 12, 17], // 8 AM, 12 PM, 5 PM CST

  // YouTube: Lunch, afternoon, prime evening viewing
  youtube: [12, 15, 20], // 12 PM, 3 PM, 8 PM CST

  // Twitter/X: Morning news, lunch, evening
  twitter: [8, 12, 17], // 8 AM, 12 PM, 5 PM CST

  // Threads: Similar to Instagram (Meta platform)
  threads: [11, 14, 19], // 11 AM, 2 PM, 7 PM CST

  // Bluesky: Similar to Twitter/X patterns
  bluesky: [8, 12, 17], // 8 AM, 12 PM, 5 PM CST
};

/**
 * Platform groups with similar optimal posting times
 * Allows us to batch platforms together for same-time posting
 */
export interface PlatformTimeGroup {
  hour: number;
  platforms: string[];
  label: string;
}

/**
 * Get all unique posting hours across all platforms
 */
export function getAllPostingHours(): number[] {
  const allHours = new Set<number>();
  Object.values(PLATFORM_OPTIMAL_HOURS).forEach(hours => {
    hours.forEach(hour => allHours.add(hour));
  });
  return Array.from(allHours).sort((a, b) => a - b);
}

/**
 * Group platforms by hour - shows which platforms should post at each hour
 */
export function getPlatformsByHour(): Record<number, string[]> {
  const hourGroups: Record<number, string[]> = {};

  for (const [platform, hours] of Object.entries(PLATFORM_OPTIMAL_HOURS)) {
    for (const hour of hours) {
      if (!hourGroups[hour]) {
        hourGroups[hour] = [];
      }
      hourGroups[hour].push(platform);
    }
  }

  return hourGroups;
}

/**
 * Get platform time groups for scheduling
 * Returns which platforms to post to at each hour
 */
export function getPlatformTimeGroups(): PlatformTimeGroup[] {
  const hourGroups = getPlatformsByHour();

  return Object.entries(hourGroups)
    .map(([hourStr, platforms]) => {
      const hour = parseInt(hourStr);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);

      return {
        hour,
        platforms,
        label: `${displayHour} ${ampm} CST`,
      };
    })
    .sort((a, b) => a.hour - b.hour);
}

/**
 * Get posting schedule for a specific platform
 * Returns the 3 optimal hours for that platform
 */
export function getPlatformSchedule(platform: string): number[] {
  return PLATFORM_OPTIMAL_HOURS[platform.toLowerCase()] || [12, 15, 19]; // Default fallback
}

/**
 * Distribute N videos across platform's 3 optimal time slots
 * Uses cycling: Video 0→time 0, Video 1→time 1, Video 2→time 2, Video 3→time 0, etc.
 */
export function getPostingHourForVideo(platform: string, videoIndex: number): number {
  const schedule = getPlatformSchedule(platform);
  return schedule[videoIndex % schedule.length];
}
