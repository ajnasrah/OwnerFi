# Vercel Cron Job Cost Estimate

## Vercel Pro Plan Pricing

**Cron Jobs:**
- ✅ Up to 40 cron jobs included
- ✅ Unlimited invocations
- 💰 Charged based on function execution time only

**Function Compute:**
- ✅ 40 hours/month included
- 💰 $5 per additional hour of compute time
- ⏱️ Only charged during active CPU time (not waiting for API responses)

## Your Current Cron Schedule

### High Frequency (Every 15 Minutes)
1. **check-stuck-heygen** - 2,880 invocations/month (~2 sec each = 1.6 hours/month)
2. **check-stuck-submagic** - 2,880 invocations/month (~2 sec each = 1.6 hours/month)
3. **process-scraper-queue** - 2,880 invocations/month (~5 sec each = 4 hours/month)

### Medium Frequency (Every 2 Hours)
4. **check-stuck-posting** - 360 invocations/month (~2 sec each = 0.2 hours/month)
5. **check-stuck-video-processing** - 360 invocations/month (~2 sec each = 0.2 hours/month)

### High Frequency (Every 2 Minutes)
6. **process-zillow-scraper** - 21,600 invocations/month (~3 sec each = 18 hours/month)

### Daily Crons (3x Per Day) - UPDATED
7. **generate-video** - 90 invocations/month (~30 sec each = 0.75 hours/month)
8. **podcast/cron** - 90 invocations/month (~30 sec each = 0.75 hours/month)

### Daily Crons (2x Per Day)
9. **benefit/cron** - 60 invocations/month (~30 sec each = 0.5 hours/month)

### Daily Crons (Once)
10. **fetch-rss** - 30 invocations/month (~60 sec each = 0.5 hours/month)
11. **rate-articles** - 30 invocations/month (~120 sec each = 1 hour/month)
12. **cleanup-videos** - 30 invocations/month (~10 sec each = 0.08 hours/month)

### Weekly Crons
13. **weekly-maintenance** - 4 invocations/month (~30 sec each = 0.03 hours/month)

## Monthly Compute Estimate

| Cron Job | Frequency | Duration | Monthly Hours |
|----------|-----------|----------|---------------|
| process-zillow-scraper | Every 2 min | 3s | **18.0** |
| process-scraper-queue | Every 15 min | 5s | **4.0** |
| check-stuck-heygen | Every 15 min | 2s | **1.6** |
| check-stuck-submagic | Every 15 min | 2s | **1.6** |
| rate-articles | Daily | 120s | **1.0** |
| generate-video | 3x daily | 30s | **0.75** |
| podcast/cron | 3x daily | 30s | **0.75** |
| benefit/cron | 2x daily | 30s | **0.5** |
| fetch-rss | Daily | 60s | **0.5** |
| check-stuck-posting | Every 2 hrs | 2s | **0.2** |
| check-stuck-video-processing | Every 2 hrs | 2s | **0.2** |
| cleanup-videos | Daily | 10s | **0.08** |
| weekly-maintenance | Weekly | 30s | **0.03** |
| **TOTAL** | | | **29.2 hours/month** |

## Cost Breakdown

### Vercel Pro Plan: $20/month
- **Includes:** 40 hours/month function compute
- **Your Usage:** ~29.2 hours/month
- **Remaining:** 10.8 hours/month buffer

### Current Monthly Cost for Crons: $0 (included in Pro)

✅ **You're well within the included limits!**

## Cost Optimization Notes

### Biggest Compute Users:
1. **process-zillow-scraper** (61.6% of usage) - Every 2 minutes
2. **process-scraper-queue** (13.7% of usage) - Every 15 minutes
3. **Failsafe crons** (11% combined) - Every 15 minutes

### After Your Recent Changes:
- **Before:** Generate-video + Podcast ran 5x daily = 10 videos/day
- **After:** Now 3x daily = 6 videos/day
- **Savings:** ~0.6 hours/month (2% reduction)

### If You Ever Need to Optimize Further:
1. Reduce **process-zillow-scraper** frequency (currently every 2 min)
2. Reduce **process-scraper-queue** frequency (currently every 15 min)
3. These two alone account for 75% of your cron compute time

## Summary

💰 **Estimated Vercel Cron Cost:** $0/month (covered by Pro plan)
📊 **Usage:** 29.2 hours / 40 hours included (73% utilization)
✅ **Status:** Safely within limits with 10+ hours buffer

**Note:** This only covers the cron invocation costs. Your actual video processing costs (HeyGen, Submagic, Late.so APIs) are separate and likely much higher than Vercel costs.

## API Costs (Separate from Vercel)

### Per Video Estimate:
- **HeyGen:** ~$0.30 per video (30 seconds)
- **Submagic:** ~$0.50 per video
- **Late.so:** ~$0.10 per post
- **Total per video:** ~$0.90

### With 6 Videos/Day (3x Viral + 3x Podcast):
- **Daily:** $5.40
- **Monthly:** ~$162

### Before (10 Videos/Day):
- **Monthly:** ~$270

### **Savings from 5x→3x:** ~$108/month 💰

## Total Estimated Monthly Costs

| Service | Cost |
|---------|------|
| Vercel Pro | $20 |
| Vercel Crons | $0 (included) |
| HeyGen API | ~$54 (180 videos × $0.30) |
| Submagic API | ~$90 (180 videos × $0.50) |
| Late.so API | ~$18 (180 posts × $0.10) |
| **TOTAL** | **~$182/month** |

**Benefit crons not included in above (add ~60 videos/month = ~$54 extra)**
**Grand Total: ~$236/month**
