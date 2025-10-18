# Late Queue Integration Guide

Your social media and podcast posting system now uses Late's queue feature! This allows you to configure posting schedules on the fly and automatically schedule content to the next available time slot.

## What Changed?

**Before:** Custom scheduling logic that checked for available hours in Firestore
**After:** Late's queue system that you can configure via API or dashboard

## Benefits

1. **Change schedules on the fly** - Update posting times without code changes
2. **Visual management** - Configure queues in Late's dashboard
3. **Smart scheduling** - Automatically avoids conflicts and fills the next available slot
4. **Per-brand control** - Each brand (OwnerFi, Carz, Podcast) has independent queue schedules
5. **Better reliability** - Late handles all scheduling logic and conflict detection

## Setup

### 1. Configure Queue Schedules

Edit `scripts/setup-late-queues.ts` to customize your posting schedule for each brand:

```typescript
const OWNERFI_QUEUE = {
  timezone: 'America/New_York',
  slots: [
    { dayOfWeek: 1, time: '09:00' }, // Monday 9 AM
    { dayOfWeek: 3, time: '14:00' }, // Wednesday 2 PM
    { dayOfWeek: 5, time: '17:00' }, // Friday 5 PM
  ]
};
```

**Day of Week:**
- 0 = Sunday
- 1 = Monday
- 2 = Tuesday
- 3 = Wednesday
- 4 = Thursday
- 5 = Friday
- 6 = Saturday

**Time Format:** 24-hour format "HH:MM" (e.g., "09:00", "14:30", "22:00")

### 2. Run the Setup Script

```bash
npm run setup-queues
```

This will configure all three brand queues (OwnerFi, Carz, Podcast) in Late.

### 3. View Current Queues

```bash
npm run view-queues
```

This shows the current queue configuration for all brands.

## How It Works

### For Social Media Posts (OwnerFi & Carz)

When a video completes processing in Submagic:

1. Webhook receives completion notification
2. Video is uploaded to R2
3. System calls Late's `/queue/next-slot` API to get next available time
4. Post is created with `useQueue: true` and scheduled to that slot
5. Post is marked with `queuedFromProfile` to track it as queued

### For Podcast Episodes

Same workflow as social media, but uses the Podcast brand's queue schedule.

## Code Changes

### Updated Files

1. **`src/lib/late-api.ts`**
   - Added `getNextQueueSlot()` - Gets next available queue slot
   - Added `getQueueSchedule()` - Views current queue configuration
   - Added `setQueueSchedule()` - Updates queue configuration
   - Updated `postToLate()` - Supports `useQueue: true` parameter

2. **`src/app/api/webhooks/submagic/route.ts`**
   - Removed custom `getNextAvailableTimeSlot()` calls
   - Now uses `useQueue: true` when calling `postToLate()`
   - Simplified scheduling logic

3. **`scripts/setup-late-queues.ts`** (NEW)
   - Script to configure queue schedules
   - Can be customized for your posting needs

## Managing Queues

### Via Script (Recommended for bulk changes)

Edit `scripts/setup-late-queues.ts` and run:
```bash
npm run setup-queues
```

### Via Late Dashboard

1. Go to https://getlate.dev/dashboard
2. Navigate to your profile settings
3. Configure queue slots visually
4. Changes take effect immediately

### Via API

Use the exported functions from `late-api.ts`:

```typescript
import { setQueueSchedule, getQueueSchedule } from '@/lib/late-api';

// View current schedule
const schedule = await getQueueSchedule('ownerfi');

// Update schedule
await setQueueSchedule('ownerfi', [
  { dayOfWeek: 1, time: '09:00' },
  { dayOfWeek: 3, time: '14:00' }
], 'America/New_York');
```

## Example Queue Configurations

### High Frequency (Daily posting)
```typescript
{
  timezone: 'America/New_York',
  slots: [
    { dayOfWeek: 1, time: '09:00' },
    { dayOfWeek: 2, time: '09:00' },
    { dayOfWeek: 3, time: '09:00' },
    { dayOfWeek: 4, time: '09:00' },
    { dayOfWeek: 5, time: '09:00' },
  ]
}
```

### Multiple Daily Posts
```typescript
{
  timezone: 'America/New_York',
  slots: [
    { dayOfWeek: 1, time: '09:00' },
    { dayOfWeek: 1, time: '15:00' },
    { dayOfWeek: 1, time: '20:00' },
    { dayOfWeek: 3, time: '09:00' },
    { dayOfWeek: 3, time: '15:00' },
    { dayOfWeek: 3, time: '20:00' },
    { dayOfWeek: 5, time: '09:00' },
    { dayOfWeek: 5, time: '15:00' },
    { dayOfWeek: 5, time: '20:00' },
  ]
}
```

### Weekend Only
```typescript
{
  timezone: 'America/New_York',
  slots: [
    { dayOfWeek: 0, time: '10:00' }, // Sunday
    { dayOfWeek: 0, time: '18:00' },
    { dayOfWeek: 6, time: '10:00' }, // Saturday
    { dayOfWeek: 6, time: '18:00' },
  ]
}
```

## Testing

To test the queue integration:

1. **View your current queues:**
   ```bash
   npm run view-queues
   ```

2. **Trigger a test post** (if you have test endpoints)

3. **Check Late dashboard** to see the scheduled post with the correct time slot

4. **Verify in logs** - Look for:
   ```
   📅 Using queue for ownerfi...
   Next queue slot: 2024-01-17T14:00:00Z (America/New_York)
   ```

## Troubleshooting

### Queue not found error

**Solution:** Run `npm run setup-queues` to configure queues

### Posts scheduling immediately instead of using queue

**Possible causes:**
- Queue not configured for that brand's profile
- Queue API call failed (check logs for warnings)
- Falls back to immediate posting if queue unavailable

**Solution:** Check queue configuration and API credentials

### Wrong timezone

**Solution:** Update timezone in queue configuration:
```bash
# Edit scripts/setup-late-queues.ts
# Change timezone: 'America/New_York' to your timezone
npm run setup-queues
```

### Want to change schedule without affecting existing posts

Use `reshuffleExisting: false` (default):
```typescript
await setQueueSchedule('ownerfi', newSlots, 'America/New_York', false);
```

### Want to reschedule all queued posts

Use `reshuffleExisting: true`:
```typescript
await setQueueSchedule('ownerfi', newSlots, 'America/New_York', true);
```

## Environment Variables

Make sure these are set in your `.env.local`:

```bash
LATE_API_KEY=your_api_key
LATE_OWNERFI_PROFILE_ID=ownerfi_profile_id
LATE_CARZ_PROFILE_ID=carz_profile_id
LATE_PODCAST_PROFILE_ID=podcast_profile_id
```

## Additional Resources

- [Late API Documentation](https://getlate.dev/docs#queue)
- [Late Dashboard](https://getlate.dev/dashboard)
- [IANA Timezone List](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

## Questions?

The queue system is now fully integrated into your automated posting workflow. All social media posts and podcast episodes will automatically use the next available queue slot based on your configured schedule.

You can change the schedule anytime without affecting your code - just update it in Late's dashboard or run the setup script again!
