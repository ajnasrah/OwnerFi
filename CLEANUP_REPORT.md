# 🧹 OWNERFI CODEBASE CLEANUP REPORT
Generated: May 31, 2026

## EXECUTIVE SUMMARY
Identified **150+ files** and **26 empty Firebase collections** that can be safely removed to reduce storage and improve maintainability.

## 1️⃣ API ROUTES TO REMOVE (10 routes)

### Deprecated/Old Endpoints
```
❌ src/app/api/test/migration-flow/route.ts - Test/migration code
❌ src/app/api/auth/cleanup-old-account/route.ts - One-time cleanup
❌ src/app/api/scraper/add-to-queue/route.ts - Old scraper system
❌ src/app/api/admin/scraper/status/route.ts - Old scraper admin
❌ src/app/api/admin/scraper/upload/route.ts - Old scraper upload
❌ src/app/api/cron/process-scraper-queue/route.ts - Old scraper queue
❌ src/app/api/cron/run-agent-outreach-scraper/route.ts - Replaced by v2
❌ src/app/api/cron/refresh-zillow-status/route.ts - Replaced by fixed version
❌ src/app/api/property/video-cron/route.ts - Duplicate video processing
❌ src/app/api/process-video/route.ts - Duplicate video processing
```

## 2️⃣ SCRIPTS TO REMOVE (70+ files)

### One-time/Test Scripts
```bash
# Remove all test and check scripts
rm scripts/check-*.ts
rm scripts/test-*.ts
rm scripts/fix-*.ts
rm scripts/cleanup-*.ts
rm scripts/emergency-*.ts
rm scripts/diagnose-*.ts
rm scripts/verify-*.ts
rm scripts/audit-*.ts
rm scripts/smoke-*.ts

# Specific files to remove:
- _check-lambert.ts
- _verify-fixes-tmp.ts
- hotfix-foreclosure-status.ts
- full-status-check.ts
- trigger-cron-*.ts
- force-update-property.ts
- analyze-*.ts (after this cleanup)
```

Total: **84 script files** can be removed

## 3️⃣ FIREBASE COLLECTIONS TO DELETE (26 collections)

### Empty Collections (0 documents)
```
🗑️ agent_outreach_attempts
🗑️ agent_scrape_results  
🗑️ scraper_runs
🗑️ buyers
🗑️ realtors
🗑️ investors
🗑️ video_queue
🗑️ video_queue_spanish
🗑️ workflow_states
🗑️ workflow_states_spanish
🗑️ workflow_logs
🗑️ workflow_logs_spanish
🗑️ feed_store
🗑️ articles
🗑️ ab_test_assignments
🗑️ user_logs
🗑️ failed_properties
🗑️ property_images
🗑️ cre_deals
🗑️ cre_analysis_jobs
🗑️ sms_logs
🗑️ tcpa_pending
🗑️ scheduled_searches
🗑️ dealtype_updates
🗑️ migration_log
🗑️ temp_collections
```

## 4️⃣ CRON JOBS TO REVIEW

### Potentially Unused Crons
```
⚠️ /api/cron/daily-video - Check if video generation is still needed
⚠️ /api/cron/trending-video - Check if trending videos are used
⚠️ /api/cron/workflow-monitor - Check if workflows are active
```

## 5️⃣ CODE QUALITY ISSUES

### Technical Debt
- **84 instances** of @ts-ignore or eslint-disable
- **94 TODO/FIXME** comments
- **24 video processing** references (likely duplicated)
- **Multiple queue systems** (should consolidate)

## 6️⃣ PROPERTY DATA CLEANUP

### Database Optimization
```
Properties Collection (11,352 total):
- 1,192 properties not scraped in 90+ days → Archive
- 4,252 inactive properties → Review for deletion
- Sold/off-market properties → Delete after 30 days
```

## 7️⃣ DUPLICATE FUNCTIONALITY

### Systems with Multiple Implementations
- **Video Processing**: Multiple endpoints for same functionality
- **Queue Systems**: scraper_queue vs agent_outreach_queue  
- **Property Upload**: Multiple versions (v1-v4)
- **Status Checking**: Original vs fixed version

## 📊 ESTIMATED IMPACT

### Storage Savings
- **Code reduction**: ~420KB (84 files)
- **Database**: ~4,000+ documents can be archived/deleted
- **Empty collections**: 26 collections removed
- **Total estimate**: ~5-10MB immediate savings

### Performance Benefits
- Faster builds (fewer files to compile)
- Cleaner codebase (easier maintenance)
- Reduced Firebase operations
- Less confusion from duplicate code

## 🎯 RECOMMENDED ACTIONS

### Immediate (Safe to do now)
1. Delete all empty Firebase collections
2. Remove test/check/fix scripts from /scripts
3. Delete old API routes marked above
4. Remove the original refresh-zillow-status cron

### Short-term (Next sprint)
1. Archive properties not updated in 90+ days
2. Consolidate video processing to single endpoint
3. Remove @ts-ignore and fix TypeScript errors
4. Clean up TODO/FIXME comments

### Long-term (Planning needed)
1. Consolidate queue systems
2. Remove older upload endpoint versions
3. Implement automated cleanup for old data
4. Set up monitoring for unused endpoints

## ⚠️ DO NOT REMOVE
- Active cron jobs (refresh-zillow-status-fixed, scraper, etc.)
- Core collections (properties, users, agent_outreach_queue)
- Authentication endpoints
- Buyer/investor/realtor APIs (even if collections are empty)

## 💡 MAINTENANCE TIPS
1. Set up automated cleanup for logs older than 30 days
2. Archive completed agent_outreach_queue entries
3. Implement soft delete for properties (mark inactive first)
4. Add monitoring to identify unused endpoints
5. Regular quarterly cleanup reviews

---

**Next Steps**: Start with removing empty collections and test scripts. These are safe to delete immediately and will provide quick wins for storage optimization.