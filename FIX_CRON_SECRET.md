# Fix Missing CRON_SECRET

## The Problem
Your `CRON_SECRET` environment variable is not set in Vercel, which means:
- ✅ Automatic Vercel cron triggers still work (uses user-agent check)
- ❌ Manual testing doesn't work
- ❌ You can't trigger crons manually to fix stuck workflows

## Step 1: Generate a Secure Secret

Run this command to generate a random secret:

```bash
openssl rand -base64 32
```

Copy the output (should look like: `xK3mP9qR7sT2vW8yZ4bC6dF0gH1jL5nM...`)

## Step 2: Add to Vercel

1. Go to: https://vercel.com/dashboard
2. Select your `ownerfi` project
3. Click **Settings** → **Environment Variables**
4. Click **Add New**
5. Fill in:
   - **Name:** `CRON_SECRET`
   - **Value:** (paste the secret from Step 1)
   - **Environments:** Check all (Production, Preview, Development)
6. Click **Save**

## Step 3: Redeploy

After adding the environment variable, you MUST redeploy:

**Option A: Trigger via Dashboard**
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click **⋯ (three dots)** → **Redeploy**

**Option B: Trigger via Git**
```bash
cd /Users/abdullahabunasrah/Desktop/ownerfi
git commit --allow-empty -m "Trigger redeploy for CRON_SECRET"
git push origin main
```

## Step 4: Test Manually

After redeployment completes (2-3 minutes):

```bash
# Export your new secret (replace with actual value from Step 1)
export CRON_SECRET="your_generated_secret_here"

# Test the posting failsafe (fixes your stuck workflows)
curl -X POST https://ownerfi.ai/api/cron/check-stuck-posting \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "totalWorkflows": 4,
  "completed": 2,
  "failed": 0,
  "results": [...]
}
```

## Step 5: Verify Crons Are Registered

While you're in Vercel Dashboard:

1. Go to **Settings** → **Crons**
2. You should see something like:

```
✅ /api/podcast/cron - Every 2 hours
✅ /api/cron/fetch-rss - Daily at 12 PM
✅ /api/cron/rate-articles - Daily at 1 PM
✅ /api/cron/generate-video - Every 2 hours
✅ /api/cron/check-stuck-heygen - Every 2 hours
✅ /api/cron/check-stuck-submagic - Every 2 hours
✅ /api/cron/check-stuck-posting - Every 2 hours (NEW)
✅ /api/cron/weekly-maintenance - Weekly Monday 11 AM
✅ /api/cron/cleanup-videos - Daily at 3 AM
```

**If you DON'T see this list:**
- Your `vercel.json` might not be deployed
- Crons might be disabled
- There might be a configuration error

Take a screenshot and share it if you need help!

---

## Quick Commands Summary

```bash
# 1. Generate secret
openssl rand -base64 32

# 2. After adding to Vercel and redeploying, test:
export CRON_SECRET="your_secret"

# 3. Fix stuck workflows RIGHT NOW
curl -X POST https://ownerfi.ai/api/cron/check-stuck-posting \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X POST https://ownerfi.ai/api/cron/check-stuck-submagic \
  -H "Authorization: Bearer $CRON_SECRET"

# 4. Check the responses (should show workflows being fixed)
```

---

## Why Your Crons Might Not Have Run

Even though CRON_SECRET is missing, your crons **should still work** because they accept `user-agent: vercel-cron/1.0`.

**Other possible reasons they're not running:**

1. **Not registered in Vercel** - Check Settings → Crons
2. **Schedule restriction** - `0 9-23/2 * * *` only runs 9 AM - 11 PM
3. **Deployment issue** - `vercel.json` changes not deployed
4. **Crons disabled** - Check if toggle is ON in dashboard

After you add CRON_SECRET and check the Crons tab, let me know what you see!
