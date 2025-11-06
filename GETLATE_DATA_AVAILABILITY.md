# GetLate Data Availability - What Analytics Are Actually Provided

**Analysis Date:** November 6, 2025
**Data Source:** GetLate Analytics API
**Total Posts Analyzed:** 1,557 posts across all platforms

---

## 📊 Summary: What GetLate Provides vs. What Has Data

| Platform | Total Posts | Viewership Metric | Coverage | Engagement Data | Status |
|----------|-------------|-------------------|----------|-----------------|--------|
| **YouTube** | 137 | ✅ Views | 97.8% (134/137) | 48.2% (66/137) | ✅ Excellent |
| **Instagram** | 419 | ✅ Reach | 83.1% (348/419) | 45.6% (191/419) | ✅ Very Good |
| **TikTok** | 102 | ✅ Views | 64.7% (66/102) | 10.8% (11/102) | ⚠️ Good |
| **Threads** | 366 | ⚠️ Minimal | 37.4% (137/366) | Limited | ⚠️ Poor |
| **Facebook** | 432 | ❌ None | 0.0% (0/432) | 7.4% (32/432) | 🚨 Critical |

---

## 🔍 Platform-Specific Analysis

### ✅ YouTube (Best Data Quality)

**What GetLate Provides:**
```json
{
  "views": 123,        // ✅ Available
  "likes": 5,          // ✅ Available
  "comments": 2,       // ✅ Available
  "shares": 1,         // ✅ Available
  "saves": 0,          // ⚠️ Not used
  "impressions": 0,    // ⚠️ Not used
  "reach": 0           // ⚠️ Not used
}
```

**Data Availability:**
- **Views:** 134/137 posts (97.8%) ✅
- **Likes:** 66/137 posts (48.2%)
- **Comments:** Available
- **Shares:** Available

**Primary Metric:** `views`

**Analysis Quality:** ⭐⭐⭐⭐⭐ Excellent - Near perfect coverage for calculating engagement rates

---

### ✅ Instagram (Very Good Data Quality)

**What GetLate Provides:**
```json
{
  "views": 0,          // ❌ Not used (Instagram doesn't call it "views")
  "likes": 5,          // ✅ Available
  "comments": 2,       // ✅ Available
  "shares": 1,         // ✅ Available
  "saves": 0,          // ⚠️ Rarely populated
  "impressions": 0,    // ❌ Not used
  "reach": 232         // ✅ Available (Instagram's viewership metric)
}
```

