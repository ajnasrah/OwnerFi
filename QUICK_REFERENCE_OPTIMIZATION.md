# Quick Reference: Weekly Optimization Commands

Copy and paste these commands directly into your terminal.

## 📊 Generate Weekly Report

Get analytics insights for any brand:

```bash
# All brands
npx tsx scripts/weekly-optimization-report.ts

# Specific brand
npx tsx scripts/weekly-optimization-report.ts ownerfi
npx tsx scripts/weekly-optimization-report.ts carz
npx tsx scripts/weekly-optimization-report.ts podcast
```

**What you get:**
- YouTube + Instagram performance breakdown
- Caption analysis (length, style, hashtags)
- Best posting times (hours + days)
- Actionable recommendations
- Copyable configuration settings

---

## 🚀 Create Cross-Platform Post

Post the same content to YouTube + Instagram with optimized captions:

```bash
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "YOUR_VIDEO_URL" \
  --topic "Your topic description here"
```

**Real examples:**

```bash
# Owner financing topic
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "https://heygen-video-url.mp4" \
  --topic "How to buy a house with bad credit using owner financing"

# Car news topic
npx tsx scripts/cross-platform-post.ts \
  --brand carz \
  --video "https://heygen-video-url.mp4" \
  --topic "Tesla recall affects 13,000 vehicles"

# Schedule for specific time
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "https://heygen-video-url.mp4" \
  --topic "Credit score myths debunked" \
  --schedule "2025-11-01T14:00:00Z"

# Post to Instagram only
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "https://heygen-video-url.mp4" \
  --topic "Stop renting and start owning" \
  --platforms instagram
```

**What it does:**
1. ✅ Analyzes your recent performance data
2. ✅ Generates optimized caption (200-300 chars)
3. ✅ Creates engagement-boosting first comment
4. ✅ Auto-schedules at best time (or uses your time)
5. ✅ Posts to YouTube + Instagram simultaneously

---

## 📋 Copy This Week's Optimization Settings

After running the weekly report, you'll get a section like this:

```bash
# Weekly Optimization Command for ownerfi
# Copy and paste these settings into your content workflow

CAPTION_LENGTH_YOUTUBE="200-300"
CAPTION_LENGTH_INSTAGRAM="200-300"
HASHTAG_COUNT_YOUTUBE="4"
HASHTAG_COUNT_INSTAGRAM="6"
VIDEO_DURATION="15-30"  # seconds
BEST_POSTING_HOURS="14,19,12"  # 2PM, 7PM, 12PM
BEST_POSTING_DAYS="Monday,Wednesday,Friday"
```

**Use these to guide your content creation this week!**

---

## 🎯 Current Optimization Targets

### Captions

**YouTube:**
- Length: 200-300 characters
- Must include: Question + Exclamation
- Hashtags: 3-5
- Include 2-3 numbers/stats

**Instagram:**
- Length: 200-300 characters
- Must include: Question + Exclamation
- Hashtags: 5-8 (more than YouTube)
- More community-focused

### Video Duration

- **YouTube Shorts:** 15-30 seconds optimal
- **Instagram Reels:** 15-30 seconds (test 7-15 for viral)

### Posting Times

Run weekly report to see YOUR best times. General guidelines:
- **Best:** 12-2 PM, 7-9 PM
- **Avoid:** Early morning (4-7 AM), late night (11 PM-2 AM)
- **Best Days:** Monday, Wednesday, Friday

---

## 🔄 Weekly Workflow

**Monday Morning:**
```bash
# 1. Generate analytics report
npx tsx scripts/weekly-optimization-report.ts ownerfi

# 2. Review insights and copy recommendations
```

**Throughout the Week:**
```bash
# Create and schedule posts using optimization data
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "VIDEO_URL" \
  --topic "TOPIC_HERE"
```

**Repeat weekly for continuous improvement!**

---

## 🆘 Troubleshooting

### "No data available"
```bash
# Sync analytics first
npx tsx scripts/sync-platform-analytics.ts
```

### Check if analytics exist
```bash
# View recent analytics data
npx tsx scripts/analytics-report.ts
```

### Test caption generation
```bash
# Generate sample caption
npx tsx scripts/test-caption-intelligence.ts
```

---

## 💡 Pro Tips

1. **Run reports on Mondays** - Review last week's performance
2. **Schedule posts in batches** - Plan entire week on Monday
3. **Use auto-scheduling** - Let analytics pick best times
4. **Test different topics** - Monitor what resonates
5. **Copy successful patterns** - Replicate top performers

---

## 📱 Dashboard Alternative

You can also view all this data in the web dashboard:

**URL:** `/analytics/optimization`

**Features:**
- Visual charts and graphs
- Platform comparison cards
- One-click copy recommendations
- Filter by brand and time period

---

## 🎨 Caption Formula

When creating manual content, use this proven formula:

```
[HOOK with exclamation]!
[Engaging QUESTION]?
[Details with NUMBERS and specifics]
#Hashtag1 #Hashtag2 #Hashtag3 #BrandHashtag
```

**Example:**
```
This is how I bought a house with a 550 credit score!
Are you tired of banks saying no?
Owner financing let me go from $1500 rent to $1200 mortgage — no bank needed. Bad credit doesn't mean you can't own.
#homeowner #ownerfinance #badcredit #realestate
```

**First Comment:**
```
💬 Tag someone who needs to see this! #mortgage #creditrepair #firsttimehomebuyer #renters #financialfreedom
```

---

**Questions? Check:** `WEEKLY_OPTIMIZATION_SYSTEM.md` for full documentation
