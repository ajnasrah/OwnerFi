/**
 * Business Hours Enforcement for Agent Outreach
 *
 * TCPA requires: no texts before 8 AM or after 9 PM in the recipient's local time.
 * Our outreach area covers Central + Eastern time zones.
 *
 * We use 9 AM – 8 PM Central (America/Chicago) as our send window.
 * This guarantees:
 *   - Central recipients: 9 AM – 8 PM (safe)
 *   - Eastern recipients: 10 AM – 9 PM (safe)
 */

const TIMEZONE = 'America/Chicago';
const SEND_WINDOW_START = 9;  // 9 AM Central
const SEND_WINDOW_END = 20;   // 8 PM Central (20:00)

/**
 * Check if the current time is within the allowed SMS send window.
 *
 * @returns true if we can send SMS right now, false if outside business hours
 */
export function isWithinBusinessHours(): boolean {
  const now = new Date();
  const centralHour = getCentralHour(now);
  return centralHour >= SEND_WINDOW_START && centralHour < SEND_WINDOW_END;
}

/**
 * Get the current hour in Central time (0-23).
 */
function getCentralHour(date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(formatter.format(date), 10);
}

/**
 * Get the current day of week in Central time (0=Sunday, 6=Saturday).
 */
function getCentralDayOfWeek(date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
  });
  const day = formatter.format(date);
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return dayMap[day] ?? 0;
}

/**
 * Check if it's a weekday in Central time.
 * Some businesses prefer to only text on weekdays.
 */
export function isWeekday(): boolean {
  const day = getCentralDayOfWeek(new Date());
  return day >= 1 && day <= 5;
}

/**
 * Returns a human-readable reason if outside business hours, or null if within hours.
 */
export function getBusinessHoursStatus(): { allowed: boolean; reason?: string } {
  const now = new Date();
  const centralHour = getCentralHour(now);

  if (centralHour < SEND_WINDOW_START) {
    return {
      allowed: false,
      reason: `Too early: ${centralHour}:00 CT (window opens at ${SEND_WINDOW_START}:00 CT)`,
    };
  }

  if (centralHour >= SEND_WINDOW_END) {
    return {
      allowed: false,
      reason: `Too late: ${centralHour}:00 CT (window closed at ${SEND_WINDOW_END}:00 CT)`,
    };
  }

  return { allowed: true };
}
