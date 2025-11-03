# Platform-Specific Posting Schedule System

## Overview
Instead of posting to all platforms at once, we schedule each platform at its optimal engagement time based on 2025 analytics data.

## Optimal Times by Platform (CST/CDT)

### TikTok - Entertainment Peak Times
- **Primary Window**: 5PM-9PM (peak engagement)
- **Secondary**: 6AM-10AM (morning commute)
- **Late Night**: 9PM-12AM (highest activity block)
- **Best Days**: Tuesday, Thursday, Friday

### Instagram Reels - Evening Focus
- **Primary Window**: 7PM-10PM (peak at 8PM)
- **Secondary**: 11AM-1PM (lunch scroll)
- **Morning**: 6AM-9AM (pre-work)
- **Best Days**: Friday

### YouTube Shorts - Mixed Schedule
- **Primary**: 4PM-5PM (Tuesday/Wednesday best)
- **Secondary**: 2PM-5PM (post-lunch slump)
- **Late**: 1AM Sunday (unexpected high engagement)

### Facebook - Traditional Social
- **Primary**: 1PM-3PM (lunch/afternoon break)
- **Secondary**: 7PM-9PM (evening)

### LinkedIn - B2B Professional
- **Primary**: 7AM-9AM (before work)
- **Secondary**: 12PM-1PM (lunch)
- **Tertiary**: 5PM-6PM (end of workday)

### Twitter/X & Bluesky - News Cycle
- **Primary**: 8AM-10AM (morning news)
- **Secondary**: 12PM-1PM (lunch)
- **Tertiary**: 5PM-6PM (commute home)

### Threads - Instagram Adjacent
- **Similar to Instagram**: 7PM-10PM
- **Secondary**: 11AM-1PM

---

## Current Video Generation Schedule

### Daily Video Output (31 videos/day)

| Brand | Videos/Day | Cron Schedule | Platforms |
|-------|-----------|---------------|-----------|
| **Carz** (viral) | 5 | 9AM, 12PM, 3PM, 6PM, 9PM | IG, TT, YT, FB, LI, Threads |
| **OwnerFi** (viral) | 5 | 9AM, 12PM, 3PM, 6PM, 9PM | IG, TT, YT, FB, LI, Threads, Twitter, Bluesky |
| **VassDistro** | 1 | 10AM | IG, TT, YT, FB, LI, Threads |
| **Benefit** | 5 | 9:20AM, 12:20PM, 3:20PM, 6:20PM, 9:20PM | IG, TT, YT, FB, LI, Threads |
| **Property** | 5 | 9:40AM, 12:40PM, 3:40PM, 6:40PM, 9:40PM | IG, TT, YT, FB, LI, Threads |
| **Abdullah** | 5 | 8:30AM, 11:30AM, 2:30PM, 5:30PM, 8:30PM | IG, TT, YT, FB, LI |
| **Podcast** | 5 | 9AM, 12PM, 3PM, 6PM, 9PM | IG, TT, YT, FB, LI, Threads |

---

## Proposed Solution: Platform-Specific Scheduling

### Option 1: Staggered Multi-Platform Posting (RECOMMENDED)

Each video gets scheduled to post at different times for each platform, optimized for that platform's peak engagement.

**Example for a 9AM Video Generation:**
```
Video Generated: 9:00 AM (Submagic completes ~9:30 AM)

Platform Posting Schedule (24 hours from Submagic completion):
- TikTok:      Tomorrow 7:00 PM (peak engagement)
- Instagram:   Tomorrow 8:00 PM (peak engagement)
- YouTube:     Tomorrow 4:00 PM (afternoon peak)
- Facebook:    Tomorrow 1:00 PM (lunch time)
- LinkedIn:    Tomorrow 8:00 AM (morning professional)
- Twitter:     Tomorrow 9:00 AM (morning news cycle)
- Bluesky:     Tomorrow 9:00 AM (morning news cycle)
- Threads:     Tomorrow 7:30 PM (evening)
```

**Benefits:**
✅ Maximum engagement per platform
✅ Spreads posts throughout the day (better for algorithm)
✅ Reduces "spam" perception (not all at once)
✅ Better analytics (can see which platform times work best)

**Challenges:**
⚠️ Requires Late API to support per-platform scheduling
⚠️ More complex scheduling logic
⚠️ Need to track 8 scheduled posts per video instead of 1

---

### Option 2: Rotating Daily Time Slots (SIMPLER)

Pick 5 optimal time slots that work well across all platforms, rotate videos through them.

**Time Slots (CST):**
1. **8:00 AM** - LinkedIn/Professional content (Abdullah, B2B)
2. **12:00 PM** - Lunch scroll (All platforms moderate engagement)
3. **4:00 PM** - Afternoon break (YouTube peak, TikTok starting)
4. **7:00 PM** - Evening prime time (TikTok + Instagram peak)
5. **9:00 PM** - Night owls (TikTok extended peak)

