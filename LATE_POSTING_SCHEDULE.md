# Late.dev Posting Schedule - 5x Daily Per Brand

## Overview
All brands now post **5 times per day** with staggered schedules to maximize engagement and avoid queue conflicts.

---

## 📅 Daily Schedule (All Times in EST/EDT)

### Carz Inc (5 posts/day)
**Cron**: `0 9,12,15,18,21 * * *` (Viral videos from RSS)

| Time (EST) | Content Type | Platform Mix |
|------------|--------------|--------------|
| 9:00 AM    | Viral Video  | All platforms |
| 12:00 PM   | Viral Video  | All platforms |
| 3:00 PM    | Viral Video  | All platforms |
| 6:00 PM    | Viral Video  | All platforms |
| 9:00 PM    | Viral Video  | All platforms |

**Platforms**: Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads

---

### OwnerFi (5 posts/day)
**Cron**: `0 9,12,15,18,21 * * *` (Viral videos from RSS)

| Time (EST) | Content Type | Platform Mix |
|------------|--------------|--------------|
| 9:00 AM    | Viral Video  | All platforms |
| 12:00 PM   | Viral Video  | All platforms |
| 3:00 PM    | Viral Video  | All platforms |
| 6:00 PM    | Viral Video  | All platforms |
| 9:00 PM    | Viral Video  | All platforms |

**Platforms**: Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads, Twitter, Bluesky

---

### Podcast (5 episodes/day)
**Cron**: `0 9,12,15,18,21 * * *` (Central Time = 10 AM, 1 PM, 4 PM, 7 PM, 10 PM EST)

| Time (CST) | Time (EST) | Content Type | Platform Mix |
|------------|------------|--------------|--------------|
| 9:00 AM    | 10:00 AM   | Podcast Episode | All platforms |
| 12:00 PM   | 1:00 PM    | Podcast Episode | All platforms |
| 3:00 PM    | 4:00 PM    | Podcast Episode | All platforms |
| 6:00 PM    | 7:00 PM    | Podcast Episode | All platforms |
| 9:00 PM    | 10:00 PM   | Podcast Episode | All platforms |

**Platforms**: Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads

---

### Benefits (5 videos/day)
**Cron**: `0 10,13,16,19,22 * * *` (Central Time = 11 AM, 2 PM, 5 PM, 8 PM, 11 PM EST)

| Time (CST) | Time (EST) | Content Type | Audience |
|------------|------------|--------------|----------|
| 10:00 AM   | 11:00 AM   | Benefit Video | Seller/Buyer |
| 1:00 PM    | 2:00 PM    | Benefit Video | Seller/Buyer |
| 4:00 PM    | 5:00 PM    | Benefit Video | Seller/Buyer |
| 7:00 PM    | 8:00 PM    | Benefit Video | Seller/Buyer |
| 10:00 PM   | 11:00 PM   | Benefit Video | Seller/Buyer |

**Platforms**: Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads

---

## 🗓️ Late.dev Queue Schedule (EST)

### Hourly Breakdown

| Time (EST) | Brand(s) Posting | Total Videos |
|------------|------------------|--------------|
| 9:00 AM    | Carz, OwnerFi    | 2 |
| 10:00 AM   | Podcast          | 1 |
| 11:00 AM   | Benefits         | 1 |
| 12:00 PM   | Carz, OwnerFi    | 2 |
| 1:00 PM    | Podcast          | 1 |
| 2:00 PM    | Benefits         | 1 |
| 3:00 PM    | Carz, OwnerFi    | 2 |
| 4:00 PM    | Podcast          | 1 |
| 5:00 PM    | Benefits         | 1 |
| 6:00 PM    | Carz, OwnerFi    | 2 |
| 7:00 PM    | Podcast          | 1 |
| 8:00 PM    | Benefits         | 1 |
| 9:00 PM    | Carz, OwnerFi    | 2 |
| 10:00 PM   | Podcast          | 1 |
| 11:00 PM   | Benefits         | 1 |

**Total Daily Videos**: 20 (5 per brand × 4 brands)

---

## 🎯 Peak Engagement Times

