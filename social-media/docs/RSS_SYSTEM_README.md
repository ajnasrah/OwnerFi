# Automated RSS Video Generation System

## Overview
Fully automated system that monitors RSS feeds for **Carz Inc** and **OwnerFi**, evaluates article quality with AI, and generates viral videos automatically.

## Key Features

### 🎯 Real-Time Article Detection
- **Only processes NEW articles** published after the last check
- **Ignores historical/old content** completely
- Checks feeds every 15 minutes for fresh content

### 🤖 AI Quality Filter
- Uses OpenAI GPT-4o-mini to evaluate every article
- Scores articles 0-100 based on viral potential
- **Only queues articles scoring 70+** for video generation
- Rejects:
  - Clickbait
  - Generic listicles
  - Pure advertisements
  - Low-value content
  - Celebrity gossip

### 📊 Two Separate Data Stores

#### **Carz Inc** (10 RSS Feeds)
- Motor1 - Car Reviews
- Car and Driver - Reviews
- MotorTrend - New Cars
- Edmunds - Car Reviews
- Autoblog - News
- The Verge - Transportation
- Jalopnik - Car News
- Automotive News
- InsideEVs - Electric Vehicle News
- Electrek - Electric Vehicle News

**Target**: 5 high-quality videos per day

#### **OwnerFi** (12 RSS Feeds)
- HousingWire - Housing Market News
- Realtor.com - News & Insights
- Zillow - Research & Insights
- Redfin - Real Estate News
- Mortgage News Daily
- The Mortgage Reports
- Bankrate - Mortgages
- NerdWallet - Mortgages & Homeownership
- This Old House - Home Improvement
- Bob Vila - Home Improvement Tips
- Inman - Real Estate Tech News
- PropTech Insider

**Target**: 5 high-quality videos per day

## Workflow

```
1. RSS Feed Check (every 15 minutes)
   ↓
2. Find NEW articles (published after last check)
   ↓
3. AI Quality Evaluation (score 0-100)
   ↓
4. Queue High-Quality Articles (70+ score)
   ↓
5. Video Generation (every 5 minutes)
   ↓
6. OpenAI Script Generation (dramatic, viral style)
   ↓
7. HeyGen Video Creation (talking avatar with zoom)
   ↓
8. Submagic Enhancement (captions, effects, viral template)
   ↓
9. Final Video Ready
```

## API Endpoints

### Start System
```bash
# Initialize feeds and start scheduler
node test_rss_scheduler.js

# Or manually via API
curl -X POST http://localhost:3000/api/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "config": {"maxVideosPerDay": {"carz": 5, "ownerfi": 5}}}'
```

### Check Status
```bash
curl http://localhost:3000/api/scheduler
```

### Stop System
```bash
curl -X POST http://localhost:3000/api/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'
```

## Configuration

### Scheduler Settings
- **Feed Check Interval**: 15 minutes (can be adjusted)
- **Video Process Interval**: 5 minutes
- **Max Videos Per Day**: 5 Carz + 5 OwnerFi (configurable)

### Quality Filter Thresholds
- **90-100**: MUST-MAKE content (breaking news, major announcements)
- **70-89**: Great content (interesting, high engagement potential)
- **50-69**: Decent but not video-worthy
- **0-49**: Rejected (low quality, clickbait, ads)

## Real-Time Operation

### First Run
On the first initialization, all feeds are marked as "checked now", so **no old articles are processed**. The system will only pick up articles published AFTER initialization.

### Subsequent Runs
Every 15 minutes:
1. System checks all 22 RSS feeds
2. Compares article publish dates to last check time
3. Only processes articles newer than last check
4. AI evaluates each new article
5. High-scoring articles get queued for video

### Example Timeline
```
10:00 AM - System starts, marks all feeds as checked
10:15 AM - Checks feeds, finds 0 new articles (none published in last 15 min)
10:30 AM - Checks feeds, finds 2 new Carz articles
          - Article 1: Score 85/100 → QUEUED
          - Article 2: Score 45/100 → REJECTED
10:35 AM - Video processor generates video for Article 1
10:45 AM - Checks feeds again...
```

