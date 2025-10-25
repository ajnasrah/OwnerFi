# IMMEDIATE ACTION REQUIRED - Fix Viral Videos

## Current Status
❌ **All viral video workflows failing with "No articles available"**

**Root Cause**: 70% of your RSS feeds are broken or provide zero content.

---

## ✅ SOLUTION (Follow These Steps)

### Step 1: Clean Up Database (Run This Now)

```bash
npx tsx scripts/cleanup-empty-articles.ts
```

This removes all articles with 0 content from your database.

---

### Step 2: Disable Broken Feeds

**OwnerFi has 28 feeds total:**
- ✅ 9 feeds work perfectly (3000-9000 chars each)
- ❌ 19 feeds are broken (need to disable)

**Option A (Quick):** Temporarily disable ALL OwnerFi feeds except these 9:

In `src/config/feed-sources.ts`, keep ONLY these feeds enabled:

```typescript
'ownerfi-housingwire'          // HousingWire - Housing Market News
'ownerfi-realtor-news'         // Realtor.com - News & Insights
'ownerfi-zillow-research'      // Zillow - Research & Insights
'ownerfi-redfin-news'          // Redfin - Real Estate News
'ownerfi-theclose'             // The Close - Real Estate News
'ownerfi-housingwire-realestate'  // HousingWire - Real Estate
'ownerfi-housingwire-mortgages'   // HousingWire - Mortgages
'ownerfi-familyhandyman'       // Family Handyman
'ownerfi-homeadvisor-blog'     // HomeAdvisor - Home Tips
```

**Set `enabled: false` for all others.**

**Option B (Complete Removal):** Delete the 19 broken feeds entirely from the file.

---

### Step 3: Fetch Fresh Articles

```bash
curl -X GET https://ownerfi.ai/api/cron/fetch-feeds
```

**Expected**: Should fetch 25-30 new articles with FULL content.

---

### Step 4: Rate Articles

```bash
curl -X GET https://ownerfi.ai/api/cron/rate-articles
```

**Expected**: Articles rated 0-100 based on 30-year-old audience criteria.

---

### Step 5: Test Workflow

```bash
curl -X POST https://ownerfi.ai/api/workflow/complete-viral \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "ownerfi",
    "platforms": ["instagram", "tiktok"],
    "schedule": "optimal"
  }'
```

**Expected**: ✅ SUCCESS! Video generation starts.

---

## Why This Happened

**70% of your feeds are broken:**

| Status | Count | Reason |
|--------|-------|--------|
| 404 Error | 8 feeds | RSS URL no longer exists |
| No Items | 6 feeds | Feed returns empty |
| Forbidden | 1 feed | Website blocks access |
| Fetch Failed | 2 feeds | DNS/connection issues |
| Zero Content | 5 feeds | Only provides headlines |

**Examples of broken feeds**:
- NAR Newsroom: 404 error
- Mortgage News Daily: No items
- BiggerPockets: Zero content
- Forbes Mortgages: 404 error

---

## The 9 Working Feeds (KEEP THESE!)

These provide excellent content for videos:

1. **HousingWire** (3,486 chars avg)
   - Housing market trends, policy changes

2. **Realtor.com** (6,745 chars avg)
   - Real estate news, market data

3. **Zillow Research** (3,113 chars avg)
   - Market insights, trends

4. **Redfin News** (5,937 chars avg)
   - Housing market analysis

5. **The Close** (9,862 chars avg)
   - Real estate industry news

6. **HousingWire Real Estate** (2,890 chars avg)
   - Real estate specific news

7. **HousingWire Mortgages** (2,830 chars avg)
   - Mortgage rate updates

8. **Family Handyman** (5,977 chars avg)
   - Home improvement tips

9. **HomeAdvisor** (8,044 chars avg)
   - Homeowner advice

**Total**: 9 feeds providing 25-30 high-quality articles per day

---

## What You'll Get After Fixing

✅ **25-30 articles/day** with 3000-9000 chars each
✅ **70%+ quality scores** (30-year-old approved)
✅ **0 "no articles" errors**
✅ **0 "empty content" errors**
✅ **Better video quality** from richer sources

---

## Diagnostic Commands

**Check article status**:
```bash
npx tsx scripts/check-article-status.ts
```

**Test feed content**:
```bash
npx tsx scripts/test-feed-content.ts
```

**Full feed audit** (takes 5 mins):
```bash
npx tsx scripts/audit-all-feeds.ts
```

---

## Timeline

1. **Now**: Disable broken feeds (2 minutes)
2. **Now**: Clean database (30 seconds)
3. **Now**: Fetch new articles (1 minute)
4. **Now**: Rate articles (2 minutes)
5. **Now**: Test workflow (SUCCESS!)

**Total time**: ~5 minutes to fix completely

---

##  Next Steps After Fix

1. ✅ Monitor `/admin/social-dashboard` for video progress
2. ✅ Check article quality scores weekly
3. ✅ Add more good RSS feeds if needed
4. ✅ Run `cleanup-empty-articles.ts` monthly

---

**Created**: October 25, 2025
**Priority**: 🔴 URGENT - Workflow is broken
**Effort**: 5 minutes
**Impact**: Fixes all viral video generation