### Morning (9 AM - 12 PM EST)
- **9:00 AM**: Carz, OwnerFi start the day
- **10:00 AM**: Podcast joins
- **11:00 AM**: Benefits fills gap
- **12:00 PM**: Carz, OwnerFi midday push

### Afternoon (12 PM - 6 PM EST)
- **1:00 PM**: Podcast after lunch
- **2:00 PM**: Benefits afternoon
- **3:00 PM**: Carz, OwnerFi afternoon peak
- **4:00 PM**: Podcast mid-afternoon
- **5:00 PM**: Benefits commute time

### Evening (6 PM - 11 PM EST)
- **6:00 PM**: Carz, OwnerFi evening commute
- **7:00 PM**: Podcast dinner time
- **8:00 PM**: Benefits prime time
- **9:00 PM**: Carz, OwnerFi peak engagement
- **10:00 PM**: Podcast before bed
- **11:00 PM**: Benefits late night

---

## 📊 Content Distribution

### Daily Totals
- **Carz Inc**: 5 viral videos
- **OwnerFi**: 5 viral videos
- **Podcast**: 5 episodes
- **Benefits**: 5 benefit videos
- **Grand Total**: 20 videos/day

### Weekly Totals
- **Carz Inc**: 35 videos
- **OwnerFi**: 35 videos
- **Podcast**: 35 episodes
- **Benefits**: 35 videos
- **Grand Total**: 140 videos/week

### Monthly Totals (30 days)
- **Carz Inc**: 150 videos
- **OwnerFi**: 150 videos
- **Podcast**: 150 episodes
- **Benefits**: 150 videos
- **Grand Total**: 600 videos/month

---

## 🔄 Workflow Pipeline Timing

### Video Generation to Posting (Per Brand)

```
Hour 0:00 - Cron triggers video generation
  ↓
Hour 0:05 - HeyGen video complete
  ↓
Hour 0:10 - Submagic captions complete
  ↓
Hour 0:15 - Late API schedules post
  ↓
Hour 0:30 - Posted to all platforms
```

**Average workflow**: 30 minutes from trigger to published

---

## 🎬 Late.dev Queue Configuration

### Queue Settings
- **Max concurrent posts**: 5
- **Rate limit**: 100 posts/hour
- **Retry attempts**: 3
- **Retry delay**: 5 minutes

### Platform Priority
1. Instagram (highest engagement)
2. TikTok (viral potential)
3. YouTube (long-term growth)
4. Facebook (reach)
5. LinkedIn (B2B)
6. Threads (new audience)
7. Twitter/Bluesky (real-time)

---

## ⚙️ Cron Job Schedule

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-video",
      "schedule": "0 9,12,15,18,21 * * *",
      "brands": ["carz", "ownerfi"]
    },
    {
      "path": "/api/podcast/cron",
      "schedule": "0 9,12,15,18,21 * * *",
      "timezone": "America/Chicago"
    },
    {
      "path": "/api/benefit/cron",
      "schedule": "0 10,13,16,19,22 * * *",
      "timezone": "America/Chicago"
    }
  ]
}
```

---

## 📈 Expected Performance

### Engagement Goals
- **20 videos/day** = High consistency
- **Staggered posting** = Better queue management
- **No conflicts** = All videos post successfully
- **Peak time coverage** = Maximum reach

### Quality Control
- All videos reviewed before posting
- Captions optimized for each platform
- Hashtags tested for reach
- CTAs aligned with brand goals

---

## 🔧 Monitoring

### Daily Checks (via Dashboard)
- [ ] All 5 Carz videos posted
- [ ] All 5 OwnerFi videos posted
- [ ] All 5 Podcast episodes posted
- [ ] All 5 Benefit videos posted
- [ ] No stuck workflows
- [ ] Late.dev queue healthy

### Weekly Review
- Engagement rates per brand
- Best performing times
- Platform performance
- Content adjustments

---

## 🚨 Troubleshooting

### If Queue Backs Up
1. Check `/api/cron/check-stuck-posting` (runs every 2 hours)
2. Review Late.dev dashboard
3. Retry failed posts manually
4. Adjust timing if persistent conflicts

### If Videos Fail
1. Check HeyGen status
2. Verify Submagic API
3. Test Late API connection
4. Review error logs

---

**Last Updated**: October 2025
**Version**: 2.0 (5x Daily)
