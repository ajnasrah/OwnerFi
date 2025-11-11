# 🔍 COMPLETE SYSTEM DIAGNOSIS: Cost Tracking & Billing

**Generated:** October 30, 2025
**Status:** 🔴 CRITICAL - Cost tracking completely broken

---

## 🚨 EXECUTIVE SUMMARY

### Current State
- **Cost Tracking Database:** Only 4 entries EVER, 0 in last 30 days
- **API Integration:** Only 1 of 5 services tracks costs (HeyGen only)
- **Dashboard:** Returns empty data (works as designed, but no data to show)
- **Estimated Monthly Waste:** Unable to track $585-750/month in spending

### Root Cause
**Cost tracking code exists but is NOT CALLED when making API requests to:**
- ✅ HeyGen (tracking implemented)
- ❌ Submagic (NO tracking)
- ❌ OpenAI (NO tracking)
- ❌ Late.so (NO tracking)
- ❌ Cloudflare R2 (NO tracking)

---

## 📊 SERVICE-BY-SERVICE BREAKDOWN

### 1. HeyGen (Video Generation) - ✅ TRACKED
**File:** `src/lib/heygen-client.ts:252`
```typescript
await trackCost(
  brand,
  'heygen',
  'video_generation',
  1, // 1 credit
  calculateHeyGenCost(1),
  workflowId
);
```
**Status:** ✅ Working correctly
**Last call:** Unknown (need to verify recent workflows)

---

### 2. Submagic (Caption Generation) - ❌ NOT TRACKED
**File:** `src/lib/submagic-client.ts`
**Functions:**
- `checkSubmagicStatus()` - NO cost tracking
- `checkMultipleSubmagicJobs()` - NO cost tracking

**Problem:** Function only checks status, doesn't track when caption job is created

**Missing:** Cost tracking in wherever Submagic jobs are CREATED (likely in workflow routes)

---

### 3. OpenAI (Script Generation) - ❌ NOT TRACKED
**File:** Multiple files use OpenAI
**Locations:**
- `src/app/api/workflow/complete-abdullah/route.ts`
- `src/app/api/chatbot/route.ts`
- `src/app/api/articles/rate-all-async/route.ts`

**Problem:** OpenAI client calls exist but NO cost tracking after completion

**Missing:** Need to track after each OpenAI API call with token counts

---

### 4. Late.so (Social Media Posting) - ❌ NOT TRACKED
**File:** `src/lib/late-api.ts`
**Functions:**
- `postToLate()` - NO cost tracking
- `getLateProfiles()` - NO cost tracking

**Problem:** Posts to social media but never records cost

**Missing:** Cost tracking in `postToLate()` function after successful post

---

### 5. Cloudflare R2 (Video Storage) - ❌ NOT TRACKED
**File:** `src/lib/video-storage.ts` (likely)
**Problem:** Video uploads/downloads not tracked

**Missing:** Cost tracking for storage operations

---

## 🔧 WHAT EXISTS vs WHAT'S MISSING

### ✅ What EXISTS and WORKS:
1. **Cost Tracker Library** (`src/lib/cost-tracker.ts`)
   - `trackCost()` function ✅
   - `getTotalDailyCosts()` ✅
   - `getTotalMonthlyCosts()` ✅
   - `getMonthlyBreakdown()` ✅
   - `checkBudget()` ✅

2. **Cost Dashboard API** (`src/app/api/costs/dashboard/route.ts`)
   - Endpoint works ✅
   - Handles empty data gracefully ✅
   - Returns proper format ✅

3. **Firebase Collections:**
   - `cost_entries` - exists ✅
   - `daily_costs` - exists (likely empty)
   - `monthly_costs` - exists (likely empty)

### ❌ What's MISSING:
1. **Integration Points** - Cost tracking NOT called after API requests
2. **Submagic tracking** - Never implemented
3. **OpenAI tracking** - Never implemented
4. **Late tracking** - Never implemented
5. **R2 tracking** - Never implemented
6. **Firebase Index** - Composite index for efficient queries
7. **Historical Data** - No backfill of past 30 days