**Daily Rotation:**
- Video 1 (9AM generation) → Posts tomorrow at 8AM
- Video 2 (12PM generation) → Posts tomorrow at 12PM
- Video 3 (3PM generation) → Posts tomorrow at 4PM
- Video 4 (6PM generation) → Posts tomorrow at 7PM
- Video 5 (9PM generation) → Posts tomorrow at 9PM

**Benefits:**
✅ Simple to implement (one time per video)
✅ All platforms post simultaneously
✅ Covers major engagement windows
✅ Easy to understand and debug

**Challenges:**
⚠️ Not optimized per platform
⚠️ LinkedIn posts at night (not ideal)
⚠️ YouTube posts same time as TikTok (could be spread better)

---

### Option 3: Platform Priority Groups (BALANCED)

Group platforms by similar optimal times, schedule 2-3 posting waves per video.

**Group 1: Professional Platforms (8 AM)**
- LinkedIn
- Twitter
- Bluesky

**Group 2: Midday Platforms (1 PM)**
- Facebook
- YouTube

**Group 3: Evening Entertainment (7 PM)**
- TikTok
- Instagram
- Threads

**Example Schedule:**
```
Video Generated: 9:00 AM
- Group 1 posts: Tomorrow 8:00 AM (LinkedIn, Twitter, Bluesky)
- Group 2 posts: Tomorrow 1:00 PM (Facebook, YouTube)
- Group 3 posts: Tomorrow 7:00 PM (TikTok, Instagram, Threads)
```

**Benefits:**
✅ Better platform optimization than Option 2
✅ Simpler than Option 1 (3 schedules vs 8)
✅ Natural platform grouping
✅ Spreads content throughout day

**Challenges:**
⚠️ Need to check if Late API supports per-platform group scheduling
⚠️ Slightly more complex logic

---

## Implementation Recommendation

I recommend **Option 3: Platform Priority Groups** because:

1. **Best Balance**: Optimizes for platform behavior without overcomplications
2. **Algorithm Friendly**: Spreads posts across 3 waves (looks more organic)
3. **Practical**: Late API likely supports this (send 3 separate API calls)
4. **Debuggable**: Only 3 schedule times to track per video
5. **Flexible**: Easy to adjust groups based on analytics

---

## Implementation Plan

### Phase 1: Update Submagic Webhook Logic

Current: Calculate one `scheduleTime` 24 hours from now
New: Calculate THREE `scheduleTimes` based on platform groups

```typescript
// After Submagic completes and video uploaded to R2...

const now = new Date();
const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));

// Group 1: Professional platforms (8 AM CST tomorrow)
const group1Time = new Date(tomorrow);
group1Time.setHours(8, 0, 0, 0); // 8:00 AM CST

// Group 2: Midday platforms (1 PM CST tomorrow)
const group2Time = new Date(tomorrow);
group2Time.setHours(13, 0, 0, 0); // 1:00 PM CST

// Group 3: Evening platforms (7 PM CST tomorrow)
const group3Time = new Date(tomorrow);
group3Time.setHours(19, 0, 0, 0); // 7:00 PM CST

// Post to each group separately
await postToLate({
  videoUrl: publicVideoUrl,
  caption,
  title,
  platforms: ['linkedin', 'twitter', 'bluesky'],
  scheduleTime: group1Time.toISOString(),
  timezone: 'America/Chicago',
  useQueue: false,
  brand,
});

await postToLate({
  videoUrl: publicVideoUrl,
  caption,
  title,
  platforms: ['facebook', 'youtube'],
  scheduleTime: group2Time.toISOString(),
  timezone: 'America/Chicago',
  useQueue: false,
  brand,
});

await postToLate({
  videoUrl: publicVideoUrl,
  caption,
  title,
  platforms: ['instagram', 'tiktok', 'threads'],
  scheduleTime: group3Time.toISOString(),
  timezone: 'America/Chicago',
  useQueue: false,
  brand,
});
```

### Phase 2: Brand-Specific Customization

Different brands have different platform mixes:

**Abdullah** (no Twitter/Bluesky/Threads):
- Group 1 (8 AM): LinkedIn
- Group 2 (1 PM): Facebook, YouTube
- Group 3 (7 PM): Instagram, TikTok

**Carz** (no Twitter/Bluesky):
- Group 1: LinkedIn
- Group 2: Facebook, YouTube
- Group 3: Instagram, TikTok, Threads

**OwnerFi/Benefit/Property** (all platforms):
- Use all 3 groups as defined

**VassDistro** (B2B focused):
- Shift Group 3 earlier (5 PM instead of 7 PM for B2B)

### Phase 3: Create Reusable Function