## Video Generation Details

### Script Generation (OpenAI)
- Dramatic, high-energy 45-60 second scripts
- Bold openings ("You won't believe this!")
- Urgent, conversational tone
- No sources or citations
- Punchy endings

### HeyGen Settings
- Talking photo with 1.4x scale (zoom effect)
- 1080x1920 (vertical format for TikTok/Shorts)
- Expressive talking style
- 1.1x speed

### Submagic Enhancement
- Template: "Hormozi 2" (high-energy style)
- Auto-generated captions
- Viral effects and transitions

## Storage

### Current (Development)
- In-memory storage (resets on restart)
- Fast but not persistent

### Production Ready
- Redis support available (`src/lib/workflow-store-redis.ts`)
- Set `USE_REDIS=true` and provide `REDIS_URL`
- Persistent across restarts

## Monitoring

### Live Logs
Check the Next.js server console for real-time updates:
- Feed processing status
- Article discovery
- Quality evaluation scores
- Video generation progress
- Errors and retries

### API Status
```bash
# Get detailed stats
curl http://localhost:3000/api/scheduler | python3 -m json.tool
```

Returns:
- Number of feeds active
- Articles collected
- Videos in queue
- Processing status
- Today's video count

## Troubleshooting

### No New Articles Found
✅ **This is normal!** The system only processes articles published AFTER initialization. Wait 15-30 minutes for new content to be published.

### Quality Filter Rejecting Everything
- Check OpenAI API key is set
- Review article content quality
- Adjust threshold in `article-quality-filter.ts` if needed

### Videos Not Generating
- Verify HeyGen API key is set
- Check rate limits
- View server logs for specific errors
- Ensure workflow store is working

### Feed Errors
Some RSS URLs may be outdated or require authentication. The system will:
- Retry 3 times with exponential backoff
- Mark feed as errored
- Continue processing other feeds

## Files Structure

```
src/
├── lib/
│   ├── feed-store.ts              # Article & queue data storage
│   ├── rss-fetcher.ts             # RSS parsing & real-time filtering
│   ├── article-quality-filter.ts  # AI evaluation system
│   ├── video-scheduler.ts         # Automated processing loop
│   ├── api-utils.ts               # Timeouts, retries, rate limits
│   └── validation.ts              # Request validation
├── config/
│   └── feed-sources.ts            # RSS feed URLs (Carz + OwnerFi)
└── app/api/
    ├── scheduler/route.ts         # Control API
    └── workflow/
        └── viral-video-webhook/   # Video generation endpoint

test_rss_scheduler.js              # Easy startup script
```

## Next Steps

### Production Deployment
1. Enable Redis for persistent storage
2. Deploy to cloud (Vercel, AWS, etc.)
3. Set up monitoring/alerts
4. Configure backup systems

### Enhancements
- Add custom avatars per category
- Implement video approval workflow
- Add analytics tracking
- Create admin dashboard
- Support more RSS feeds
- Add custom templates per category

## Environment Variables Required

```bash
HEYGEN_API_KEY=your_heygen_key
OPENAI_API_KEY=your_openai_key
SUBMAGIC_API_KEY=your_submagic_key
NEXT_PUBLIC_BASE_URL=https://yourdomain.com

# Optional
REDIS_URL=your_redis_url
USE_REDIS=true
```

---

## Quick Start Commands

```bash
# 1. Start the Next.js server
npm run dev

# 2. In another terminal, initialize the system
node test_rss_scheduler.js

# 3. Monitor status
watch -n 10 'curl -s http://localhost:3000/api/scheduler | python3 -m json.tool'

# 4. Stop when done
curl -X POST http://localhost:3000/api/scheduler \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'
```

That's it! The system will now automatically generate 10 viral videos per day (5 Carz + 5 OwnerFi) from the freshest, highest-quality content.
