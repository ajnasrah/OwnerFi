# Redis Setup Guide (Upstash - Free Cloud Redis)

## Step 1: Create Free Upstash Account

1. Go to: **https://upstash.com/**
2. Click "Get Started" or "Sign Up"
3. Sign up with GitHub, Google, or Email (it's FREE forever for small projects)

## Step 2: Create Redis Database

1. After logging in, click **"Create Database"**
2. Choose these settings:
   - **Name**: `ownerfi-workflows` (or any name you want)
   - **Type**: **Global** (best performance worldwide)
   - **Region**: Choose closest to you (or auto-select)
   - **Eviction**: **No Eviction** (keep all data)
3. Click **"Create"**

## Step 3: Get Your Redis URL

1. On your database dashboard, you'll see connection details
2. Look for **"UPSTASH_REDIS_REST_URL"** - it looks like:
   ```
   https://YOUR-DATABASE-NAME.upstash.io
   ```
3. **Copy this URL**

## Step 4: Add to Your .env.local File

Open `/Users/abdullahabunasrah/Desktop/ownerfi/.env.local` and add:

```bash
# Enable Redis
USE_REDIS=true
UPSTASH_REDIS_REST_URL=rediss://default:YOUR_PASSWORD@YOUR-DATABASE-NAME.upstash.io:6379
```

**Note**: Upstash will give you a full connection URL that looks like:
```
rediss://default:AbCdEf123456@my-db-12345.upstash.io:6379
```

Just copy and paste the ENTIRE URL.

## Step 5: Restart Your Server

```bash
# Stop current server (Ctrl+C in the terminal running npm run dev)
# Then start again:
npm run dev
```

## Verify It's Working

You should see this in your server logs:
```
✅ Redis workflow store initialized
```

If you see this, Redis is working! 🎉

## Troubleshooting

### "Failed to initialize Redis"
- Double-check your URL is correct
- Make sure `USE_REDIS=true` is set
- Verify no extra spaces in .env.local

### "Connection refused"
- Check your internet connection
- Verify the Upstash URL is the full connection string (starts with `rediss://`)

### "Authentication failed"
- Make sure you copied the ENTIRE URL including the password part

## What Happens Now?

✅ **Workflows persist** - Server restarts won't lose data
✅ **Webhooks work** - HeyGen callbacks will find their workflows
✅ **Production ready** - System can run 24/7 reliably

## Alternative: Test Without Redis First

If you want to test the system working RIGHT NOW without setting up Redis, I can add a **polling backup** that checks HeyGen status every 30 seconds. This works without Redis but uses more API calls.

Let me know if you need help!
