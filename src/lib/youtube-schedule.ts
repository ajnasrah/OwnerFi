/**
 * YouTube Posting Schedule Configuration
 *
 * Each brand has unique daily time slots (CST timezone).
 * When uploading, the system picks the next available slot.
 */

export type YouTubeBrand = 'carz' | 'ownerfi' | 'benefit' | 'abdullah' | 'personal' | 'gaza';

// Time slots in 24-hour format (CST)
// Format: [hour, minute]
type TimeSlot = [number, number];

interface BrandSchedule {
  slots: TimeSlot[];
  timezone: string;
}

// Brand schedules - each brand posts at these times EVERY DAY
const BRAND_SCHEDULES: Record<YouTubeBrand, BrandSchedule> = {
  // OwnerFi — 10 Posts Per Day
  ownerfi: {
    timezone: 'America/Chicago',
    slots: [
      [6, 0],   // 6:00 AM - Early bird tip
      [8, 0],   // 8:00 AM - Morning education
      [10, 0],  // 10:00 AM - Property video
      [12, 0],  // 12:00 PM - Lunch myth buster
      [14, 0],  // 2:00 PM - Benefit video
      [16, 0],  // 4:00 PM - Afternoon property
      [18, 0],  // 6:00 PM - Evening education
      [19, 30], // 7:30 PM - Property video
      [21, 0],  // 9:00 PM - Success story
      [22, 30], // 10:30 PM - Late night tip
    ],
  },

  // Benefit videos use same schedule as ownerfi
  benefit: {
    timezone: 'America/Chicago',
    slots: [
      [6, 0],
      [8, 0],
      [10, 0],
      [12, 0],
      [14, 0],
      [16, 0],
      [18, 0],
      [19, 30],
      [21, 0],
      [22, 30],
    ],
  },

  // Abdullah — 10 Posts Per Day (Personal brand)
  abdullah: {
    timezone: 'America/Chicago',
    slots: [
      [5, 30],  // 5:30 AM - Wake up motivation
      [7, 0],   // 7:00 AM - Morning mindset
      [9, 0],   // 9:00 AM - Business tip
      [11, 0],  // 11:00 AM - Content clip
      [13, 0],  // 1:00 PM - Lunch story
      [15, 0],  // 3:00 PM - Afternoon energy
      [17, 0],  // 5:00 PM - Money talk
      [19, 0],  // 7:00 PM - Evening reflection
      [21, 0],  // 9:00 PM - Content clip
      [23, 0],  // 11:00 PM - Night owl motivation
    ],
  },

  // Personal brand uses same schedule as abdullah
  personal: {
    timezone: 'America/Chicago',
    slots: [
      [5, 30],
      [7, 0],
      [9, 0],
      [11, 0],
      [13, 0],
      [15, 0],
      [17, 0],
      [19, 0],
      [21, 0],
      [23, 0],
    ],
  },

  // Carz — 5 Posts Per Day
  carz: {
    timezone: 'America/Chicago',
    slots: [
      [7, 0],   // 7:00 AM - Morning hack
      [12, 0],  // 12:00 PM - Lunch dealer expose
      [16, 0],  // 4:00 PM - Afternoon tip
      [19, 0],  // 7:00 PM - Evening industry news
      [21, 30], // 9:30 PM - Late night trick
    ],
  },

  // Gaza — 5 Posts Per Day
  gaza: {
    timezone: 'America/Chicago',
    slots: [
      [8, 0],   // 8:00 AM - Morning update
      [12, 0],  // 12:00 PM - Midday story
      [17, 0],  // 5:00 PM - Afternoon spotlight
      [20, 0],  // 8:00 PM - Evening reflection
      [22, 0],  // 10:00 PM - Night awareness
    ],
  },
};

// Track which slots have been used today per brand
// Key: "brand-YYYY-MM-DD", Value: Set of used slot indices
const usedSlotsCache: Map<string, Set<number>> = new Map();

/**
 * Get current time in brand's timezone
 */
function getCurrentTimeInTimezone(timezone: string): Date {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);

  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

  const year = parseInt(getPart('year'));
  const month = parseInt(getPart('month')) - 1;
  const day = parseInt(getPart('day'));
  const hour = parseInt(getPart('hour'));
  const minute = parseInt(getPart('minute'));
  const second = parseInt(getPart('second'));

  return new Date(year, month, day, hour, minute, second);
}

/**
 * Convert a time slot to a Date object for a specific day
 */
function slotToDate(slot: TimeSlot, baseDate: Date, timezone: string): Date {
  const [hour, minute] = slot;

  // Create date in the target timezone
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  // Create a date string in the target timezone
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

  // Parse as if it's in the target timezone, then convert to UTC
  const localDate = new Date(dateStr);

  // Get the offset for this timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  });

  // For CST (America/Chicago), we need to add the offset to get UTC
  // This is a simplified approach - we're creating the date in local time
  // and will format it properly for the YouTube API
  return localDate;
}

/**
 * Get cache key for tracking used slots
 */
