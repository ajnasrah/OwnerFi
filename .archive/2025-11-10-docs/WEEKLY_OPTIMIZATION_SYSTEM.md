# Weekly Social Media Optimization System

Complete analytics-driven system for optimizing YouTube and Instagram content across all brands.

## Overview

This system analyzes your YouTube and Instagram performance and provides actionable recommendations for:

- **Captions**: Optimal length, format, and style
- **Hashtags**: Platform-specific counts and strategies
- **Video Duration**: Sweet spots for maximum engagement
- **Scheduling**: Peak posting times and days

## Features

### 1. Weekly Optimization Report (CLI)

Generate comprehensive weekly analytics reports from the command line.

**Run:**
```bash
npx tsx scripts/weekly-optimization-report.ts [brand]
```

**Examples:**
```bash
# All brands
npx tsx scripts/weekly-optimization-report.ts

# Specific brand
npx tsx scripts/weekly-optimization-report.ts ownerfi
```

**Output:**
- Platform performance (YouTube + Instagram)
- Caption analysis (length, questions, exclamations, hashtags)
- Best posting times (hourly + daily breakdown)
- Actionable recommendations
- Copyable configuration template

### 2. Weekly Optimization Dashboard (Web)

View analytics insights in a beautiful dashboard interface.

**Component:** `WeeklyOptimizationDashboard`
**API Endpoint:** `/api/analytics/weekly-optimization`

**Features:**
- Platform performance cards (YouTube + Instagram)
- Caption insights with color-coded badges
- Hashtag recommendations
- Best/worst posting times heatmap
- Copy-to-clipboard functionality for all recommendations

**URL Parameters:**
- `brand`: carz, ownerfi, podcast, vassdistro, abdullah
- `days`: 7, 14, 30 (analysis period)

**Example:**
```
/api/analytics/weekly-optimization?brand=ownerfi&days=7
```

### 3. Cross-Platform Post Creator (CLI)

Create and schedule optimized posts for YouTube + Instagram simultaneously.

**Run:**
```bash
npx tsx scripts/cross-platform-post.ts --brand <brand> --video <url> --topic "<topic>"
```

**Required Arguments:**
- `--brand`: Brand name (carz, ownerfi, podcast, vassdistro, abdullah)
- `--video`: Video URL
- `--topic`: Topic/description for caption generation

**Optional Arguments:**
- `--schedule`: ISO 8601 schedule time (or auto-schedule based on analytics)
- `--platforms`: Comma-separated platforms (default: youtube,instagram)

**Examples:**
```bash
# Auto-schedule based on analytics
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "https://example.com/video.mp4" \
  --topic "How to buy a house with bad credit"

# Schedule for specific time
npx tsx scripts/cross-platform-post.ts \
  --brand carz \
  --video "https://example.com/tesla-recall.mp4" \
  --topic "Tesla recall update" \
  --schedule "2025-11-01T14:00:00Z"

# Post to Instagram only
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "https://example.com/video.mp4" \
  --topic "Owner financing explained" \
  --platforms instagram
```

**What it does:**
1. Fetches optimization insights from analytics data
2. Generates platform-optimized captions using AI
3. Auto-schedules at optimal times (or uses your schedule)
4. Posts to both YouTube and Instagram (or selected platforms)
5. Prints copyable summary with all details

## Data Sources

### Analytics Collections

**`platform_analytics`** (Firestore)
```typescript
{
  postId: string,
  brand: string,
  platform: 'youtube' | 'instagram',
  publishedAt: string,
  views: number,
  likes: number,
  comments: number,
  shares: number,
  saves: number,
  reach: number,
  impressions: number,
  engagementRate: number,
  hour: number, // 0-23
  dayOfWeek: number, // 0-6
  dayName: string,
  content: string, // Caption
  syncedAt: string
}
```

**`workflow_analytics`** (Firestore)
```typescript
{
  workflowId: string,
  latePostId: string,
  brand: string,
  contentType: 'viral' | 'benefit' | 'property' | 'podcast',
  scheduledTime: string,
  postedTime: string,
  timeSlot: string,
  dayOfWeek: string,
  hook: string,
  hookType: string,
  caption: string,
  platformMetrics: {
    youtube: { views, likes, comments, ... },
    instagram: { views, likes, comments, ... }
  },
  totalViews: number,
  totalLikes: number,
  totalComments: number,
  overallEngagementRate: number
}
```