**Data Availability:**
- **Reach:** 348/419 posts (83.1%) ✅ (Instagram's equivalent to views)
- **Likes:** 191/419 posts (45.6%)
- **Comments:** Available
- **Shares:** Available

**Primary Metric:** `reach` (not `views`)

**Analysis Quality:** ⭐⭐⭐⭐ Very Good - High coverage for engagement analysis

**Note:** Instagram uses "reach" instead of "views" for video content. GetLate correctly maps this to the `reach` field.

---

### ⚠️ TikTok (Good But Limited)

**What GetLate Provides:**
```json
{
  "views": 156,        // ✅ Available
  "likes": 8,          // ⚠️ Limited availability
  "comments": 1,       // ⚠️ Limited availability
  "shares": 2,         // ⚠️ Limited availability
  "saves": 0,          // ❌ Not used
  "impressions": 0,    // ❌ Not used
  "reach": 0           // ❌ Not used
}
```

**Data Availability:**
- **Views:** 66/102 posts (64.7%) ⚠️
- **Likes:** 11/102 posts (10.8%) ⚠️ Very low
- **Comments:** Available but sparse
- **Shares:** Available but sparse

**Primary Metric:** `views`

**Analysis Quality:** ⭐⭐⭐ Good - Decent viewership data but low engagement tracking

**Note:** TikTok has lower data coverage overall. This may be due to:
- Recent posts not having accumulated metrics yet
- TikTok API delays in reporting data
- Privacy settings on some videos

---

### ⚠️ Threads (Poor Data Quality)

**What GetLate Provides:**
```json
{
  "views": 2,          // ⚠️ Very low numbers
  "likes": 0,          // ⚠️ Minimal data
  "comments": 0,       // ⚠️ Minimal data
  "shares": 0,         // ⚠️ Minimal data
  "saves": 0,          // ❌ Not used
  "impressions": 0,    // ❌ Not used
  "reach": 0           // ❌ Not used
}
```

**Data Availability:**
- **Views:** 137/366 posts (37.4%) - But typically 1-5 views only
- **Likes:** Very minimal
- **Engagement:** Extremely low overall

**Primary Metric:** `views` (but numbers are suspiciously low)

**Analysis Quality:** ⭐⭐ Poor - Data exists but shows very low engagement

**Note:** Threads either:
- Has genuinely poor performance for your content
- Has limited API access for analytics
- Is not sharing full metrics with third-party apps like GetLate

---

### 🚨 Facebook (Critical Data Quality Issue)

**What GetLate Provides:**
```json
{
  "views": 0,          // ❌ ALWAYS 0
  "likes": 2,          // ⚠️ Minimal (5.6% of posts)
  "comments": 1,       // ⚠️ Rare (1.2% of posts)
  "shares": 1,         // ⚠️ Minimal (4.9% of posts)
  "saves": 0,          // ❌ ALWAYS 0
  "impressions": 0,    // ❌ ALWAYS 0
  "reach": 0           // ❌ ALWAYS 0
}
```

**Data Availability:**
- **Views:** 0/432 posts (0.0%) ❌
- **Reach:** 0/432 posts (0.0%) ❌
- **Impressions:** 0/432 posts (0.0%) ❌
- **Likes:** 24/432 posts (5.6%) ⚠️
- **Comments:** 5/432 posts (1.2%) ⚠️
- **Shares:** 21/432 posts (4.9%) ⚠️

**Primary Metric:** None available

**Analysis Quality:** ⭐ Critical Failure - Cannot calculate engagement rates without viewership data

**Issue:** GetLate provides the field structure but receives **zero viewership data** from Facebook for all 432 posts.

---

## 🔬 Technical Analysis

### Field Structure Provided by GetLate

All platforms receive the same field structure:
```typescript
{
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  impressions: number;
  reach: number;
}
```

### Platform-Specific Usage

| Field | YouTube | Instagram | TikTok | Facebook | Threads |
|-------|---------|-----------|--------|----------|---------|
| **views** | ✅ Primary | ❌ Not used | ✅ Primary | ❌ Always 0 | ⚠️ Low values |
| **reach** | ❌ Not used | ✅ Primary | ❌ Not used | ❌ Always 0 | ❌ Not used |
| **impressions** | ❌ Not used | ❌ Not used | ❌ Not used | ❌ Always 0 | ❌ Not used |
| **likes** | ✅ Good | ✅ Good | ⚠️ Limited | ⚠️ Minimal | ⚠️ Minimal |
| **comments** | ✅ Good | ✅ Good | ⚠️ Limited | ⚠️ Rare | ⚠️ Minimal |
| **shares** | ✅ Good | ✅ Good | ⚠️ Limited | ⚠️ Minimal | ⚠️ Minimal |
| **saves** | ❌ Not used | ⚠️ Rare | ❌ Not used | ❌ Always 0 | ❌ Not used |

---

## 📈 Engagement Rate Calculation

### How We Calculate Engagement

```
Engagement Rate = (Likes + Comments + Shares + Saves) / Viewership Metric × 100
```

### Viewership Metric by Platform

- **YouTube:** Uses `views`
- **Instagram:** Uses `reach` (not views!)
- **TikTok:** Uses `views`
- **Threads:** Uses `views` (but very low numbers)
- **Facebook:** ❌ **Cannot calculate** - no viewership metric available

---

## 🚨 Facebook-Specific Issue

### The Problem

**All 432 Facebook posts show:**
- Views: 0
- Reach: 0
- Impressions: 0

Yet some posts have engagement:
- 24 posts have likes (max: 6 likes)
- 5 posts have comments
- 21 posts have shares

### Why This Happens

This is **not normal** and indicates one of these issues:

1. **Facebook API Permissions Issue**
   - GetLate may not have the right Facebook Graph API permissions
   - Required permissions: `pages_read_engagement`, `pages_show_list`, `read_insights`

2. **Facebook Page Access Token Issue**
   - Access token may have expired
   - Token may not have necessary scopes
   - Page may need to be reconnected to GetLate

3. **Facebook API Limitation**
   - Facebook may not share video view metrics with third-party apps
   - Meta may have restricted this data for privacy/policy reasons
   - GetLate may be using an older API version that doesn't support these metrics

4. **Post Privacy Settings**
   - Private posts don't share full analytics
   - Page may have restrictions that prevent metric sharing

### What's Working vs. Broken

| Metric | Status | Evidence |
|--------|--------|----------|
| Post Publishing | ✅ Working | 432 posts successfully published |
| Engagement Collection | ⚠️ Partially Working | Some likes/comments/shares collected |
| View/Reach Collection | ❌ Broken | 100% of posts show 0 |
| Impression Collection | ❌ Broken | 100% of posts show 0 |

---

## 💡 Recommendations by Platform

### YouTube ✅
**Status:** Excellent - No action needed
- Continue using GetLate for YouTube analytics
- Data quality is excellent for optimization decisions

### Instagram ✅
**Status:** Very Good - No action needed
- Continue using GetLate for Instagram analytics
- Remember to use `reach` not `views` for calculations
- Data quality is very good for optimization decisions

### TikTok ⚠️
**Status:** Adequate - Monitor closely
- Usable but could be better
- Consider increasing posting frequency to gather more data points
- Low engagement tracking may mean posts are too new or TikTok API delays

### Threads ⚠️
**Status:** Poor - Consider alternatives
- Very low view counts (1-5 views per post) seem suspicious
- May not be worth continued investment
- Consider reducing posting frequency or dropping platform
- Alternative: Check Threads native analytics to compare

### Facebook 🚨
**Status:** Critical - Immediate action required
1. **Contact GetLate Support** (support@getlate.dev or miki@getlate.dev)
   - Subject: "Facebook Analytics Not Showing Views/Reach/Impressions"
   - Include: Account details, sample post IDs
   - Ask: What permissions are needed? Is this a known issue?

2. **Check Facebook Connection**
   - Reconnect Facebook Page in GetLate dashboard
   - Verify permissions granted during connection
   - Check for any error messages

3. **Use Alternative Analytics**
   - Meta Business Suite (business.facebook.com)
   - Export data manually until GetLate integration is fixed
   - Use Facebook Graph API directly if you have dev resources

4. **Verify Page Settings**
   - Ensure Facebook Page is public
   - Check post visibility settings
   - Verify Page is not restricted

---

## 📊 Data Coverage Comparison

### By Completeness (Viewership + Engagement)

1. **YouTube:** 97.8% viewership + 48.2% engagement = ⭐⭐⭐⭐⭐
2. **Instagram:** 83.1% viewership + 45.6% engagement = ⭐⭐⭐⭐
3. **TikTok:** 64.7% viewership + 10.8% engagement = ⭐⭐⭐
4. **Threads:** 37.4% viewership (low values) = ⭐⭐
5. **Facebook:** 0.0% viewership + 7.4% engagement = ⭐ (Critical)

### Recommended for Optimization Decisions

- ✅ **YouTube** - High confidence
- ✅ **Instagram** - High confidence
- ⚠️ **TikTok** - Medium confidence (needs more data)
- ❌ **Threads** - Low confidence (poor performance or data issues)
- ❌ **Facebook** - Cannot recommend (no viewership data)

---

## 🔧 What GetLate Could Improve

### For All Platforms
- Document which fields are used per platform
- Provide data quality indicators in API responses
- Add timestamps for when analytics were last updated

### For Facebook Specifically
- Fix view/reach/impression collection
- Add error logging when metrics can't be retrieved
- Provide clear error messages when permissions are missing
- Document Facebook-specific setup requirements

### For TikTok
- Improve engagement data collection
- Investigate why likes/comments/shares are sparse
- Add retry logic for posts with missing data

### For Threads
- Investigate suspiciously low view counts
- Verify Threads API integration is complete
- Consider if Threads analytics are worth supporting

---

## ✅ Conclusion

**What GetLate Does Well:**
- ✅ YouTube analytics are excellent
- ✅ Instagram analytics are very good (correctly uses `reach`)
- ✅ Consistent API structure across platforms
- ✅ Regular data updates

**What Needs Fixing:**
- 🚨 **Facebook viewership data is completely missing**
- ⚠️ TikTok engagement tracking is limited
- ⚠️ Threads shows suspiciously low numbers

**For Your Use Case:**
- **Trust:** YouTube and Instagram data for optimization decisions
- **Monitor:** TikTok data quality as you gather more posts
- **Don't Trust:** Facebook recommendations until viewership data is available
- **Consider Dropping:** Threads if performance doesn't improve

---

*Analysis based on 1,557 posts from GetLate Analytics API*
*Report generated: November 6, 2025*
