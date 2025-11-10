# Platform-Specific Analytics System
## Complete Implementation Guide

This system provides deep platform-specific analytics to optimize engagement and viewer retention across all social media platforms.

---

## 🎯 What This System Does

1. **Fetches detailed analytics from Late API** - Views, likes, comments, shares, saves per platform
2. **Analyzes platform-specific performance** - Identifies peak times, best days, engagement patterns
3. **Generates AI-powered recommendations** - Tells you exactly when and what to post
4. **Automatically optimizes posting queues** - Adjusts schedules based on data
5. **Creates weekly performance reports** - Comprehensive insights and action items

---

## 📦 Components

### Core Library Files
- **`src/lib/late-analytics-v2.ts`** - Enhanced analytics client with rate limiting
- **`src/lib/late-api.ts`** - Late API integration (already exists)
- **`src/components/PlatformAnalyticsDashboard.tsx`** - UI dashboard component

### API Endpoints
- **`src/app/api/analytics/platforms/route.ts`** - Platform analytics API

### Scripts
1. **`scripts/sync-platform-analytics.ts`** - Sync analytics data from Late API
2. **`scripts/auto-optimize-queues.ts`** - Auto-optimize posting schedules
3. **`scripts/weekly-performance-report.ts`** - Generate weekly reports

### Documentation
- **`PLATFORM_ANALYTICS_STRATEGY.md`** - Complete strategy document
- **`PLATFORM_ANALYTICS_README.md`** - This file

---

## 🚀 Quick Start Guide

### Step 1: Sync Analytics Data (First Time)

Run this to fetch historical analytics from Late API:

```bash
npx tsx scripts/sync-platform-analytics.ts
```

**What it does**:
- Fetches last 30 days of post analytics from Late API
- Stores platform-specific metrics in Firestore (`platform_analytics` collection)
- Respects Late's 30 requests/hour rate limit
- Shows platform performance summary

**Expected output**:
```
📊 PLATFORM-SPECIFIC ANALYTICS SYNC
====================================

Step 1: Syncing analytics from Late API...

📊 Syncing ownerfi platform analytics for last 30 days...
   Found 45 posts with analytics
✅ Synced platform analytics for ownerfi

...

📈 OWNERFI ANALYSIS
   Platform Performance:
   👑 instagram      |    52000 views | 8.50% engagement | 📈 +15%
      └─ Peak times: 07:00 (8500 views), 19:00 (7200 views), 12:00 (6800 views)
   🥈 tiktok         |    48000 views | 7.20% engagement | 📈 +22%
   ...
```

### Step 2: View Analytics Dashboard

Navigate to: **`/admin/analytics`** (or wherever you mount the component)

```tsx
// In your admin page
import PlatformAnalyticsDashboard from '@/components/PlatformAnalyticsDashboard';

export default function AnalyticsPage() {
  return <PlatformAnalyticsDashboard />;
}
```

**Dashboard Features**:
- Platform comparison cards (views, engagement, trends)
- Deep-dive into each platform (peak hours, best days)
- Heatmap visualization of best posting times
- AI-powered recommendations
- Engagement breakdown (likes, comments, shares, saves)

### Step 3: Generate Weekly Report

Every Monday morning, run:

```bash
npx tsx scripts/weekly-performance-report.ts
```

Or for a specific brand:

```bash
npx tsx scripts/weekly-performance-report.ts ownerfi
```

