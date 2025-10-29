# Quick Fix Guide - Viral Video "No Articles" Error

## Problem
```
Failed to start workflow (400): Article has insufficient content for video generation
Failed to start workflow (404): No articles available
```

## Root Cause
1. Articles in database have **0 characters of content**
2. RSS feeds either provide only snippets OR web scraper failed
3. Quality filter rejects articles with insufficient content

---

## Solution (Step-by-Step)

### Step 1: Audit Your RSS Feeds ✅ DONE

We tested all feeds to see which ones provide full content:

```bash
npx tsx scripts/audit-all-feeds.ts
```

**Results will show**:
- ✅ GOOD feeds (1000+ chars avg) - KEEP these
- ⚠️ MEDIUM feeds (300-1000 chars) - REVIEW these
- ❌ BAD feeds (<300 chars) - DISABLE these
- 💥 ERROR feeds - DISABLE these

### Step 2: Disable Bad Feeds

Edit `src/config/feed-sources.ts` and set `enabled: false` for any feeds marked ❌ or 💥.

Example:
```typescript
{
  id: 'ownerfi-bad-feed',
  name: 'Bad Feed Name',
  url: 'https://example.com/feed',
  category: 'ownerfi',
  subcategory: 'market',
  enabled: false, // ← Change this to false
  fetchInterval: 60
}
```

### Step 3: Clean Up Empty Articles

Delete all existing articles with no content:

```bash
npx tsx scripts/cleanup-empty-articles.ts
```

This removes articles with <50 characters (corrupted from web scraper failures).

### Step 4: Fetch Fresh Articles

Now fetch NEW articles from your GOOD feeds:

```bash
curl -X GET https://ownerfi.ai/api/cron/fetch-feeds
```

**Expected output**:
```json
{
  "success": true,
  "newArticles": 25,  // Should see new articles!
  "feeds": {...}
}
```

### Step 5: Rate Articles with AI

Rate the new articles using the 30-year-old audience criteria:

```bash
curl -X GET https://ownerfi.ai/api/cron/rate-articles
```

**Expected output**:
```json
{
  "success": true,
  "rated": 25,
  "kept": 18,  // Articles with score >= 70
  "deleted": 7
}
```

### Step 6: Test Viral Video Workflow

Now try the workflow again:

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

## Understanding the Flow

```
RSS Feed → Fetch Articles → Rate with AI → Select Best → Generate Video
   ↓            ↓              ↓              ↓             ↓
GOOD feeds   Store in DB   Score 0-100   Pick score≥70  Create script
(1000+ chars)              (30yo view)                  with OpenAI
```

---

## Common Issues

### "No articles available" (404)
**Cause**: No articles with qualityScore >= 70 in database

**Solution**:
1. Check if articles exist: `npx tsx scripts/check-article-status.ts`
2. If no articles: Run Step 4 (fetch feeds)
3. If unrated articles: Run Step 5 (rate articles)
4. If all scored <70: Your feeds might be poor quality - check audit results

### "Article has insufficient content" (400)
**Cause**: Article has 0-50 characters

**Solution**:
1. Check feed quality: `npx tsx scripts/test-feed-content.ts`
2. Disable bad feeds (Step 2)
3. Clean up (Step 3)
4. Fetch fresh (Step 4)

### "All feeds provide snippets"
**Cause**: Your RSS feeds don't include full article text

**Solution**:
- Find better RSS feeds that include `<content:encoded>` tags
- Look for feeds from publishers that provide full text
- Examples of GOOD feeds:
  - HousingWire (3000+ chars)
  - Realtor.com (7000+ chars)
  - Motor1 (2500+ chars)

---

## Feed Quality Criteria

| Quality | Avg Content | Action | Example |
|---------|-------------|--------|---------|
| ✅ GOOD | 1000+ chars | KEEP | HousingWire, Realtor.com |
| ⚠️ MEDIUM | 300-1000 chars | REVIEW | Some industry blogs |
| ❌ BAD | <300 chars | DISABLE | Snippet-only feeds |
| 💥 ERROR | 0 items | DISABLE | Broken/404 feeds |

---

## Monitoring

### Check Article Status Anytime

```bash
npx tsx scripts/check-article-status.ts
```

Shows:
- Total articles in database
- How many are rated
- How many scored >= 70
- Sample article previews

### Test Individual Feed

```bash
npx tsx scripts/test-feed-content.ts
```

Tests 3 feeds and shows their content quality.

---

## Prevention

### Weekly Maintenance

1. **Monday**: Check feed audit for broken feeds
2. **Wednesday**: Review article quality scores
3. **Friday**: Clean up old/processed articles

### Automate (Optional)

Add these to your cron:
- Fetch feeds: Every 2 hours
- Rate articles: Daily at 3 AM
- Cleanup: Weekly on Sunday

---

## Success Metrics

After following these steps, you should see:

✅ **90%+ articles** with content > 1000 chars
✅ **70%+ articles** rated as quality >= 70
✅ **0 workflow errors** from insufficient content
✅ **Better video quality** from richer source material

---

## Need Help?

**Check logs**: `vercel logs --filter "cron/fetch-feeds"`

**Check database**: `npx tsx scripts/check-article-status.ts`

**Check feeds**: `npx tsx scripts/audit-all-feeds.ts`

---

**Last Updated**: October 25, 2025
**Status**: ✅ Ready to Use
