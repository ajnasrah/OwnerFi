# Diagnose Why Crons Aren't Running

Your workflows are 20h, 41h, and 43h old, which proves the failsafe crons **haven't been running**.

## Check #1: Are Crons Enabled in Vercel?

1. Go to Vercel Dashboard → Your Project → Settings → Crons
2. Verify you see:
   - `/api/cron/check-stuck-heygen` - Every 2 hours
   - `/api/cron/check-stuck-submagic` - Every 2 hours
3. Check if they show "Last Run" timestamps
4. Look for any error messages

**If you don't see them listed**, your `vercel.json` might not be deployed properly.

## Check #2: Test Manually Right Now

Run this command to trigger the Submagic failsafe manually:

```bash
curl -X POST https://ownerfi.ai/api/cron/check-stuck-submagic \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

**Expected response**: JSON showing how many stuck workflows were found and processed.

**If you get 401 Unauthorized**: Your `CRON_SECRET` env var isn't set properly in Vercel.

**If you get 404**: The route doesn't exist (deployment issue).

## Check #3: Verify Environment Variable

In Vercel Dashboard → Settings → Environment Variables:

Check if `CRON_SECRET` is set. If not, add it:
```
CRON_SECRET=<your_secret_value>
```

Then redeploy.

## Check #4: Check Vercel Logs

1. Go to Vercel Dashboard → Deployments → Latest Deployment → Logs
2. Filter by "cron"
3. Look for entries like:
   ```
   🔍 [FAILSAFE] Checking for stuck Submagic workflows...
   ```

**If you see nothing**: Crons aren't being triggered by Vercel.

## Check #5: Verify Cron Schedule Format

Your current `vercel.json` has:
```json
"schedule": "0 9-23/2 * * *"
```

This means: "At minute 0 of every 2nd hour from 9 through 23" (9 AM, 11 AM, 1 PM, 3 PM, 5 PM, 7 PM, 9 PM, 11 PM)

**Issue**: If it's currently outside 9 AM - 11 PM, the cron won't run!

To test if this is the issue, temporarily change to:
```json
"schedule": "*/15 * * * *"  // Every 15 minutes, 24/7
```

Deploy and wait 15 minutes to see if it runs.

## Most Likely Causes

### 1. Crons Not Enabled in Vercel
**Solution**:
- Go to Vercel Dashboard → Settings → Crons
- Click "Enable Crons" if you see that option
- Make sure you're on a plan that supports crons (Hobby and Pro do)

### 2. Wrong Vercel Plan
Vercel Hobby plan has cron limits. Check:
- Hobby: Max 2 crons
- Pro: Unlimited crons

You have **7 crons** defined, which exceeds Hobby limit.

**Solution**: Either upgrade to Pro or reduce number of crons.

### 3. Deployment Issue
The `vercel.json` changes might not be deployed.

**Solution**:
```bash
git add vercel.json
git commit -m "Fix cron schedules"
git push origin main
```

Then check Vercel Dashboard to ensure it deployed.

## Quick Test Script

Save this as `test-crons.sh`:

```bash
#!/bin/bash

echo "Testing OwnerFi Cron Endpoints..."
echo ""

CRON_SECRET="${CRON_SECRET:-your_secret_here}"
BASE_URL="https://ownerfi.ai"

echo "1. Testing Submagic Failsafe..."
curl -s -X POST "$BASE_URL/api/cron/check-stuck-submagic" \
  -H "Authorization: Bearer $CRON_SECRET" | jq .

echo ""
echo "2. Testing HeyGen Failsafe..."
curl -s -X POST "$BASE_URL/api/cron/check-stuck-heygen" \
  -H "Authorization: Bearer $CRON_SECRET" | jq .

echo ""
echo "3. Testing NEW Posting Failsafe..."
curl -s -X POST "$BASE_URL/api/cron/check-stuck-posting" \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
```

Run with:
```bash
chmod +x test-crons.sh
./test-crons.sh
```

This will immediately show you which crons work and which don't.

## Immediate Action Items

1. **Check Vercel plan** - Are you on Hobby with >2 crons?
2. **Test manually** - Run the curl commands above
3. **Check Vercel logs** - Look for cron execution logs
4. **Verify deployment** - Ensure latest `vercel.json` is deployed
5. **Check env vars** - Ensure `CRON_SECRET` is set in Vercel

Once you identify the issue, I can help you fix it!