function getCacheKey(brand: YouTubeBrand, date: Date): string {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${brand}-${dateStr}`;
}

/**
 * Mark a slot as used
 */
export function markSlotUsed(brand: YouTubeBrand, slotIndex: number): void {
  const schedule = BRAND_SCHEDULES[brand];
  if (!schedule) return;

  const now = getCurrentTimeInTimezone(schedule.timezone);
  const cacheKey = getCacheKey(brand, now);

  if (!usedSlotsCache.has(cacheKey)) {
    usedSlotsCache.set(cacheKey, new Set());
  }

  usedSlotsCache.get(cacheKey)!.add(slotIndex);
}

/**
 * Get the next available scheduled time for a brand
 * Returns ISO string for YouTube API publishAt parameter
 */
export function getNextScheduledTime(brand: YouTubeBrand): { publishAt: string; slotIndex: number } | null {
  const schedule = BRAND_SCHEDULES[brand];
  if (!schedule) {
    console.error(`❌ No schedule found for brand: ${brand}`);
    return null;
  }

  const now = getCurrentTimeInTimezone(schedule.timezone);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  const cacheKey = getCacheKey(brand, now);
  const usedSlots = usedSlotsCache.get(cacheKey) || new Set();

  console.log(`📅 [${brand}] Finding next slot...`);
  console.log(`   Current time (${schedule.timezone}): ${currentHour}:${String(currentMinute).padStart(2, '0')}`);
  console.log(`   Used slots today: ${Array.from(usedSlots).join(', ') || 'none'}`);

  // Find next available slot today
  for (let i = 0; i < schedule.slots.length; i++) {
    if (usedSlots.has(i)) continue;

    const [hour, minute] = schedule.slots[i];
    const slotTimeInMinutes = hour * 60 + minute;

    // Slot must be at least 10 minutes in the future
    if (slotTimeInMinutes > currentTimeInMinutes + 10) {
      const publishDate = new Date(now);
      publishDate.setHours(hour, minute, 0, 0);

      // Convert to ISO string for YouTube API
      // YouTube expects ISO 8601 format in UTC
      const utcDate = new Date(publishDate.getTime());

      // Adjust for CST offset (-6 hours, or -5 during DST)
      // For simplicity, we'll use the local time and let YouTube handle it
      const publishAt = publishDate.toISOString();

      console.log(`   ✅ Next slot: ${hour}:${String(minute).padStart(2, '0')} (slot index ${i})`);
      console.log(`   📤 publishAt: ${publishAt}`);

      return { publishAt, slotIndex: i };
    }
  }

  // No slots available today, get first slot tomorrow
  console.log(`   ⏭️  No more slots today, scheduling for tomorrow...`);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowCacheKey = getCacheKey(brand, tomorrow);
  const tomorrowUsedSlots = usedSlotsCache.get(tomorrowCacheKey) || new Set();

  // Find first available slot tomorrow
  for (let i = 0; i < schedule.slots.length; i++) {
    if (tomorrowUsedSlots.has(i)) continue;

    const [hour, minute] = schedule.slots[i];

    const publishDate = new Date(tomorrow);
    publishDate.setHours(hour, minute, 0, 0);

    const publishAt = publishDate.toISOString();

    console.log(`   ✅ Tomorrow's slot: ${hour}:${String(minute).padStart(2, '0')} (slot index ${i})`);
    console.log(`   📤 publishAt: ${publishAt}`);

    return { publishAt, slotIndex: i };
  }

  // All slots used (shouldn't happen normally)
  console.error(`   ❌ All slots used for ${brand}!`);
  return null;
}

/**
 * Get all available slots for today for a brand
 */
export function getAvailableSlotsToday(brand: YouTubeBrand): { time: string; slotIndex: number }[] {
  const schedule = BRAND_SCHEDULES[brand];
  if (!schedule) return [];

  const now = getCurrentTimeInTimezone(schedule.timezone);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  const cacheKey = getCacheKey(brand, now);
  const usedSlots = usedSlotsCache.get(cacheKey) || new Set();

  const available: { time: string; slotIndex: number }[] = [];

  for (let i = 0; i < schedule.slots.length; i++) {
    if (usedSlots.has(i)) continue;

    const [hour, minute] = schedule.slots[i];
    const slotTimeInMinutes = hour * 60 + minute;

    if (slotTimeInMinutes > currentTimeInMinutes + 10) {
      const timeStr = `${hour}:${String(minute).padStart(2, '0')}`;
      available.push({ time: timeStr, slotIndex: i });
    }
  }

  return available;
}

/**
 * Get schedule info for a brand
 */
export function getScheduleInfo(brand: YouTubeBrand): { slotsPerDay: number; timezone: string; slots: string[] } | null {
  const schedule = BRAND_SCHEDULES[brand];
  if (!schedule) return null;

  return {
    slotsPerDay: schedule.slots.length,
    timezone: schedule.timezone,
    slots: schedule.slots.map(([h, m]) => `${h}:${String(m).padStart(2, '0')}`),
  };
}

/**
 * Reset used slots cache (for testing or daily reset)
 */
export function resetUsedSlots(brand?: YouTubeBrand): void {
  if (brand) {
    // Reset specific brand
    const keysToDelete: string[] = [];
    usedSlotsCache.forEach((_, key) => {
      if (key.startsWith(brand)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => usedSlotsCache.delete(key));
  } else {
    // Reset all
    usedSlotsCache.clear();
  }
}

/**
 * Get schedule for all brands (for debugging/display)
 */
export function getAllSchedules(): Record<string, { slotsPerDay: number; slots: string[] }> {
  const result: Record<string, { slotsPerDay: number; slots: string[] }> = {};

  for (const [brand, schedule] of Object.entries(BRAND_SCHEDULES)) {
    result[brand] = {
      slotsPerDay: schedule.slots.length,
      slots: schedule.slots.map(([h, m]) => `${h}:${String(m).padStart(2, '0')}`),
    };
  }

  return result;
}
