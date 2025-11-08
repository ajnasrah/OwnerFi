# Vercel Cron Job Execution Analysis

## Monthly Execution Counts (30-day month)

### Video Generation Crons
| Cron Job | Schedule | Per Day | Per Month | Description |
|----------|----------|---------|-----------|-------------|
| `/api/podcast/cron` | `0 9,12,15,18,21 * * *` | 5 | **150** | Podcast video generation (5x daily) |
| `/api/cron/generate-video` | `0 9,12,15,18,21 * * *` | 5 | **150** | Carz/OwnerFi video generation (5x daily) |
| `/api/cron/generate-video-vassdistro` | `0 9,12,15,18,21 * * *` | 5 | **150** | VassDistro video generation (5x daily) |
| `/api/benefit/cron` | `20 9,12,15,18,21 * * *` | 5 | **150** | Benefit video generation (5x daily) |
| `/api/property/video-cron` | `40 9,12,15,18,21 * * *` | 5 | **150** | Property video generation (5x daily) |
| `/api/cron/abdullah` | `0 9,12,15,18,21 * * *` | 5 | **150** | Abdullah content generation (5x daily) |

**Video Generation Subtotal:** 900 executions/month

---

### Article & Content Management Crons
| Cron Job | Schedule | Per Day | Per Month | Description |
|----------|----------|---------|-----------|-------------|
| `/api/cron/fetch-rss` | `0 12 * * *` | 1 | **30** | Fetch RSS feeds daily at noon |
| `/api/cron/rate-articles` | `0 13 * * *` | 1 | **30** | Rate article quality daily at 1pm |
| `/api/cron/refill-articles` | `0 */6 * * *` | 4 | **120** | Refill articles every 6 hours |
| `/api/cron/process-scraper-queue` | `0 10,12,14,16,18,20,22 * * *` | 7 | **210** | Process property scraper queue (7x daily) |

**Content Management Subtotal:** 390 executions/month

---

### Monitoring & Recovery Crons
| Cron Job | Schedule | Per Day | Per Month | Description |
|----------|----------|---------|-----------|-------------|
| `/api/cron/check-stuck-heygen` | `*/10 * * * *` | 144 | **4,320** | Check stuck HeyGen videos (every 10 min) |
| `/api/cron/check-stuck-submagic` | `*/15 * * * *` | 96 | **2,880** | Check stuck Submagic captions (every 15 min) |
| `/api/cron/check-stuck-posting` | `*/15 * * * *` | 96 | **2,880** | Check stuck social posts (every 15 min) |
| `/api/cron/start-pending-workflows` | `*/10 * * * *` | 144 | **4,320** | Start pending workflows (every 10 min) |
| `/api/benefit/workflow/auto-retry` | `0 */2 * * *` | 12 | **360** | Auto-retry failed benefit workflows (every 2 hours) |

**Monitoring & Recovery Subtotal:** 14,760 executions/month

---

### Maintenance & Cleanup Crons
| Cron Job | Schedule | Per Day | Per Month | Description |
|----------|----------|---------|-----------|-------------|
| `/api/cron/weekly-maintenance` | `0 11 * * 1` | 0.14 | **4** | Weekly maintenance (Mondays at 11am) |
| `/api/cron/cleanup-videos` | `0 3 * * *` | 1 | **30** | Cleanup old videos daily at 3am |
| `/api/cron/enhance-property-images` | `0 4 * * *` | 1 | **30** | Enhance property images daily at 4am |

**Maintenance & Cleanup Subtotal:** 64 executions/month

---

## Summary

| Category | Executions/Month | Percentage |
|----------|------------------|------------|
| **Monitoring & Recovery** | 14,760 | 93.3% |
| **Video Generation** | 900 | 5.7% |
| **Content Management** | 390 | 2.5% |
| **Maintenance & Cleanup** | 64 | 0.4% |
| **TOTAL** | **16,114** | 100% |

---

## Key Insights

### Highest Frequency Crons (Most Executions)
1. 🔄 **check-stuck-heygen** - 4,320/month (every 10 minutes)
2. 🔄 **start-pending-workflows** - 4,320/month (every 10 minutes)
3. 🔄 **check-stuck-submagic** - 2,880/month (every 15 minutes)
4. 🔄 **check-stuck-posting** - 2,880/month (every 15 minutes)

### Video Generation Breakdown
- **6 brands** generating videos 5x daily each
- **30 videos per brand per month** (assuming 1 video per execution)
- **180 total videos per month** across all brands

### Cost Implications
- **93.3%** of executions are monitoring/recovery (high frequency but lightweight)
- **5.7%** of executions are video generation (low frequency but expensive - HeyGen/Submagic API calls)
- Monitoring crons are essential for reliability but run very frequently

### Optimization Opportunities
1. **Monitoring frequency** could be reduced if reliability metrics improve
   - Reducing `/10 min` to `/15 min` would save 1,440 executions/month per cron
2. **Weekly maintenance** is very light (only 4/month)
3. **Video generation** is already optimized at 5x daily per brand

---

## Vercel Cron Limits

**Hobby Plan:** 2 cron jobs
**Pro Plan:** 60 cron jobs
**Enterprise Plan:** Unlimited

**Current Usage:** 17 cron jobs (within Pro plan limits)

**Monthly Execution Limits:**
- Pro Plan: No documented limit on executions, but function execution time limits apply
- Each cron must complete within max duration (30s default, 300s for some routes)

---

*Last updated: January 8, 2025*