**What you get**:
- Total views, posts, engagement for the week
- Platform-by-platform breakdown
- Top performing post
- Key insights (what's working)
- Strategic recommendations (what to do)
- Performance alerts (what needs attention)

### Step 4: Optimize Posting Queues

Run the optimizer to get data-driven queue recommendations:

```bash
npx tsx scripts/auto-optimize-queues.ts
```

This analyzes your performance and suggests optimal posting times.

**To actually apply the changes**:

```bash
npx tsx scripts/auto-optimize-queues.ts --apply
```

**Or dry run first** (recommended):

```bash
npx tsx scripts/auto-optimize-queues.ts --dry-run
```

---

## 📊 Analytics Data Structure

### Firestore Collection: `platform_analytics`

Each document represents one post on one platform:

```typescript
{
  postId: "late_post_123",
  brand: "ownerfi",
  platform: "instagram",
  publishedAt: "2025-10-25T07:00:00Z",

  // Metrics
  views: 8500,
  likes: 650,
  comments: 45,
  shares: 120,
  saves: 180,
  reach: 12000,
  impressions: 15000,
  engagementRate: 11.5,

  // Time analysis
  hour: 7,
  dayOfWeek: 1,
  dayName: "Monday",

  // Content
  content: "Caption text...",

  // Sync metadata
  lastUpdated: 1730000000000,
  syncedAt: "2025-10-30T10:00:00Z"
}
```

---

## 🎯 Understanding the Recommendations

### Example Recommendation Output:

```json
{
  "platforms": {
    "instagram": {
      "optimalTimes": ["07:00", "12:30", "19:00"],
      "bestDays": ["Monday", "Wednesday", "Friday"],
      "avgEngagement": "8.50%",
      "trend": "up",
      "weekOverWeekGrowth": "+15%",
      "recommendations": [
        "Performance trending up (+15%) - maintain current strategy",
        "Peak performance at 07:00 - schedule more content at this time"
      ]
    }
  },
  "overall": {
    "topPlatform": "instagram",
    "bestTimeSlot": "07:00",
    "actionItems": [
      "Focus on instagram - highest engagement at 8.5%",
      "Capitalize on growth momentum: instagram, tiktok"
    ]
  }
}
```

**How to use this**:
1. **Schedule posts at optimal times** - E.g., Instagram at 7 AM, 12:30 PM, 7 PM
2. **Focus on best days** - Monday, Wednesday, Friday for Instagram
3. **Double down on trending platforms** - If something's growing, post more there
4. **Test fixes on underperforming platforms** - Try different hooks, times, formats

---

## ⏰ Automated Daily/Weekly Workflows

### Option 1: Cron Jobs (Server)

Add to your server's crontab:

```bash
# Daily sync at 6 AM (before first post)
0 6 * * * cd /path/to/ownerfi && npx tsx scripts/sync-platform-analytics.ts

# Weekly report every Monday at 9 AM
0 9 * * 1 cd /path/to/ownerfi && npx tsx scripts/weekly-performance-report.ts

# Weekly queue optimization every Sunday at 11 PM
0 23 * * 0 cd /path/to/ownerfi && npx tsx scripts/auto-optimize-queues.ts --apply
```

### Option 2: Vercel Cron (Serverless)

Create API endpoints for each script:

```typescript
// app/api/cron/sync-analytics/route.ts
import { syncAllBrandsPlatformAnalytics } from '@/lib/late-analytics-v2';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await syncAllBrandsPlatformAnalytics(7);
  return Response.json({ success: true });
}
```

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-analytics",
      "schedule": "0 6 * * *"
    }
  ]
}
```

---

## 🔥 Performance Optimization Tips

### 1. Instagram-Specific

**What the data shows**:
- Saves rate is critical (algorithm boost)
- 7 AM and 7 PM are typically peak times
- Reels 15-30 seconds perform best

**Action items**:
- Use educational hooks that people want to save
- Post at proven peak times
- Test story vs reel performance
- Add value-packed captions

### 2. TikTok-Specific

**What the data shows**:
- Watch time % is king
- Algorithm favors 3-5 posts/day
- First 3 seconds determine success

**Action items**:
- Hook HAS to be powerful (controversy, question, shock)
- Post frequently (2-3x/day minimum)
- Keep videos 15-20 seconds
- Use trending sounds (track in analytics)

### 3. YouTube Shorts-Specific

**What the data shows**:
- CTR on thumbnail matters
- Watch time drives recommendations
- Subscriber conversion is trackable

**Action items**:
- Test different thumbnail styles
- Strong call-to-action at end
- 1-2 posts/day (quality over quantity)
- Educational content performs best

### 4. LinkedIn-Specific

**What the data shows**:
- Business hours perform best (8 AM - 5 PM)
- Professional tone gets 2x more shares
- Comments weigh heavily

**Action items**:
- Post between 8 AM - 12 PM on weekdays
- Educational/value-focused content only
- Respond to every comment (algorithm boost)
- 1 post/day maximum

---

## 📈 Interpreting Engagement Rates

**Excellent** (>8%): Scale up immediately, post more often
**Good** (5-8%): Solid performance, maintain strategy
**Average** (3-5%): Room for improvement, test variations
**Poor** (<3%): Major issues - pivot content, times, or format

**Platform Benchmarks**:
- Instagram: 5-10% is strong
- TikTok: 6-12% is strong
- YouTube: 4-8% is strong
- LinkedIn: 8-15% is strong (higher expected)
- Twitter: 2-5% is normal (lower expected)

---

## 🚨 Troubleshooting

### "No analytics data found"

**Cause**: Haven't run sync script yet
**Fix**: `npx tsx scripts/sync-platform-analytics.ts`

### "Late API rate limit exceeded"

**Cause**: Made too many requests (30/hour limit)
**Fix**: Script automatically waits. Don't run multiple times quickly.

### "Firebase Admin not initialized"

**Cause**: Missing Firebase credentials
**Fix**: Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is set in `.env.local`

### "Profile ID not configured"

**Cause**: Missing Late profile ID for brand
**Fix**: Add `LATE_OWNERFI_PROFILE_ID` etc. to `.env.local`

---

## 🔐 Required Environment Variables

```bash
# Late API
LATE_API_KEY=your_late_api_key

