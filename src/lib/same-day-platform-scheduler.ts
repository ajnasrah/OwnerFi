/**
 * Same-Day Multi-Platform Posting Scheduler
 *
 * ALL platforms post the SAME video on the SAME DAY
 * Each platform posts at its optimal HOUR for that specific day of week
 *
 * Based on:
 * - YouTube: Actual Late.dev analytics (135 posts with engagement data)
 * - TikTok: Partial analytics data
 * - Others: Industry research (2025 data)
 */

export type Platform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'twitter' | 'bluesky' | 'threads';
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday

export interface DailySchedule {
  platform: Platform;
  // Best hour for each day of the week (Sunday = 0, Saturday = 6)
  schedule: {
    [key in DayOfWeek]: {
      hour: number; // 0-23 in CST
      source: 'analytics' | 'research';
      confidence: 'high' | 'medium' | 'low';
    };
  };
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Platform-specific optimal posting hours for each day of the week
 *
 * This allows posting the SAME video to ALL platforms on the SAME DAY
 * but at different optimal hours per platform
 */
export function getDailySchedule(platform: Platform): DailySchedule {
  const schedules: Record<Platform, DailySchedule> = {
    // YOUTUBE - Based on actual Late.dev analytics (135 posts analyzed)
    youtube: {
      platform: 'youtube',
      schedule: {
        0: { hour: 6, source: 'analytics', confidence: 'high' },    // Sunday 6 AM - 1.29% engagement (3 posts, 489 avg views)
        1: { hour: 15, source: 'analytics', confidence: 'low' },    // Monday 3 PM - 2.78% engagement (1 post)
        2: { hour: 17, source: 'analytics', confidence: 'low' },    // Tuesday 5 PM - 2.22% engagement (1 post)
        3: { hour: 6, source: 'analytics', confidence: 'low' },     // Wednesday 6 AM - 1.32% engagement (1 post)
        4: { hour: 9, source: 'analytics', confidence: 'low' },     // Thursday 9 AM - 25.00% engagement (1 post - outlier)
        5: { hour: 19, source: 'analytics', confidence: 'medium' }, // Friday 7 PM - 1.51% engagement (2 posts, 133 avg views)
        6: { hour: 8, source: 'analytics', confidence: 'medium' }   // Saturday 8 AM - 1.29% engagement (2 posts, 389 avg views)
      }
    },

    // TIKTOK - Partial analytics + research
    tiktok: {
      platform: 'tiktok',
      schedule: {
        0: { hour: 12, source: 'analytics', confidence: 'low' },    // Sunday 12 PM - 2.52% (1 post)
        1: { hour: 7, source: 'analytics', confidence: 'high' },    // Monday 7 AM - 0.15% (13 posts, 100 avg views)
        2: { hour: 9, source: 'research', confidence: 'medium' },   // Tuesday 9 AM - research
        3: { hour: 21, source: 'analytics', confidence: 'low' },    // Wednesday 9 PM - 0.67% (1 post)
        4: { hour: 11, source: 'analytics', confidence: 'medium' }, // Thursday 11 AM - 0.42% (2 posts, 119 avg views)
        5: { hour: 21, source: 'analytics', confidence: 'low' },    // Friday 9 PM - 0.00% (1 post)
        6: { hour: 21, source: 'analytics', confidence: 'low' }     // Saturday 9 PM - 33.33% (1 post)
      }
    },

    // INSTAGRAM - Research-based (Late analytics showed 0 views)
    instagram: {
      platform: 'instagram',
      schedule: {
        0: { hour: 10, source: 'research', confidence: 'medium' }, // Sunday 10 AM - weekend scrolling
        1: { hour: 11, source: 'research', confidence: 'high' },   // Monday 11 AM - work break
        2: { hour: 11, source: 'research', confidence: 'high' },   // Tuesday 11 AM - peak Reels engagement
        3: { hour: 14, source: 'research', confidence: 'high' },   // Wednesday 2 PM - afternoon peak
        4: { hour: 14, source: 'research', confidence: 'high' },   // Thursday 2 PM - afternoon discovery
        5: { hour: 15, source: 'research', confidence: 'medium' }, // Friday 3 PM - weekend prep
        6: { hour: 10, source: 'research', confidence: 'medium' }  // Saturday 10 AM - weekend morning
      }
    },

    // FACEBOOK - Research-based (Meta Business Suite 2025)
    facebook: {
      platform: 'facebook',
      schedule: {
        0: { hour: 12, source: 'research', confidence: 'medium' }, // Sunday 12 PM - weekend midday
        1: { hour: 13, source: 'research', confidence: 'high' },   // Monday 1 PM - lunch break
        2: { hour: 13, source: 'research', confidence: 'high' },   // Tuesday 1 PM - lunch engagement
        3: { hour: 13, source: 'research', confidence: 'high' },   // Wednesday 1 PM - midweek lunch
        4: { hour: 15, source: 'research', confidence: 'medium' }, // Thursday 3 PM - afternoon
        5: { hour: 15, source: 'research', confidence: 'high' },   // Friday 3 PM - end of work week
        6: { hour: 11, source: 'research', confidence: 'medium' }  // Saturday 11 AM - weekend
      }
    },

    // LINKEDIN - Research-based (LinkedIn Marketing Solutions 2025)
    linkedin: {
      platform: 'linkedin',
      schedule: {
        0: { hour: 9, source: 'research', confidence: 'low' },     // Sunday 9 AM - low activity
        1: { hour: 10, source: 'research', confidence: 'high' },   // Monday 10 AM - week start
        2: { hour: 10, source: 'research', confidence: 'high' },   // Tuesday 10 AM - mid-morning professional
        3: { hour: 12, source: 'research', confidence: 'high' },   // Wednesday 12 PM - lunch break
        4: { hour: 16, source: 'research', confidence: 'medium' }, // Thursday 4 PM - end of workday
        5: { hour: 11, source: 'research', confidence: 'medium' }, // Friday 11 AM - morning
        6: { hour: 9, source: 'research', confidence: 'low' }      // Saturday 9 AM - low activity
      }
    },

    // TWITTER/X - Research-based (Buffer 2025)
    twitter: {
      platform: 'twitter',
      schedule: {
        0: { hour: 10, source: 'research', confidence: 'low' },    // Sunday 10 AM - lower activity
        1: { hour: 9, source: 'research', confidence: 'high' },    // Monday 9 AM - morning news cycle
        2: { hour: 15, source: 'research', confidence: 'high' },   // Tuesday 3 PM - afternoon peak
        3: { hour: 15, source: 'research', confidence: 'high' },   // Wednesday 3 PM - midweek engagement
        4: { hour: 11, source: 'research', confidence: 'medium' }, // Thursday 11 AM - late morning
        5: { hour: 11, source: 'research', confidence: 'medium' }, // Friday 11 AM - end of week news
        6: { hour: 12, source: 'research', confidence: 'low' }     // Saturday 12 PM - weekend
      }
    },

    // BLUESKY - Research-based (similar to Twitter)
    bluesky: {
      platform: 'bluesky',
      schedule: {
        0: { hour: 10, source: 'research', confidence: 'low' },    // Sunday 10 AM
        1: { hour: 10, source: 'research', confidence: 'low' },    // Monday 10 AM
        2: { hour: 14, source: 'research', confidence: 'low' },    // Tuesday 2 PM
        3: { hour: 14, source: 'research', confidence: 'low' },    // Wednesday 2 PM
        4: { hour: 12, source: 'research', confidence: 'low' },    // Thursday 12 PM
        5: { hour: 12, source: 'research', confidence: 'low' },    // Friday 12 PM
        6: { hour: 11, source: 'research', confidence: 'low' }     // Saturday 11 AM
      }
    },

    // THREADS - Research-based (Meta's recommendations)
    threads: {
      platform: 'threads',
      schedule: {
        0: { hour: 11, source: 'research', confidence: 'medium' }, // Sunday 11 AM
        1: { hour: 12, source: 'research', confidence: 'medium' }, // Monday 12 PM
        2: { hour: 12, source: 'research', confidence: 'medium' }, // Tuesday 12 PM
        3: { hour: 14, source: 'research', confidence: 'medium' }, // Wednesday 2 PM
        4: { hour: 15, source: 'research', confidence: 'medium' }, // Thursday 3 PM
        5: { hour: 14, source: 'research', confidence: 'medium' }, // Friday 2 PM
        6: { hour: 11, source: 'research', confidence: 'low' }     // Saturday 11 AM
      }
    }
  };

  return schedules[platform];
}

/**
 * Get optimal posting hour for a specific platform on a specific day
 */
export function getOptimalHourForDay(platform: Platform, dayOfWeek: DayOfWeek): number {
  const schedule = getDailySchedule(platform);
  return schedule.schedule[dayOfWeek].hour;
}

/**
 * Calculate posting time for a platform on a specific date
 * All platforms will post on the SAME DAY but at different optimal hours
 */
export function calculateSameDayPostingTime(
  platform: Platform,
  targetDate: Date = new Date()
): Date {
  const postDate = new Date(targetDate);
  const dayOfWeek = postDate.getDay() as DayOfWeek;
  const optimalHour = getOptimalHourForDay(platform, dayOfWeek);

  // Set to optimal hour for this platform on this day
  postDate.setHours(optimalHour, 0, 0, 0);

  // If the time has already passed today, this will be in the past
  // The calling function should handle whether to post today or schedule for future
  return postDate;
}

/**
 * Get all posting times for all platforms on the SAME DAY
 * Returns a map of platform -> posting time
 *
 * Example: If posting on Monday, returns:
 * - YouTube: Monday 3 PM
 * - Instagram: Monday 11 AM
 * - TikTok: Monday 7 AM
 * - etc.
 */
export function getAllPlatformTimesForDay(
  platforms: Platform[],
  targetDate: Date = new Date()
): Map<Platform, Date> {
  const times = new Map<Platform, Date>();

  for (const platform of platforms) {
    const postTime = calculateSameDayPostingTime(platform, targetDate);
    times.set(platform, postTime);
  }

  return times;
}

/**
 * Get a human-readable description of the posting schedule for a specific day
 */
export function getScheduleDescriptionForDay(
  platforms: Platform[],
  dayOfWeek: DayOfWeek
): string {
  const dayName = DAYS[dayOfWeek];
  const times: string[] = [];

  for (const platform of platforms) {
    const schedule = getDailySchedule(platform);
    const slot = schedule.schedule[dayOfWeek];
    const hour = slot.hour % 12 || 12;
    const period = slot.hour >= 12 ? 'PM' : 'AM';
    times.push(`${platform}: ${hour}:00 ${period}`);
  }

  return `${dayName}: ${times.join(', ')}`;
}