---

## 📋 COMPREHENSIVE FIX STRATEGY

### Phase 1: Critical Fixes (DAY 1)
**Goal:** Start tracking costs TODAY

#### Task 1.1: Add Submagic Cost Tracking
**File to Edit:** Find where Submagic jobs are CREATED
**Action:** Add `trackCost()` call after successful job creation
```typescript
await trackCost(
  brand,
  'submagic',
  'caption_generation',
  1, // 1 credit
  calculateSubmagicCost(1), // $0.25
  workflowId
);
```

#### Task 1.2: Add OpenAI Cost Tracking
**Files to Edit:** All routes that call OpenAI
**Action:** Add `trackCost()` after completion
```typescript
const response = await openai.chat.completions.create({...});
const { usage } = response;

await trackCost(
  brand,
  'openai',
  'script_generation',
  usage.total_tokens,
  calculateOpenAICost(usage.prompt_tokens, usage.completion_tokens),
  workflowId
);
```

#### Task 1.3: Add Late Cost Tracking
**File to Edit:** `src/lib/late-api.ts` - `postToLate()` function
**Action:** Add `trackCost()` after successful post
```typescript
await trackCost(
  brand,
  'late',
  'social_post',
  1, // 1 post
  0, // Late is flat rate, track as $0 per post
  workflowId
);
```

#### Task 1.4: Add R2 Cost Tracking
**File to Edit:** `src/lib/video-storage.ts`
**Action:** Add `trackCost()` after uploads
```typescript
await trackCost(
  brand,
  'r2',
  'video_upload',
  fileSizeInGB,
  calculateR2Cost(fileSizeInGB),
  workflowId
);
```

---

### Phase 2: Database Setup (DAY 1)
**Goal:** Fix Firebase indexing

#### Task 2.1: Create Firebase Composite Index
**Action:** Click this link and create index:
https://console.firebase.google.com/v1/r/project/ownerfi-95aa0/firestore/indexes?create_composite=ClJwcm9qZWN0cy9vd25lcmZpLTk1YWEwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9jb3N0X2VudHJpZXMvaW5kZXhlcy9fEAEaCQoFYnJhbmQQARoNCgl0aW1lc3RhbXAQARoMCghfX25hbWVfXxAB

**Or manually create index:**
- Collection: `cost_entries`
- Fields: `brand` (Ascending), `timestamp` (Ascending)

---

### Phase 3: Verification (DAY 2)
**Goal:** Confirm tracking works

#### Task 3.1: Generate Test Video
**Action:** Trigger one complete workflow for each brand
- OwnerFi viral video
- Carz viral video
- Property video
- Benefit video
- Podcast episode

#### Task 3.2: Verify Cost Entries
**Action:** Run script to check database
```bash
node scripts/get-all-costs.js
```
**Expected:** Should see 5-10 new cost entries

#### Task 3.3: Test Cost Dashboard
**Action:** Visit dashboard or call API
```bash
curl https://ownerfi.ai/api/costs/dashboard
```
**Expected:** Should show today's spend > $0

---

### Phase 4: Historical Data (DAY 3)
**Goal:** Backfill missing data where possible

#### Task 4.1: Analyze Workflow History
**Action:** Query workflows collection for last 30 days
- Count HeyGen video generations
- Count Submagic caption jobs
- Estimate OpenAI script generations

#### Task 4.2: Create Estimated Cost Entries
**Action:** Backfill cost_entries with estimates
```typescript
// For each past workflow
await trackCost(
  workflow.brand,
  'heygen',
  'video_generation',
  1,
  0.50,
  workflow.id,
  workflow.timestamp // Use original timestamp
);
```

---

### Phase 5: Monitoring & Alerts (DAY 4)
**Goal:** Set up proactive monitoring

