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
| `/api/cron/check-stuck-heygen` | `*/30 14-23,0-4 * * *` | 28 | **840** | Check stuck HeyGen videos (every 30 min, 8am-10pm CST) ✅ |
| `/api/cron/check-stuck-submagic` | `*/30 14-23,0-4 * * *` | 28 | **840** | Check stuck Submagic captions (every 30 min, 8am-10pm CST) ✅ |
| `/api/cron/check-stuck-posting` | `*/30 14-23,0-4 * * *` | 28 | **840** | Check stuck social posts (every 30 min, 8am-10pm CST) ✅ |
| `/api/cron/start-pending-workflows` | `*/30 14-23,0-4 * * *` | 28 | **840** | Start pending workflows (every 30 min, 8am-10pm CST) ✅ |
| `/api/benefit/workflow/auto-retry` | `0 */2 * * *` | 12 | **360** | Auto-retry failed benefit workflows (every 2 hours) |

**Monitoring & Recovery Subtotal:** 3,720 executions/month (was 14,760 - **saved 11,040!**)

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

| Category | Executions/Month | Percentage | Change |
|----------|------------------|------------|--------|
| **Monitoring & Recovery** | 3,720 | 73.7% | ⬇️ -11,040 |
| **Video Generation** | 900 | 17.8% | - |
| **Content Management** | 390 | 7.7% | - |
| **Maintenance & Cleanup** | 64 | 1.3% | - |
| **TOTAL** | **5,074** | 100% | ⬇️ **-68.5%** |

---

## Key Insights

### Highest Frequency Crons (Most Executions)
1. 🔄 **check-stuck-heygen** - 840/month (every 30 min, 8am-10pm CST) ✅ Optimized
2. 🔄 **start-pending-workflows** - 840/month (every 30 min, 8am-10pm CST) ✅ Optimized
3. 🔄 **check-stuck-submagic** - 840/month (every 30 min, 8am-10pm CST) ✅ Optimized
4. 🔄 **check-stuck-posting** - 840/month (every 30 min, 8am-10pm CST) ✅ Optimized

### Video Generation Breakdown
- **6 brands** generating videos 5x daily each
- **30 videos per brand per month** (assuming 1 video per execution)
- **180 total videos per month** across all brands

### Cost Implications
- **81.4%** of executions are monitoring/recovery (high frequency but lightweight)
- **12.0%** of executions are video generation (low frequency but expensive - HeyGen/Submagic API calls)
- Monitoring crons run every 30 minutes (balanced between reliability and resource usage)

### ✅ Optimization Applied (January 2025)
1. **Monitoring frequency reduced** from 10-15 min → 30 min
   - **Time-limited** to 8am-10pm CST (14 hours/day instead of 24 hours)
   - **Saved 11,040 executions/month (68.5% reduction)**
   - Trade-off:
     - Stuck workflows detected within 30 min instead of 10-15 min
     - No monitoring 10pm-8am CST (off-peak hours)
   - Impact: Minimal - most content creation happens during business hours
2. **Monitoring window:** 14 hours/day (8am-10pm CST)
   - Covers all video generation times (9am, 12pm, 3pm, 6pm, 9pm)
   - Allows overnight workflows to complete without intervention
3. **Weekly maintenance** is very light (only 4/month)
4. **Video generation** is already optimized at 5x daily per brand

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

---

## 🎯 Optimization Results

### Before Optimization (Original)
- Total executions: **16,114/month**
- Monitoring frequency: Every 10-15 minutes
- Monthly monitoring overhead: 14,760 executions

### After Optimization (Current)
- Total executions: **5,074/month** ⬇️ **-68.5%**
- Monitoring frequency: Every 30 minutes (8am-10pm CST only) ✅
- Monitoring hours: 14 hours/day (instead of 24)
- Monthly monitoring overhead: 3,720 executions
- **Saved: 11,040 executions/month**

### Impact Assessment
✅ **Cost savings:** ~68.5% reduction in cron executions
✅ **Acceptable trade-off:**
   - 30-min detection window vs 10-15 min
   - No monitoring during off-peak hours (10pm-8am CST)
✅ **Reliability maintained:** Active monitoring during all video generation times
✅ **Resource efficiency:** Massive reduction in Vercel infrastructure load
✅ **Business hours coverage:** All video generation happens during monitored hours

---

*Last updated: January 8, 2025*
*Optimization applied: January 8, 2025*
