# 🚀 Abdullah Personal Brand - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Create Late.so Profile (2 minutes)

1. Go to https://app.getlate.so
2. Click "New Profile" → Name it "Abdullah Personal Brand"
3. Connect these accounts:
   - Instagram
   - TikTok
   - YouTube
   - Facebook
   - LinkedIn
4. Copy the Profile ID (looks like: `prof_abc123xyz`)

### Step 2: Add Environment Variable (1 minute)

**Option A: Vercel Dashboard**
1. Go to your Vercel project settings
2. Environment Variables → Add New
3. Key: `LATE_ABDULLAH_PROFILE_ID`
4. Value: `prof_abc123xyz` (your profile ID from Step 1)
5. Environment: Production
6. Save

**Option B: Vercel CLI**
```bash
vercel env add LATE_ABDULLAH_PROFILE_ID production
# Paste your profile ID when prompted
```

### Step 3: Deploy (1 minute)

```bash
git add .
git commit -m "Add Abdullah personal brand automation"
git push origin main
```

### Step 4: Test (1 minute)

Wait for deployment to finish, then:

```bash
# Test script generation only (no videos)
curl https://ownerfi.ai/api/test/abdullah
```

**Expected**: JSON with 5 generated scripts

---

## ✅ That's It!

The system will now:
- Run automatically every day at **6 AM CST**
- Generate **5 videos** (Mindset, Business, Money, Freedom, Story)
- Post them at: **9am, 12pm, 3pm, 6pm, 9pm CST**
- Across: **Instagram, TikTok, YouTube, Facebook, LinkedIn**

---

## 📊 Monitor Progress

**Dashboard**: https://ownerfi.ai/admin/social-dashboard

Filter by: "Abdullah Personal Brand"

---

## 🧪 Manual Trigger (Optional)

Don't want to wait until tomorrow 6 AM? Run it now:

```bash
curl -X POST https://ownerfi.ai/api/cron/generate-abdullah-daily \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or generate without scheduling (immediate post):

```bash
curl -X POST https://ownerfi.ai/api/workflow/complete-abdullah \
  -H "Content-Type: application/json" \
  -d '{"schedule": "immediate", "platforms": ["instagram"]}'
```

---

## 💰 Cost

**~$7.50/day = $225/month** for:
- 150 videos/month
- 750 posts/month (5 platforms × 150)
- Zero manual work

---

## 🆘 Troubleshooting

**Problem**: "LATE_ABDULLAH_PROFILE_ID not configured"
**Solution**: Go back to Step 2, make sure you saved the env var

**Problem**: Cron not running
**Solution**: Check Vercel dashboard → Cron Jobs → Verify "generate-abdullah-daily" is listed

**Problem**: Videos stuck in "heygen_processing"
**Solution**: Wait 10-15 minutes. HeyGen videos take time to generate.

---

## 📖 Full Documentation

For detailed docs, see: `ABDULLAH_CONTENT_SYSTEM.md`

---

**You're all set! Your personal brand is now on autopilot.** 🔥