#### Task 5.1: Add Budget Alerts
**Action:** Set up email/Slack alerts when:
- Daily spend exceeds $25
- Monthly spend exceeds $600
- Any service exceeds 90% of quota

#### Task 5.2: Daily Cost Report Cron
**Action:** Create cron job to send daily summary
- Total spend yesterday
- Breakdown by brand
- Breakdown by service
- Remaining budget

---

## 🎯 TODO LIST (Ordered by Priority)

### IMMEDIATE (TODAY):
- [ ] 1. Find Submagic job creation code and add `trackCost()`
- [ ] 2. Find all OpenAI calls and add `trackCost()` with token counts
- [ ] 3. Edit `postToLate()` in late-api.ts to add `trackCost()`
- [ ] 4. Create Firebase composite index for cost_entries queries
- [ ] 5. Test with one workflow end-to-end

### DAY 2:
- [ ] 6. Add R2 storage cost tracking to video uploads
- [ ] 7. Run test workflows for all brands
- [ ] 8. Verify cost entries appear in database
- [ ] 9. Verify cost dashboard shows data
- [ ] 10. Deploy to production

### DAY 3:
- [ ] 11. Query workflows for last 30 days
- [ ] 12. Calculate estimated costs from historical workflows
- [ ] 13. Backfill cost_entries with estimates
- [ ] 14. Verify dashboard shows historical data

### DAY 4:
- [ ] 15. Set up budget alert thresholds
- [ ] 16. Create daily cost report cron job
- [ ] 17. Add cost tracking to any remaining API calls
- [ ] 18. Document cost tracking integration guide

### ONGOING:
- [ ] 19. Monitor daily costs
- [ ] 20. Compare tracked costs vs actual billing statements
- [ ] 21. Adjust cost formulas if needed
- [ ] 22. Add new services to tracking as they're added

---

## 📊 SUCCESS METRICS

After fixes are complete, you should see:

1. **Daily Cost Entries:** 20-50 per day across all brands
2. **Cost Dashboard:** Shows $15-25/day current spend
3. **Monthly Total:** Tracks toward $585-750/month
4. **Brand Breakdown:** See OwnerFi, Carz, VassDistro, etc. individually
5. **Service Breakdown:** See HeyGen, Submagic, OpenAI, Late, R2 separately

---

## 🔍 FILES TO EDIT (Summary)

1. **Find Submagic creation:** `grep -rn "submagic.*create\|submagic.*job" src/app/api/`
2. **OpenAI calls:** Already identified in diagnosis
3. **Late API:** `src/lib/late-api.ts` line ~200-300 (postToLate function)
4. **R2 Storage:** `src/lib/video-storage.ts` or wherever videos are uploaded
5. **Cost formulas:** Already exist in `src/lib/cost-tracker.ts`

---

## 💡 KEY INSIGHTS

### Why This Happened:
1. **Cost tracking library was built** but integration was incomplete
2. **Only HeyGen was wired up** during initial development
3. **Other services were added later** without cost tracking
4. **No monitoring** to catch that costs weren't being recorded

### Why It's Critical:
1. **Can't optimize** what you can't measure
2. **Burning $585-750/month** without visibility
3. **Could be exceeding budgets** without knowing
4. **Can't attribute costs** to specific brands/features

### Why It's Fixable:
1. **Core infrastructure exists** (trackCost function works)
2. **Just need to call it** in 4 more places
3. **Can be done in < 4 hours** of focused work
4. **Will immediately start collecting data**

---

## 🚀 NEXT STEPS

**RIGHT NOW:**
1. Read this entire document
2. Decide if you want to fix it yourself or have me do it
3. If me: Tell me to start with Phase 1, Task 1.1
4. If you: Follow the TODO list above

**This Week:**
- Complete Phases 1-3 (critical fixes + verification)
- Start seeing actual cost data in dashboard

**This Month:**
- Complete Phase 4 (historical backfill)
- Complete Phase 5 (monitoring/alerts)
- Have 30 days of accurate cost data

---

*End of Diagnosis*
