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
| `/api/cron/check-stuck-heygen` | `*/30 * * * *` | 48 | **1,440** | Check stuck HeyGen videos (every 30 min) ✅ |
| `/api/cron/check-stuck-submagic` | `*/30 * * * *` | 48 | **1,440** | Check stuck Submagic captions (every 30 min) ✅ |
| `/api/cron/check-stuck-posting` | `*/30 * * * *` | 48 | **1,440** | Check stuck social posts (every 30 min) ✅ |
| `/api/cron/start-pending-workflows` | `*/30 * * * *` | 48 | **1,440** | Start pending workflows (every 30 min) ✅ |
| `/api/benefit/workflow/auto-retry` | `0 */2 * * *` | 12 | **360** | Auto-retry failed benefit workflows (every 2 hours) |

**Monitoring & Recovery Subtotal:** 6,120 executions/month (was 14,760 - **saved 8,640!**)

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
| **Monitoring & Recovery** | 6,120 | 81.4% | ⬇️ -8,640 |
| **Video Generation** | 900 | 12.0% | - |
| **Content Management** | 390 | 5.2% | - |
| **Maintenance & Cleanup** | 64 | 0.9% | - |
| **TOTAL** | **7,474** | 100% | ⬇️ **-53.6%** |

---

## Key Insights

### Highest Frequency Crons (Most Executions)
1. 🔄 **check-stuck-heygen** - 1,440/month (every 30 minutes) ✅ Reduced
2. 🔄 **start-pending-workflows** - 1,440/month (every 30 minutes) ✅ Reduced
3. 🔄 **check-stuck-submagic** - 1,440/month (every 30 minutes) ✅ Reduced
4. 🔄 **check-stuck-posting** - 1,440/month (every 30 minutes) ✅ Reduced

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
   - **Saved 8,640 executions/month (53.6% reduction)**
   - Trade-off: Stuck workflows detected within 30 min instead of 10-15 min
   - Impact: Minimal - 30 min detection window is acceptable for most issues
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

---

## 🎯 Optimization Results

### Before Optimization (Original)
- Total executions: **16,114/month**
- Monitoring frequency: Every 10-15 minutes
- Monthly monitoring overhead: 14,760 executions

### After Optimization (Current)
- Total executions: **7,474/month** ⬇️ **-53.6%**
- Monitoring frequency: Every 30 minutes ✅
- Monthly monitoring overhead: 6,120 executions
- **Saved: 8,640 executions/month**

### Impact Assessment
✅ **Cost savings:** ~54% reduction in cron executions
✅ **Acceptable trade-off:** 30-min detection window vs 10-15 min
✅ **Reliability maintained:** Still checking every 30 min
✅ **Resource efficiency:** Reduced load on Vercel infrastructure

---

*Last updated: January 8, 2025*
*Optimization applied: January 8, 2025*