```typescript
// src/lib/platform-scheduling.ts

interface PlatformGroup {
  platforms: string[];
  hourCST: number; // Hour in CST (0-23)
  label: string;
}

export function getPlatformGroups(brand: Brand): PlatformGroup[] {
  const baseTomorrow = new Date(Date.now() + (24 * 60 * 60 * 1000));

  // Common groups for most brands
  const groups: PlatformGroup[] = [
    {
      platforms: ['linkedin', 'twitter', 'bluesky'],
      hourCST: 8, // 8 AM - Professional morning
      label: 'Professional Platforms',
    },
    {
      platforms: ['facebook', 'youtube'],
      hourCST: 13, // 1 PM - Midday
      label: 'Midday Platforms',
    },
    {
      platforms: ['instagram', 'tiktok', 'threads'],
      hourCST: 19, // 7 PM - Evening entertainment
      label: 'Evening Platforms',
    },
  ];

  // Brand-specific adjustments
  if (brand === 'vassdistro') {
    // B2B brand - earlier evening (5 PM instead of 7 PM)
    groups[2].hourCST = 17;
  }

  if (brand === 'abdullah') {
    // No Twitter/Bluesky/Threads
    groups[0].platforms = ['linkedin'];
    groups[2].platforms = ['instagram', 'tiktok'];
  }

  if (brand === 'carz') {
    // No Twitter/Bluesky
    groups[0].platforms = ['linkedin'];
  }

  // Filter out platforms not used by this brand
  const brandPlatforms = getBrandPlatforms(brand, false);

  return groups
    .map(group => ({
      ...group,
      platforms: group.platforms.filter(p => brandPlatforms.includes(p))
    }))
    .filter(group => group.platforms.length > 0); // Remove empty groups
}

export function createScheduleTime(hourCST: number, baseDate: Date = new Date()): string {
  const scheduleDate = new Date(baseDate);
  scheduleDate.setHours(hourCST, 0, 0, 0);

  // Convert to UTC ISO 8601
  return scheduleDate.toISOString();
}
```

---

## 2-Day Testing Plan

### Day 1: Implementation & Monitoring

**Morning (9 AM - 12 PM):**
1. ✅ Deploy platform-specific scheduling changes
2. ✅ Verify first video generation (9 AM cron runs)
3. ✅ Check Submagic webhook creates 3 scheduled posts per brand
4. ✅ Verify Late API accepts all 3 schedule requests

**Afternoon (12 PM - 6 PM):**
5. ✅ Monitor 3 more video generations (12 PM, 3 PM, 6 PM)
6. ✅ Verify all brands scheduling correctly
7. ✅ Check Firestore for proper workflow status updates

**Evening (6 PM - 11 PM):**
8. ✅ Monitor final video generation (9 PM)
9. ✅ Verify no errors in Vercel logs
10. ✅ Ensure all videos have 3 pending Late posts

**Expected Output (Day 1):**
- 31 videos generated (5 carz, 5 ownerfi, 1 vassdistro, 5 benefit, 5 property, 5 abdullah, 5 podcast)
- 31 × 3 = **93 scheduled posts** created for tomorrow
- 0 errors or stuck workflows

### Day 2: Publishing & Analytics

**Morning (8 AM - 9 AM):**
1. ✅ Watch Group 1 posts go live (LinkedIn, Twitter, Bluesky)
2. ✅ Verify posts appear on each platform
3. ✅ Check engagement starts tracking

**Midday (1 PM - 2 PM):**
4. ✅ Watch Group 2 posts go live (Facebook, YouTube)
5. ✅ Verify midday engagement

**Evening (7 PM - 8 PM):**
6. ✅ Watch Group 3 posts go live (TikTok, Instagram, Threads)
7. ✅ Monitor peak engagement times

**End of Day (11 PM):**
8. ✅ Check all 93 posts published successfully
9. ✅ Review analytics for each platform group
10. ✅ Identify any issues or improvements

**Expected Output (Day 2):**
- 93 posts live across all platforms
- Clear engagement data per platform group
- Confirmation system is fully operational

---

## Success Metrics

After 2-day test:
- ✅ 0% video generation failures
- ✅ 100% of videos scheduled to 3 platform groups
- ✅ 100% of scheduled posts published on time
- ✅ Each platform posting at optimal engagement window
- ✅ No duplicate or missed posts
- ✅ Clear analytics showing group performance

---

## Rollback Plan

If issues occur:
1. Revert Submagic webhook to single-time posting (current 24h ahead)
2. Disable platform grouping, use Option 2 (simple rotation)
3. Fall back to current system (all platforms at once)

---

## Future Optimizations

After 2-day test succeeds:
1. **Analytics Review**: Check which platform groups perform best
2. **A/B Testing**: Try different time slots for underperforming platforms
3. **Day-of-Week**: Schedule TikTok for Tuesday/Thursday/Friday (best days)
4. **Dynamic Adjustment**: Use engagement data to auto-optimize times
5. **Brand Customization**: Fine-tune times per brand based on audience

---

## Questions to Confirm

Before implementing:
1. ✅ Confirm Late API supports multiple scheduled posts per video (different times)
2. ✅ Verify Late API accepts `scheduleTime` + `platforms` array combo
3. ✅ Check if we want to start with Option 2 (simpler) or jump to Option 3 (optimal)
4. ✅ Decide if all brands use same groups or customize per brand immediately
