# Copy-Paste Testing Commands

## ⚡ QUICK START - What You Can Test RIGHT NOW

### 1. Create the Missing Firestore Index (REQUIRED FIRST)

**Option A: Firebase Console (Easiest - 2 clicks)**

Click this link and press "Create Index":
```
https://console.firebase.google.com/v1/r/project/ownerfi-95aa0/firestore/indexes?create_composite=Clhwcm9qZWN0cy9vd25lcmZpLTk1YWEwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wbGF0Zm9ybV9hbmFseXRpY3MvaW5kZXhlcy9fEAEaCQoFYnJhbmQQARoMCghzeW5jZWRBdBABGgwKCF9fbmFtZV9fEAE
```

Wait 2-5 minutes for it to build, then proceed with testing below.

**Option B: Firebase CLI**
```bash
firebase deploy --only firestore:indexes
```

---

## 📊 Test 1: Weekly Optimization Report

### For OwnerFi:
```bash
npx tsx scripts/weekly-optimization-report.ts ownerfi
```

### For Carz:
```bash
npx tsx scripts/weekly-optimization-report.ts carz
```

### For All Brands:
```bash
npx tsx scripts/weekly-optimization-report.ts
```

**What you'll see:**
- Platform performance (YouTube + Instagram)
- Caption analysis (length, questions, hashtags)
- Best posting times and days
- Actionable recommendations
- Copy-paste configuration settings

---

## 🚀 Test 2: Cross-Platform Post Creator

### Test with OwnerFi:
```bash
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "https://example.com/test.mp4" \
  --topic "How to buy a house with bad credit using owner financing"
```

### Test with Carz:
```bash
npx tsx scripts/cross-platform-post.ts \
  --brand carz \
  --video "https://example.com/test.mp4" \
  --topic "Tesla recall affects 13,000 vehicles - what you need to know"
```

### Schedule for specific time:
```bash
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "https://example.com/test.mp4" \
  --topic "Credit myths debunked" \
  --schedule "2025-11-04T14:00:00Z"
```

### Post to Instagram only:
```bash
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "https://example.com/test.mp4" \
  --topic "Owner financing explained" \
  --platforms instagram
```

**What you'll see:**
1. Analytics insights fetched
2. AI-generated optimized caption
3. Engagement-boosting first comment
4. Auto-scheduled time (based on your data)
5. Confirmation of post scheduling

---

## 🔍 Test 3: Check What's Already Working

### View Caption Intelligence:
```bash
npx tsx scripts/test-caption-intelligence.ts
```

### Sync Latest Analytics:
```bash
npx tsx scripts/sync-platform-analytics.ts
```

### Platform-Specific Analysis:
```bash
npx tsx scripts/platform-specific-analysis.ts
```

---

## 🌐 Test 4: API Endpoint (After Index is Created)

### Test the API directly:

**For OwnerFi (7 days):**
```bash
curl "https://ownerfi.ai/api/analytics/weekly-optimization?brand=ownerfi&days=7" | jq
```

**For Carz (30 days):**
```bash
curl "https://ownerfi.ai/api/analytics/weekly-optimization?brand=carz&days=30" | jq
```

**If your dev server is running locally:**
```bash
curl "http://localhost:3000/api/analytics/weekly-optimization?brand=ownerfi&days=7" | jq
```

---

## 💡 Real-World Usage Examples

### Monday Morning Routine:
```bash
# 1. Generate weekly report for all brands
npx tsx scripts/weekly-optimization-report.ts

# 2. Review insights and note best posting times

# 3. Create posts for the week using optimal settings
```

### Create and Schedule Content:
```bash
# Example: Post property video to both platforms
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "https://storage.googleapis.com/ownerfi-videos/property-123.mp4" \
  --topic "Beautiful 3BR home in Houston - $1200/month owner financing"

# Example: Carz EV news
npx tsx scripts/cross-platform-post.ts \
  --brand carz \
  --video "https://storage.googleapis.com/carz-videos/tesla-news.mp4" \
  --topic "Tesla announces new Model 3 - price drop explained"
```

### Test Different Platforms:
```bash
# YouTube only
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "VIDEO_URL" \
  --topic "TOPIC" \
  --platforms youtube

# Instagram only
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "VIDEO_URL" \
  --topic "TOPIC" \
  --platforms instagram

# Both (default)
npx tsx scripts/cross-platform-post.ts \
  --brand ownerfi \
  --video "VIDEO_URL" \
  --topic "TOPIC"
```

---

## 📈 What Success Looks Like

### Weekly Report Output:
```
═══════════════════════════════════════════════════
📊 WEEKLY OPTIMIZATION REPORT - OWNERFI
═══════════════════════════════════════════════════

📈 SUMMARY
   Total Posts: 15
   Total Views: 45,230
   Avg Engagement Rate: 3.2%
   Week-over-Week Growth: +12.5%

📺 YOUTUBE PERFORMANCE
   Posts: 8
   Avg Views: 6,500
   Caption Length: 265 chars (OPTIMAL: 200-300)

📸 INSTAGRAM PERFORMANCE
   Posts: 7
   Avg Views: 4,200
   Caption Length: 248 chars (OPTIMAL: 200-300)

⏰ BEST POSTING TIMES
   1. 2:00 PM - 7,200 avg views ⭐
   2. 7:00 PM - 6,800 avg views
   3. 12:00 PM - 5,900 avg views

✅ RECOMMENDATIONS READY TO COPY
```

### Cross-Platform Post Output:
```
📱 CROSS-PLATFORM POST CREATOR
════════════════════════════════════════════════════

✅ POST SCHEDULED SUCCESSFULLY!
   Post ID: abc123xyz
   Scheduled for: Monday, Nov 4, 2025 at 2:00 PM
   Platforms: youtube, instagram

📝 Caption (264 chars):
   "This is how I bought a house with a 550 credit score!
   Are you tired of banks saying no?
   Owner financing let me go from $1500 rent to $1200 mortgage.
   #homeowner #ownerfinance #badcredit #realestate"

💬 First Comment:
   "💬 Tag someone who needs to see this! #mortgage #creditrepair"
```

---

## 🎯 Quick Wins

Once the index is ready, you can immediately:

1. **See Your Best Posting Times** (based on YOUR data, not generic advice)
2. **Auto-Generate Optimized Captions** (AI-powered, proven formulas)
3. **Schedule Cross-Platform** (YouTube + Instagram simultaneously)
4. **Get Weekly Insights** (what's working, what's not)
5. **Copy-Paste Recommendations** (actionable settings)

---

## 🐛 Troubleshooting

### "Index required" error:
✅ Create the index using the URL above

### "No data available":
```bash
# Sync analytics first
npx tsx scripts/sync-platform-analytics.ts
```

### "OpenAI API error":
Check that `OPENAI_API_KEY` is set in `.env.local`

### "Late API error":
Check that `LATE_API_KEY` is set in `.env.local`

---

## 📚 Documentation

- **Full System Docs:** `WEEKLY_OPTIMIZATION_SYSTEM.md`
- **Test Results:** `TEST_RESULTS_SUMMARY.md`
- **Quick Reference:** `QUICK_REFERENCE_OPTIMIZATION.md`

---

**Ready to test? Create the index first, then copy-paste any command above!**
