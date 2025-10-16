# A/B Testing Framework - Quick Start Guide

## Overview

The A/B testing framework automatically tracks video performance across different variations to optimize your content strategy. It tests hooks, captions, and posting times to find what drives the most engagement.

---

## Quick Start (5 Minutes)

### 1. Create Your First Test

```bash
# Start a hook test for Carz
curl -X POST http://localhost:3000/api/ab-tests/create \
  -H "Content-Type: application/json" \
  -d '{"preset": "hook", "brand": "carz"}'

# Response:
# {"success": true, "testId": "abtest_1760...", "message": "A/B test created successfully"}
```

**What this does:**
- Creates a 50/50 split test
- **Variant A (Question Hook)**: "Did you know that {{topic}}? Here's what you need to know..."
- **Variant B (Statement Hook)**: "Here's something shocking about {{topic}}..."

### 2. Generate Videos (System Handles Automatically)

From now on, when you generate videos for Carz:
- 50% will use question-based hooks
- 50% will use statement-based hooks
- System automatically tracks which variant performed better

No manual work needed! Just generate videos normally.

### 3. View Results After 20-30 Videos

```bash
# Get test results
curl "http://localhost:3000/api/ab-tests/results?testId=abtest_1760..."

# Shows:
# - Which variant is winning
# - Confidence level (needs 30+ samples for statistical significance)
# - Engagement rates per variant
```

### 4. Complete Test When Ready

```bash
# Mark test as complete and declare winner
curl -X POST http://localhost:3000/api/ab-tests/complete \
  -H "Content-Type: application/json" \
  -d '{"testId": "abtest_1760..."}'

# System will automatically use the winning variant going forward!
```

---

## Available Test Types

### 1. Hook Style Test
Tests which video opening drives more engagement.

```bash
curl -X POST http://localhost:3000/api/ab-tests/create \
  -H "Content-Type: application/json" \
  -d '{
    "preset": "hook",
    "brand": "carz"
  }'
```

**Variants:**
- **A**: Question-based hook ("Did you know...?")
- **B**: Statement-based hook ("Here's something shocking...")

**Best for**: Testing first 3 seconds of video

---

### 2. Caption Style Test
Tests which caption format drives more clicks/saves.

```bash
curl -X POST http://localhost:3000/api/ab-tests/create \
  -H "Content-Type: application/json" \
  -d '{
    "preset": "caption",
    "brand": "ownerfi"
  }'
```

**Variants:**
- **A**: Short & Punchy (1-2 sentences, emoji heavy)
- **B**: Detailed & Informative (longer with context)

**Best for**: Testing social media caption effectiveness

---

### 3. Posting Time Test
Tests which time of day gets best engagement.

```bash
curl -X POST http://localhost:3000/api/ab-tests/create \
  -H "Content-Type: application/json" \
  -d '{
    "preset": "posting_time",
    "brand": "carz"
  }'
```

**Variants:**
- **A**: Morning (9 AM ET)
- **B**: Evening (7 PM ET)

**Best for**: Finding optimal posting schedule

---

## How It Works

### Automatic Tracking Flow:

```
1. You create an A/B test → System activates it

2. Generate a video → System randomly assigns variant A or B

3. Video gets posted → System records:
   - Which variant was used
   - Where it was posted (Instagram, TikTok, etc.)
   - When it was posted

4. Metrics collection (future) → Cron job fetches:
   - Views, likes, comments, shares per platform
   - Engagement rate
   - Watch time

5. Winner calculation → After 30+ samples:
   - Statistical analysis determines winner
   - Confidence level calculated
   - You can complete test and apply winner
```

---

## API Reference

### Create Test
```
POST /api/ab-tests/create
Body: {
  "preset": "hook" | "caption" | "posting_time",
  "brand": "carz" | "ownerfi" | "podcast"
}
```

### List Tests
```
GET /api/ab-tests/list?brand=carz
```

### Get Results
```
GET /api/ab-tests/results?testId=abtest_xxx
```

### Complete Test
```
POST /api/ab-tests/complete
Body: {"testId": "abtest_xxx"}
```

---

## Best Practices

### 1. **Run One Test at a Time Per Brand**
Don't test hooks AND captions simultaneously - you won't know which caused the difference.

