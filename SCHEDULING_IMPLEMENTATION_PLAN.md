# Platform-Specific Optimal Scheduling Implementation Plan

## Problem
- Currently ALL videos post at same times (8am/1pm/7pm) regardless of which video it is
- Using `publishNow: true` causes 30s+ timeouts (Late uploads to all platforms synchronously)
- Need each of 5 daily videos to post at different optimal times per platform

## Solution Architecture

### Key Insight
**Each platform has 3 optimal posting times. We generate 5 videos/day. Cycle through the 3 times:**
- Video 0 → Time slot 0 (11am for Instagram, 8am for LinkedIn, etc.)
- Video 1 → Time slot 1 (2pm for Instagram, 12pm for LinkedIn, etc.)
- Video 2 → Time slot 2 (7pm for Instagram, 5pm for LinkedIn, etc.)
- Video 3 → Time slot 0 (cycle back)
- Video 4 → Time slot 1 (cycle back)

### Platform Optimal Times (Industry Data)
```typescript
instagram: [11, 14, 19]  // 11am, 2pm, 7pm CST
tiktok: [12, 16, 19]     // 12pm, 4pm, 7pm CST
facebook: [12, 15, 19]   // 12pm, 3pm, 7pm CST
linkedin: [8, 12, 17]    // 8am, 12pm, 5pm CST
youtube: [12, 15, 20]    // 12pm, 3pm, 8pm CST
twitter: [8, 12, 17]     // 8am, 12pm, 5pm CST
threads: [11, 14, 19]    // 11am, 2pm, 7pm CST
bluesky: [8, 12, 17]     // 8am, 12pm, 5pm CST
```

## Required Changes

### 1. Add Video Index Tracking
**File: `/api/workflow/complete-viral/route.ts`**
- Calculate which post of the day this is (0-4)
- Store `videoIndex` in Firestore workflow
- Pass to HeyGen/Submagic webhooks

**How to calculate:**
```typescript
// Count workflows created today for this brand
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

const todayWorkflows = await db.collection(`${brand}_workflow_queue`)
  .where('createdAt', '>=', todayStart.getTime())
  .get();

const videoIndex = todayWorkflows.size; // 0-4
```

### 2. Update Process-Video Endpoint
**File: `/api/process-video/route.ts`**

**REMOVE:**
```typescript
const { postToMultiplePlatformGroups } = await import('@/lib/platform-scheduling');
const postResult = await postToMultiplePlatformGroups(...);
```

**REPLACE WITH:**
```typescript
const { scheduleVideoToAllPlatforms } = await import('@/lib/optimal-platform-scheduling');
const videoIndex = workflow.videoIndex || 0;
const postResult = await scheduleVideoToAllPlatforms(
  publicVideoUrl,
  caption,
  title,
  brand,
  videoIndex  // ← This determines which time slots to use
);
```

### 3. Files Already Created ✅
- `/src/config/platform-optimal-times.ts` - Platform schedules
- `/src/lib/optimal-platform-scheduling.ts` - Scheduling logic

## Example: Carz Brand (has all platforms)

**Video 0 (9am cron):**
- LinkedIn at 8am tomorrow
- Instagram/Threads at 11am tomorrow
- TikTok/Facebook/YouTube at 12pm tomorrow

**Video 1 (12pm cron):**
- LinkedIn at 12pm tomorrow
- Instagram/Threads at 2pm tomorrow
- TikTok at 4pm tomorrow
- Facebook/YouTube at 3pm tomorrow

**Video 2 (3pm cron):**
- LinkedIn at 5pm tomorrow
- Instagram/Threads/TikTok/Facebook at 7pm tomorrow
- YouTube at 8pm tomorrow

**Video 3 (6pm cron):**
- Same as Video 0 (cycles back)

**Video 4 (9pm cron):**
- Same as Video 1 (cycles back)

## Key Benefits
1. ✅ No more `publishNow: true` = no timeouts
2. ✅ Each platform posts at its optimal engagement times
3. ✅ Same video hits all platforms at different times
4. ✅ 24-hour advance scheduling (time for processing)
5. ✅ All 5 daily videos used same day (tomorrow)

## Implementation Steps
1. Update `complete-viral/route.ts` to track videoIndex
2. Update Firestore workflow schema to include videoIndex
3. Update `process-video/route.ts` to use optimal scheduling
4. Test with one brand
5. Deploy

## Property System
Needs separate queue-based cron (5x/day) - implement after main system works.