# Late Profile IDs
LATE_OWNERFI_PROFILE_ID=profile_id_here
LATE_CARZ_PROFILE_ID=profile_id_here
LATE_PODCAST_PROFILE_ID=profile_id_here
LATE_VASSDISTRO_PROFILE_ID=profile_id_here
LATE_ABDULLAH_PROFILE_ID=profile_id_here

# Firebase (for storing analytics)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

---

## 📊 Example Weekly Workflow

### Monday Morning (9 AM):
1. Review weekly performance report (auto-generated)
2. Note top insights and recommendations
3. Share with team

### Monday Afternoon:
1. Implement top 3 recommendations
2. Adjust queue if needed
3. Plan content based on insights

### Daily (6 AM):
1. Auto-sync runs (pulls yesterday's analytics)
2. Dashboard updated with fresh data

### Sunday Night (11 PM):
1. Auto-optimizer runs (suggests new queue schedule)
2. Review and approve for next week

---

## 🎓 Advanced Usage

### Custom Analysis Queries

```typescript
import { analyzePlatformPerformance } from '@/lib/late-analytics-v2';

// Analyze specific brand, last 30 days
const performance = await analyzePlatformPerformance('ownerfi', 30);

// Loop through platforms
for (const [platform, metrics] of performance.entries()) {
  console.log(`${platform}: ${metrics.avgEngagementRate}%`);
}
```

### Custom Recommendations

```typescript
import { getPlatformRecommendations } from '@/lib/late-analytics-v2';

const recs = await getPlatformRecommendations('ownerfi', 14);
console.log(recs.overall.actionItems);
```

---

## 📝 Success Metrics to Track

**Week 1 Baseline**:
- Average views per post
- Average engagement rate
- Top performing platform
- Worst performing platform

**Week 4 Target** (after optimizations):
- +20% views per post
- +2% engagement rate
- All platforms >5% engagement
- 3+ posts >100k views/week

**Month 3 Target**:
- +50% views per post
- +5% engagement rate
- Predictable viral post formula
- Automated optimization running smoothly

---

## 🤝 Support

### Common Questions

**Q: How often should I run the sync?**
A: Daily at 6 AM (automated). Manual runs OK if needed.

**Q: How many days of history should I analyze?**
A: 7-14 days for trends, 30 days for major decisions.

**Q: Should I trust the auto-optimizer?**
A: Yes, but review changes first. Run --dry-run to preview.

**Q: What if a platform has no data?**
A: Either you haven't posted there, or accounts aren't connected in Late.

**Q: Can I ignore underperforming platforms?**
A: Consider reducing frequency, but test fixes first. Market may be there.

---

## 🚀 Next Steps

1. ✅ Run initial sync: `npx tsx scripts/sync-platform-analytics.ts`
2. ✅ View dashboard to explore data
3. ✅ Generate first weekly report
4. ✅ Run queue optimizer (dry-run first)
5. ✅ Set up automated daily sync
6. ✅ Monitor performance for 1 week
7. ✅ Apply recommendations and iterate

---

**Built with**: Late.dev API, Firebase, TypeScript, React
**Maintained by**: Abdullah
**Last Updated**: 2025-10-30
**Version**: 2.0