## Optimization Insights

### Caption Analysis

**YouTube:**
- Target length: 200-300 characters
- Elements: Question (55% of top posts) + Exclamation (95% of top posts)
- Hashtags: 3-5
- Style: Educational, news, or controversy

**Instagram:**
- Target length: 200-300 characters
- Elements: Question (60% of top posts) + Exclamation (100% of top posts)
- Hashtags: 5-8 (more than YouTube)
- Style: Personal stories, pain points, community-focused

### Video Duration

**YouTube Shorts:**
- Optimal: 15-30 seconds
- Maximum retention at 20-25 seconds

**Instagram Reels:**
- Optimal: 15-30 seconds
- Viral potential: 7-15 seconds (test both)

### Posting Times

The system analyzes your historical data to find:
- **Best hours**: Top 5 hours by average views
- **Best days**: Top days by average views
- **Worst hours**: Hours to avoid (low engagement)

**General trends** (customize based on your data):
- Best times: 12-2 PM, 7-9 PM
- Best days: Monday, Wednesday, Friday
- Avoid: Early morning (4-7 AM), late night (11 PM-2 AM)

## API Endpoints

### GET `/api/analytics/weekly-optimization`

**Query Parameters:**
- `brand`: Brand name (required)
- `days`: Analysis period in days (default: 7)

**Response:**
```json
{
  "brand": "ownerfi",
  "period": {
    "start": "2025-10-24T00:00:00Z",
    "end": "2025-10-31T00:00:00Z"
  },
  "youtube": {
    "performance": {
      "totalPosts": 10,
      "avgViews": 5000,
      "avgEngagement": 150
    },
    "captions": {
      "avgLength": 250,
      "optimalRange": "200-300",
      "topPerformingLength": "medium (150-250)",
      "hasQuestion": 60,
      "hasExclamation": 90
    },
    "hashtags": {
      "avgCount": 4,
      "recommendedCount": 4
    }
  },
  "instagram": { /* same structure */ },
  "timing": {
    "bestHours": [
      { "hour": 14, "label": "2:00 PM", "avgViews": 6000 },
      { "hour": 19, "label": "7:00 PM", "avgViews": 5500 }
    ],
    "bestDays": [
      { "day": "Monday", "avgViews": 5800 },
      { "day": "Wednesday", "avgViews": 5400 }
    ],
    "worstHours": [
      { "hour": 5, "label": "5:00 AM", "avgViews": 800 }
    ]
  },
  "recommendations": {
    "captions": [
      "YouTube: Target 200-300 characters (current avg: 250)",
      "Instagram: Add questions to captions (60% of top posts have questions)"
    ],
    "hashtags": [
      "YouTube: Increase hashtags to 3-5 (current avg: 4)",
      "Instagram: Use 5-8 hashtags for better reach (current avg: 6)"
    ],
    "duration": [
      "YouTube Shorts: 15-30 seconds optimal for retention",
      "Instagram Reels: 15-30 seconds, test 7-15 for viral potential"
    ],
    "scheduling": [
      "Best posting times: 2:00 PM, 7:00 PM, 12:00 PM",
      "Avoid posting: 5:00 AM, 3:00 AM (lowest engagement)",
      "Focus on: Monday, Wednesday, Friday"
    ]
  }
}
```

## Caption Intelligence System

**File:** `src/lib/caption-intelligence.ts`

AI-powered caption generation using proven formulas:

### Universal Caption Formula

**Format (200-300 chars):**
```
[HOOK/HEADLINE with exclamation]!
[QUESTION that engages the audience]
[EXPLANATION with specific numbers and details]
#Hashtag1 #Hashtag2 #Hashtag3 #BrandTag
```

**Required elements:**
- ✅ 1-2 exclamation marks
- ✅ 1 question
- ✅ 2-3 numbers/stats
- ✅ 3-4 hashtags (YouTube) or 5-8 (Instagram)

**Example:**
```
This is how I bought a house with a 550 credit score!
Are you tired of banks saying no?
Owner financing let me go from $1500 rent to $1200 mortgage — no bank needed. Bad credit doesn't mean you can't own.
#homeowner #ownerfinance #badcredit #realestate
```

### First Comment Formula

Auto-posted comment to boost engagement:

**Format (80-150 chars):**
```
💬 [Engagement Hook]! #hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5
```

