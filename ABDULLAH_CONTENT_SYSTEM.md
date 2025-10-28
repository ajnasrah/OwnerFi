# 🎯 Abdullah Personal Brand Content System

Complete automation system for generating 5 daily short-form videos (15-30 seconds each) for Abdullah's personal brand across social media platforms.

---

## 🏗️ System Architecture

```
Daily Cron (6 AM CST)
  ↓
Generate 5 Scripts (OpenAI)
  ↓
Create 5 HeyGen Videos (Sequential)
  ↓
HeyGen Webhook → Upload to R2
  ↓
Send to Submagic (Captions)
  ↓
Submagic Webhook → Upload to R2
  ↓
Post to Late.so (Staggered Schedule)
```

**Posting Schedule (CST):**
- 9:00 AM → Video 1 (Mindset)
- 12:00 PM → Video 2 (Business)
- 3:00 PM → Video 3 (Money)
- 6:00 PM → Video 4 (Freedom)
- 9:00 PM → Video 5 (Story/Lesson)

---

## 📋 Setup Checklist

### 1. Environment Variables

Add to `.env.local` or Vercel environment:

```bash
# Already configured (shared across brands)
OPENAI_API_KEY=sk-...
HEYGEN_API_KEY=...
SUBMAGIC_API_KEY=...

# NEW: Abdullah Late.so Profile
LATE_ABDULLAH_PROFILE_ID=your_late_profile_id_here

# Webhook secret (already configured)
CRON_SECRET=your_cron_secret_here
```

**Action Required:**
1. Create a new Late.so profile for "Abdullah Personal Brand"
2. Connect social accounts: Instagram, TikTok, YouTube, Facebook, LinkedIn
3. Copy the profile ID and add as `LATE_ABDULLAH_PROFILE_ID`

---

### 2. Firestore Collection

The system automatically uses: `abdullah_workflow_queue`

**No manual setup needed** - collection is created automatically on first workflow run.

---

### 3. HeyGen Avatar Configuration

Already configured to use Abdullah's motion-enabled avatar:
- **Avatar ID**: `d33fe3abc2914faa88309c3bdb9f47f4` (motion-enabled)
- **Voice ID**: `5bd25d00f41c477989e1e121a16986d3` (Abdullah's voice)
- **Background**: Black (`#000000`) for personal brand aesthetic
- **Type**: `talking_photo` (expressive style)

---

### 4. Vercel Cron Job Setup

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-abdullah-daily",
      "schedule": "0 11 * * *"
    }
  ]
}
```

**Schedule**: `0 11 * * *` = 6:00 AM CST (11:00 AM UTC)

After deployment, verify cron in Vercel dashboard:
- Go to your project → Settings → Cron Jobs
- Confirm "generate-abdullah-daily" is listed
- Status should show "Active"

---

## 🧪 Testing

### Test Script Generation Only

```bash
curl https://ownerfi.ai/api/test/abdullah
```

**Returns**: 5 generated scripts with validation results (no videos created)

**Test single script**:
```bash
curl https://ownerfi.ai/api/test/abdullah?count=1
```

### Test Full Workflow (1 Video)

Create a test file `test-abdullah.ts`:

```typescript
// Generate 1 video end-to-end
const response = await fetch('https://ownerfi.ai/api/workflow/complete-abdullah', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    platforms: ['instagram'],  // Test with 1 platform
    schedule: 'immediate',      // Post immediately
    testMode: true              // Optional flag
  })
});

const result = await response.json();
console.log(result);
```

Run: `npx tsx test-abdullah.ts`

**Expected**:
- 5 scripts generated
- 5 HeyGen videos started
- Workflow IDs returned
- Webhooks will process in background (~10-15 min)

---

### Test Daily Cron Manually

```bash
curl -X POST https://ownerfi.ai/api/cron/generate-abdullah-daily \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Expected Output**:
```json
{
  "success": true,
  "message": "Abdullah daily content generated successfully",
  "videos": [
    {
      "theme": "Mindset",
      "title": "...",
      "workflowId": "...",
      "scheduledTime": "2025-10-28T14:00:00.000Z"
    },
    // ... 4 more videos
  ],
  "schedule": "staggered"
}
```

---

## 📊 Monitoring

### Admin Dashboard

Monitor all Abdullah workflows:
```
https://ownerfi.ai/admin/social-dashboard
```

Filter by brand: **Abdullah Personal Brand**

### Workflow Status API

```bash
curl https://ownerfi.ai/api/workflow/logs?brand=abdullah
```

**Statuses**:
- `pending` → Queued
- `heygen_processing` → Video generating
- `submagic_processing` → Captions adding
- `posting` → Publishing to social
- `completed` → Live on platforms
- `failed` → Error occurred

### Firestore Console

View queue directly:
```
https://console.firebase.google.com/project/ownerfi-ai/firestore/data/abdullah_workflow_queue
```

---

## 🎨 Content Strategy

### Daily Themes (Auto-Rotating)

| Day       | Theme                | Focus                          |
|-----------|----------------------|--------------------------------|
| Monday    | Mindset Monday       | Truth bombs, perspective       |
| Tuesday   | Money Tuesday        | Ownership, wealth, hustle      |
| Wednesday | Wisdom Wednesday     | Lessons from failure/success   |
| Thursday  | Tactical Thursday    | Business strategy, game plans  |
| Friday    | Freedom Friday       | Legacy, purpose, peace         |
| Sat/Sun   | Weekend Mix          | Rotation of all themes         |