### 2. **Wait for Statistical Significance**
- Minimum: 30 samples per variant (60 total videos)
- Better: 50 samples per variant (100 total videos)
- The system calculates confidence automatically

### 3. **Test Duration**
- Minimum: 1 week (accounts for day-of-week variation)
- Better: 2 weeks (accounts for algorithmic fluctuations)

### 4. **When to Complete a Test**
Complete when:
- ✅ 30+ samples per variant
- ✅ Clear winner (5%+ difference in engagement rate)
- ✅ Confidence level > 80%

Don't complete if:
- ❌ Results are too close (< 2% difference)
- ❌ Not enough samples yet (< 30 per variant)
- ❌ Confidence < 70%

---

## Example: Full Test Cycle

```bash
# Day 1: Start test
curl -X POST http://localhost:3000/api/ab-tests/create \
  -H "Content-Type: application/json" \
  -d '{"preset": "hook", "brand": "carz"}'

# Day 7: Check progress (after ~35 videos)
curl "http://localhost:3000/api/ab-tests/results?testId=abtest_xxx"
# Response shows: A is winning but only 60% confidence (keep going)

# Day 14: Check again (after ~70 videos)
curl "http://localhost:3000/api/ab-tests/results?testId=abtest_xxx"
# Response shows: A is winning with 85% confidence! 🎉

# Complete test and apply winner
curl -X POST http://localhost:3000/api/ab-tests/complete \
  -H "Content-Type: application/json" \
  -d '{"testId": "abtest_xxx"}'

# Future videos automatically use winning variant!
```

---

## Firestore Collections

The framework uses these collections:

- **`ab_tests`**: Test definitions
- **`ab_test_results`**: Individual video results

Fields automatically tracked in workflows:
- `abTestId`: Which test this video belongs to
- `abTestVariantId`: Which variant (A, B, C, etc.)
- `abTestResultId`: Result document ID

---

## Custom Tests (Advanced)

You can create custom tests with your own variants:

```javascript
{
  "preset": "custom",
  "customTest": {
    "name": "CTA Placement Test",
    "description": "Test where to place call-to-action",
    "type": "cta",
    "brand": "carz",
    "variants": [
      {
        "id": "A",
        "name": "CTA at Start",
        "description": "Call-to-action in first 3 seconds"
      },
      {
        "id": "B",
        "name": "CTA at End",
        "description": "Call-to-action in last 3 seconds"
      }
    ],
    "trafficSplit": [50, 50],
    "status": "active",
    "startDate": Date.now()
  }
}
```

---

## Metrics Collection (Coming Soon)

Currently, the framework tracks:
- ✅ Which variant was used
- ✅ Where/when posted
- ✅ Video URLs

Future metrics (requires Late API integration):
- 📊 Views per platform
- 💬 Comments per platform
- ❤️ Likes per platform
- 🔄 Shares per platform
- ⏱️ Watch time
- 📈 Engagement rate

---

## Troubleshooting

**Q: Test not assigning variants?**
- Check test status is "active": `curl http://localhost:3000/api/ab-tests/list?brand=carz`
- Only one test per type can be active at once

**Q: How long until I see results?**
- Minimum 30 videos (15 per variant) for meaningful data
- Usually 1-2 weeks at 5 videos/day

**Q: Can I pause a test?**
- Yes, update test status to "paused" in Firestore
- Or complete it early with `/api/ab-tests/complete`

**Q: How do I delete a test?**
- Manually delete from Firestore `ab_tests` collection
- Or set status to "completed"

---

## Next Steps

1. **Start your first test** (use quick start above)
2. **Generate 30+ videos** (system handles variant assignment)
3. **Check results** after 1-2 weeks
4. **Complete test** and apply winning variant
5. **Start next test** (test something else!)

---

## Dashboard (Coming Soon)

A visual dashboard will show:
- Active tests
- Real-time results
- Winner prediction
- Engagement graphs

For now, use the API endpoints to check results.

---

**Questions?** Check the code at:
- `/src/lib/ab-testing.ts` - Core framework
- `/src/lib/ab-testing-integration.ts` - Workflow integration
- `/src/app/api/ab-tests/*` - API endpoints