**Examples:**
- `💬 Tag someone who needs to see this! #mortgage #creditrepair #firsttimehomebuyer`
- `💬 Drop a 🏠 if you're ready to stop renting! #housingmarket #rentvsown`

## Usage Workflow

### Weekly Optimization Routine

1. **Monday: Generate Report**
   ```bash
   npx tsx scripts/weekly-optimization-report.ts ownerfi
   ```

2. **Review Insights**
   - Check platform performance trends
   - Note caption patterns from top posts
   - Identify best posting times

3. **Update Settings**
   - Copy configuration from report
   - Update caption templates if needed
   - Adjust queue schedule in Late.dev

4. **Create Content**
   ```bash
   npx tsx scripts/cross-platform-post.ts \
     --brand ownerfi \
     --video "https://example.com/video.mp4" \
     --topic "Your topic here"
   ```

### Dashboard View

1. Navigate to analytics dashboard
2. Select brand and time period
3. Review performance cards
4. Copy recommendations
5. Use "Copy Settings" button for configuration

## Configuration

### Environment Variables

```env
# Late.dev API
LATE_API_KEY=your_api_key

# Profile IDs
LATE_OWNERFI_PROFILE_ID=profile_id
LATE_CARZ_PROFILE_ID=profile_id
LATE_PODCAST_PROFILE_ID=profile_id
LATE_VASSDISTRO_PROFILE_ID=profile_id
LATE_ABDULLAH_PROFILE_ID=profile_id

# OpenAI (for caption generation)
OPENAI_API_KEY=your_openai_key
```

### Brand Configurations

See `src/config/brand-configs.ts` for brand-specific settings:
- Default hashtags
- Caption styles
- Posting schedules
- Platform preferences

## Files Created

### Scripts
- `scripts/weekly-optimization-report.ts` - CLI analytics report
- `scripts/cross-platform-post.ts` - Cross-platform posting tool

### API Routes
- `src/app/api/analytics/weekly-optimization/route.ts` - Analytics API

### Components
- `src/components/WeeklyOptimizationDashboard.tsx` - Dashboard UI

### Libraries
- `src/lib/caption-intelligence.ts` - Caption generation (already exists)
- `src/lib/late-analytics.ts` - Analytics data fetching (already exists)

## Best Practices

### Caption Optimization

1. **Always include a question** (drives engagement)
2. **Use 1-2 exclamation marks** (creates urgency)
3. **Add specific numbers** (credibility)
4. **Keep it 200-300 chars** (optimal for both platforms)
5. **Hashtags at the end** (clean format)

### Hashtag Strategy

**YouTube:**
- 3-5 hashtags maximum
- Focus on topics and keywords
- Mix popular + niche tags

**Instagram:**
- 5-8 hashtags in caption
- 5-8 more in first comment
- Community-focused tags
- Location tags for property content

### Scheduling

1. **Use analytics data** - Don't guess posting times
2. **Test different days** - Your audience may vary
3. **Batch content** - Schedule week in advance
4. **Monitor performance** - Adjust based on results

### Video Duration

1. **Keep it short** - 15-30 seconds optimal
2. **Hook in first 3 seconds** - Critical for retention
3. **Test 7-15 sec** - For viral potential on Instagram
4. **Match content type** - Educational can be longer

## Troubleshooting

### No Analytics Data

**Problem:** "No data available for the specified period"

**Solutions:**
1. Sync analytics data:
   ```bash
   npx tsx scripts/sync-platform-analytics.ts
   ```
2. Check if posts exist in Firestore `platform_analytics`
3. Verify `syncedAt` timestamps are recent

### Caption Generation Fails

**Problem:** OpenAI API errors

**Solutions:**
1. Check `OPENAI_API_KEY` is set
2. Verify API quota/limits
3. Review error messages for specific issues

### Post Scheduling Fails

**Problem:** Late.dev API errors

**Solutions:**
1. Verify `LATE_API_KEY` is valid
2. Check profile IDs are correct
3. Ensure video URL is accessible
4. Verify social accounts are connected in Late.dev

## Future Enhancements

- [ ] A/B testing for caption styles
- [ ] Hashtag performance tracking
- [ ] Competitor analysis
- [ ] Automated content calendar
- [ ] Performance predictions
- [ ] Multi-variant posting

## Support

For issues or questions:
1. Check this documentation
2. Review error logs
3. Verify environment variables
4. Test with simple examples first

---

**Last Updated:** October 31, 2025
**Version:** 1.0.0
