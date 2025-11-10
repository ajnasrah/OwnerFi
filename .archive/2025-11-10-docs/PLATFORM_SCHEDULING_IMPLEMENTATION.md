# Platform-Specific Scheduling System - Implementation Summary

## What Changed

Previously, all platforms posted at the same time (24 hours from video completion). Now, different platforms post at their optimal engagement times based on 2025 analytics.

## New Posting Schedule

### 3 Platform Groups (All times in CST)

**Group 1: Professional Platforms (8 AM)**
- LinkedIn, Twitter, Bluesky
- Target: B2B audience checking feeds before work

**Group 2: Midday Platforms (1 PM)**
- Facebook, YouTube
- Target: Lunch scrolling and afternoon break

**Group 3: Evening Platforms (7 PM)**
- TikTok, Instagram, Threads
- Target: Peak entertainment engagement

**Special Case: VassDistro**
- Group 3 posts at 5 PM instead (B2B owners ending workday)

## Implementation

### New Files Created

1. **src/lib/platform-scheduling.ts**
   - `getPlatformGroups(brand)` - Gets 3 optimized groups per brand
   - `postToMultiplePlatformGroups()` - Posts to all groups at their optimal times
   - `createScheduleTime()` - Converts CST hour to UTC ISO 8601
   - `validatePlatformGroups()` - Ensures all platforms covered

2. **scripts/validate-platform-groups.ts**
   - Quick validation that all platforms are assigned to groups
   - Run: `npx tsx scripts/validate-platform-groups.ts`

3. **scripts/test-platform-scheduling.ts**
   - Full 2-day test suite with Firebase integration
   - Day 1: Verify workflows have scheduling data
   - Day 2: Monitor posts going live

4. **PLATFORM_POSTING_SCHEDULE.md**
   - Full documentation of research, strategy, and implementation
   - Includes alternative approaches considered

### Files Modified

1. **src/app/api/webhooks/submagic/[brand]/route.ts**
   - Now calls `postToMultiplePlatformGroups()` instead of single `postToLate()`
   - Saves additional workflow data: `platformGroups`, `scheduledPlatforms`
   - Stores all post IDs (one per platform group)

## Brand-Specific Schedules

### Carz (6 platforms)
- 8 AM: LinkedIn
- 1 PM: Facebook, YouTube
- 7 PM: Instagram, TikTok, Threads

### OwnerFi / Benefit / Property (6-8 platforms)
- 8 AM: LinkedIn, Twitter, Bluesky (if applicable)
- 1 PM: Facebook, YouTube
- 7 PM: Instagram, TikTok, Threads

### Podcast (6 platforms)
- 8 AM: LinkedIn
- 1 PM: Facebook, YouTube
- 7 PM: Instagram, TikTok, Threads

### VassDistro (6 platforms - B2B)
- 8 AM: LinkedIn
- 1 PM: Facebook, YouTube
- 5 PM: Instagram, TikTok, Threads *(earlier for B2B)*

### Abdullah (5 platforms)
- 8 AM: LinkedIn
- 1 PM: Facebook, YouTube
- 7 PM: Instagram, TikTok

## Testing & Deployment

### Pre-Deployment Validation

```bash
npx tsx scripts/validate-platform-groups.ts
```
✅ All brands have 100% platform coverage

### Deployment Steps

1. Commit changes
2. Push to GitHub
3. Vercel auto-deploys to production
4. Monitor first video workflows

### Post-Deployment Testing

**Day 1: Workflow Verification**
```bash
# After cron jobs run (9 AM, 12 PM, 3 PM, 6 PM, 9 PM)
npx tsx scripts/test-platform-scheduling.ts --day 1
```
Expected: All completed workflows have `platformGroups: 3` and `scheduledPlatforms: X`

**Day 2: Post Publishing Verification**
- 8 AM CST: Check LinkedIn, Twitter, Bluesky posts go live
- 1 PM CST: Check Facebook, YouTube posts go live
- 7 PM CST: Check TikTok, Instagram, Threads posts go live

Manual check: https://app.getlate.dev/posts?status=scheduled

## Expected Daily Output

**31 videos/day = 93 scheduled posts/day** (31 videos × 3 platform groups)

### Breakdown by Brand

| Brand | Videos/Day | Platform Groups | Total Posts |
|-------|------------|----------------|-------------|
| Carz | 5 | 3 | 15 |
| OwnerFi | 5 | 3 | 15 |
| VassDistro | 1 | 3 | 3 |
| Benefit | 5 | 3 | 15 |
| Property | 5 | 3 | 15 |
| Abdullah | 5 | 3 | 15 |
| Podcast | 5 | 3 | 15 |
| **TOTAL** | **31** | - | **93** |

## Benefits

1. **Maximized Engagement** - Each platform posts at its peak time
2. **Algorithm Friendly** - Spreads posts throughout day (looks organic)
3. **Better Analytics** - Can measure which time slots perform best per platform
4. **Professional Appearance** - No "spam" perception from posting all at once

## Rollback Plan

If issues occur:

1. Revert `src/app/api/webhooks/submagic/[brand]/route.ts` to single `postToLate()` call
2. Use original 24-hour scheduling (all platforms at once)
3. Investigate logs and fix issues
4. Re-deploy when ready

## Monitoring

### Vercel Logs
```bash
vercel logs --follow
```

Watch for:
- `📅 Scheduling to X platform groups` - Should see 3 groups
- `✅ Scheduled successfully` - All 3 groups should succeed
- `❌ Failed:` - Any failures to investigate

### Firestore Data

Check completed workflows have:
```javascript
{
  status: 'completed',
  platformGroups: 3,
  scheduledPlatforms: 5-8, // Depends on brand
  latePostId: 'id1, id2, id3', // Comma-separated
}
```

### Late.dev Dashboard

https://app.getlate.dev/posts

- Should see 3 scheduled posts per video
- Times: 8 AM, 1 PM, 7 PM CST (next day)
- Platforms distributed correctly

## Future Optimizations

After 2-day test proves successful:

1. **Day-of-Week Optimization** - TikTok on Tue/Thu/Fri (best days)
2. **A/B Testing** - Try different time slots to optimize further
3. **Dynamic Adjustment** - Auto-adjust times based on engagement data
4. **First Comments** - Add engagement-boosting first comments
5. **Hashtag Strategy** - Platform-specific hashtag optimization

## Research Sources

Based on 2025 analytics from:
- Buffer's "Best Time to Post on Social Media 2025"
- Sprout Social's "Best Times to Post 2025"
- ClipGoat's TikTok/YouTube Shorts study
- Metricool's social media timing data

Key findings:
- TikTok: 6-9 PM peak (entertainment)
- Instagram: 7-10 PM peak (Reels)
- YouTube: 4-5 PM best (Shorts)
- LinkedIn: 7-9 AM peak (professional)
- Facebook: 1-3 PM lunch scroll
