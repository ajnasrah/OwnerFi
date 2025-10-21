# Cron Jobs Explanation

## Content Generation Crons

### `/api/cron/fetch-rss` - Daily at 12:00 PM
**Purpose:** Fetches new articles from RSS feeds for both Carz and OwnerFi
- Pulls latest automotive and real estate news
- Stores articles in Firebase for processing
- Runs once per day to get fresh content

### `/api/cron/rate-articles` - Daily at 1:00 PM
**Purpose:** AI rates all fetched articles for virality potential
- Uses OpenAI to score each article (1-10)
- Determines which articles are best for viral videos
- Runs after fetch-rss to rate the new articles

### `/api/cron/generate-video` - 5x Daily (2am, 2pm, 5pm, 8pm, 11pm)
**Purpose:** Creates viral videos from top-rated articles
- Picks best article from queue
- Generates script → HeyGen video → Submagic captions → Posts to social
- Runs 5 times per day for consistent posting schedule

### `/api/podcast/cron` - 5x Daily (2am, 2pm, 5pm, 8pm, 11pm)
**Purpose:** Generates podcast-style videos
- Creates conversational videos between AI hosts
- Same schedule as viral videos
- Posts to social media

### `/api/benefit/cron` - 2x Daily (11am, 7pm)
**Purpose:** Creates benefit/educational style videos
- Different content style from viral videos
- Focuses on educational content
- Posts to social media

## Failsafe/Recovery Crons

### `/api/cron/check-stuck-heygen` - **UPDATED: Every 15 min** (was every 2 hrs)
**Purpose:** Checks if HeyGen videos are stuck in processing
- Queries HeyGen API for status updates
- Advances workflows that completed but webhook didn't fire
- Critical for workflow recovery

### `/api/cron/check-stuck-submagic` - **UPDATED: Every 15 min** (was every 2 hrs)
**Purpose:** Checks if Submagic videos are stuck in processing
- Queries Submagic API for completed videos
- Downloads and posts videos if webhook failed
- Critical for workflow recovery

### `/api/cron/check-stuck-posting` - Every 2 hours
**Purpose:** Retries videos that failed to post to Late.so
- Finds workflows stuck in "posting" status
- Retries posting to social media platforms
- Ensures videos don't get lost

### `/api/cron/check-stuck-video-processing` - Every 2 hours
**Purpose:** Checks for videos stuck in R2 upload/processing
- Monitors video upload pipeline
- Retries failed uploads
- Cleans up stuck workflows

## Maintenance Crons

### `/api/cron/weekly-maintenance` - Monday at 11am
**Purpose:** Weekly database cleanup and maintenance
- Removes old completed workflows
- Archives old articles
- Database optimization
- Runs once per week to keep things clean

### `/api/cron/cleanup-videos` - Daily at 3am
**Purpose:** Deletes old videos from R2 storage
- Removes videos older than X days
- Frees up storage space
- Keeps costs down

## Special Purpose Crons

### `/api/cron/process-zillow-scraper` - Every 2 minutes
**Purpose:** Processes incoming Zillow property data
- Monitors for new Apify scraper results
- Imports property data into database
- Geocodes addresses
- High frequency because scraper runs continuously

## Summary by Frequency

**Every 2 minutes:**
- process-zillow-scraper (property imports)

**Every 15 minutes (UPDATED):**
- check-stuck-heygen (failsafe)
- check-stuck-submagic (failsafe)

**Every 2 hours:**
- check-stuck-posting (failsafe)
- check-stuck-video-processing (failsafe)

**Twice daily:**
- benefit/cron (educational videos)

**5 times daily:**
- podcast/cron (podcast videos)
- generate-video (viral videos)

**Once daily:**
- fetch-rss (get new articles)
- rate-articles (score articles)
- cleanup-videos (delete old videos)

**Weekly:**
- weekly-maintenance (database cleanup)

## Cost Optimization Notes

- **Failsafe crons** now run more frequently (15 min) to catch stuck workflows faster
- **Video generation** runs 5x/day for consistent posting schedule
- **Zillow scraper** runs frequently because it processes real-time data
- **Cleanup crons** run off-peak (3am, Monday) to avoid conflicts

## Which Ones Are Critical?

**Must Have (System breaks without these):**
- ✅ fetch-rss
- ✅ generate-video
- ✅ check-stuck-heygen
- ✅ check-stuck-submagic

**Important (System degraded without these):**
- ⚠️ rate-articles
- ⚠️ check-stuck-posting
- ⚠️ podcast/cron
- ⚠️ benefit/cron

**Nice to Have (Maintenance/Cleanup):**
- 💡 cleanup-videos
- 💡 weekly-maintenance
- 💡 check-stuck-video-processing

**Special Case (Property business):**
- 🏠 process-zillow-scraper

## Notes

The Vercel dashboard still shows the old schedule because the changes haven't been deployed yet. Once you run `git push`, the new 15-minute schedule for HeyGen and Submagic failsafes will take effect.