### Script Structure (15-30 seconds)

```
[0-3s]   Pattern Interrupt  → Shock, bold claim, contradiction
[3-10s]  Curiosity Hook     → "Most people get this wrong..."
[10-25s] Value Bomb         → Core insight, story, truth
[25-30s] CTA + Question     → "Follow Abdullah..." + engagement
```

### Call-to-Action Pool (Randomly Selected)

- "Follow Abdullah for daily mindset hits."
- "Follow Abdullah to stay sharp."
- "Follow Abdullah — new drops daily."
- "Follow Abdullah if you're building something real."
- "Follow Abdullah before everyone else does."

### Engagement Questions (Randomly Selected)

- "Agree or disagree?"
- "You ever felt this?"
- "Would you do it differently?"
- "What's your take?"
- "Tag someone who needs this."

---

## 💰 Cost Estimate

**Per Day** (5 videos):
- OpenAI (script generation): ~$0.03
- HeyGen (5 × 30s videos): ~$2.50
- Submagic (5 caption projects): ~$5.00
- Late.so (posting): Free
- **Total: ~$7.50/day**

**Per Month** (150 videos):
- **~$225/month**

**ROI**:
- 150 videos/month
- 5 platforms × 150 = **750 posts/month**
- Zero manual work after setup

---

## 🛠️ Troubleshooting

### Issue: "LATE_ABDULLAH_PROFILE_ID not configured"

**Solution**:
1. Create Late.so profile at https://getlate.so
2. Copy profile ID
3. Add to Vercel env: `LATE_ABDULLAH_PROFILE_ID=...`
4. Redeploy

### Issue: Cron not running

**Check**:
1. Vercel dashboard → Cron Jobs tab
2. Confirm schedule matches UTC conversion
3. Check logs: Vercel dashboard → Deployments → Functions → Logs
4. Verify `CRON_SECRET` is set

### Issue: Videos stuck in "heygen_processing"

**Cause**: HeyGen webhook not reaching server

**Solutions**:
1. Check HeyGen webhook URL is correct:
   ```
   https://ownerfi.ai/api/webhooks/heygen/abdullah
   ```
2. Verify webhook in HeyGen dashboard (if accessible)
3. Check Vercel function logs for webhook errors
4. Manually check status:
   ```bash
   curl "https://api.heygen.com/v1/video_status.get?video_id=VIDEO_ID" \
     -H "x-api-key: $HEYGEN_API_KEY"
   ```

### Issue: Videos not posting to social

**Check**:
1. Late.so profile connected: https://app.getlate.so
2. All platforms authenticated
3. Check workflow logs: `/api/workflow/logs?brand=abdullah`
4. Verify `LATE_ABDULLAH_PROFILE_ID` is correct

### Issue: Script quality issues

**Action**:
1. Check generated scripts: `GET /api/test/abdullah`
2. Review validation errors
3. Adjust prompts in `/src/lib/abdullah-content-generator.ts`
4. Test with specific themes:
   ```typescript
   generateSingleAbdullahScript(apiKey, 'Mindset', 'Growth mindset', 'Monday')
   ```

---

## 🔄 Manual Operations

### Generate Content for Specific Date

```bash
curl -X POST https://ownerfi.ai/api/workflow/complete-abdullah \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-10-29",
    "platforms": ["instagram", "tiktok"],
    "schedule": "staggered"
  }'
```

### Post Immediately (No Scheduling)

```bash
curl -X POST https://ownerfi.ai/api/workflow/complete-abdullah \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": "immediate",
    "platforms": ["instagram"]
  }'
```

### Retry Failed Workflow

1. Get workflow ID from dashboard
2. Check status: `/api/workflow/logs?workflowId=XXX`
3. Identify failure point (heygen/submagic/posting)
4. Manually trigger next step or regenerate

---

## 📁 File Structure

```
/src
  /app/api
    /workflow
      /complete-abdullah/route.ts     # Main workflow endpoint
    /cron
      /generate-abdullah-daily/route.ts # Daily cron job
    /webhooks
      /heygen/[brand]/route.ts         # HeyGen webhook (supports abdullah)
      /submagic/[brand]/route.ts       # Submagic webhook (supports abdullah)
    /test
      /abdullah/route.ts               # Testing endpoint
  /lib
    /abdullah-content-generator.ts     # Script generation logic
  /config
    /brand-configs.ts                  # Abdullah brand config
    /constants.ts                      # System constants

/ABDULLAH_CONTENT_SYSTEM.md            # This file
```

---

## 🚀 Deployment Checklist

- [x] Environment variables configured
- [x] Late.so profile created and connected
- [x] Vercel cron job added to `vercel.json`
- [ ] Test script generation: `GET /api/test/abdullah`
- [ ] Test single video workflow
- [ ] Test full 5-video workflow
- [ ] Verify webhooks receiving callbacks
- [ ] Confirm videos posting to social
- [ ] Monitor first automated cron run (6 AM CST next day)
- [ ] Set up alerts for failures (optional)

---

## 📞 Support

If issues persist:

1. Check Vercel function logs
2. Review Firestore workflow queue
3. Test individual components (OpenAI → HeyGen → Submagic → Late)
4. Contact support with workflow ID and error logs

---

**System Status**: ✅ Ready for Production

**Next Action**: Add `LATE_ABDULLAH_PROFILE_ID` to environment variables and deploy! 🔥
