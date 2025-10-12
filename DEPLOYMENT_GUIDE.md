# 🚀 Production Deployment Guide

## Complete Automated Video Pipeline - Cloud Deployment

This guide will help you deploy the complete A→Z automated video generation and social media posting system to the cloud.

---

## 📋 Overview

**What Gets Deployed:**
- RSS Feed Scheduler (runs 24/7)
- AI Article Evaluation System
- Video Generation Pipeline (HeyGen → Submagic)
- Auto-posting to 6 Social Media Platforms
- Webhook Endpoints for HeyGen & Submagic

**Architecture:**
- **Railway/Render**: Full Next.js app with scheduler
- **OR Hybrid**: Vercel (frontend) + Railway (scheduler only)

---

## 🎯 Option 1: Railway (RECOMMENDED - All-in-One)

### Step 1: Prepare Your Repository

1. **Commit all changes:**
```bash
git add .
git commit -m "Add automated video generation system"
git push
```

2. **Required files** (already created):
- ✅ `railway.json` - Railway configuration
- ✅ `Procfile` - Start command
- ✅ `.env.example` - Environment variable template

### Step 2: Deploy to Railway

1. **Go to**: https://railway.app/
2. **Click**: "Start a New Project"
3. **Select**: "Deploy from GitHub repo"
4. **Choose**: Your `ownerfi` repository
5. **Railway will auto-detect** Next.js and deploy

### Step 3: Configure Environment Variables

In Railway Dashboard → Variables, add these:

```bash
# Essential
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://your-app.railway.app

# Database (use Railway's PostgreSQL addon or keep SQLite)
DATABASE_URL=file:./prod.db

# APIs (copy from your .env.local)
OPENAI_API_KEY=sk-proj-your_openai_api_key_here
HEYGEN_API_KEY=your_heygen_api_key_here
SUBMAGIC_API_KEY=your_submagic_api_key_here

# Metricool (copy from your .env.local)
METRICOOL_API_KEY=your_metricool_api_key_here
METRICOOL_USER_ID=your_metricool_user_id_here
METRICOOL_AUTO_POST=true
METRICOOL_PLATFORMS=instagram,facebook,tiktok,youtube,linkedin,threads
METRICOOL_SCHEDULE_DELAY=immediate

# Workflow Storage
USE_REDIS=false

# NextAuth
NEXTAUTH_URL=https://your-app.railway.app
NEXTAUTH_SECRET=Kx8vN2mP7wR9tY5uI3oL6jH1sA4dG8fK2nB7cX9zQ5vM3pW6yE0rT8uI5oL2jH1s

# Firebase (copy from .env.local)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=1:your_sender_id:web:13376f1c0bd9fa95700b07
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----\n"\n

# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key

# Stripe (copy from your .env.local)
STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here
```

### Step 4: Start the Scheduler

Create an API route to auto-start the scheduler on deployment:

**File: `src/app/api/startup/route.ts`** (already created - see below)

Railway will call this on startup.

### Step 5: Configure HeyGen & Submagic Webhooks

Once deployed, update webhook URLs:

**HeyGen Webhook URL:**
```
https://your-app.railway.app/api/webhooks/heygen
```

**Submagic Webhook URL:**
```
https://your-app.railway.app/api/webhooks/submagic?workflow_id={workflow_id}
```

Update these in:
- HeyGen Dashboard: https://app.heygen.com/
- Submagic Dashboard: https://submagic.co/

---

## 🎯 Option 2: Hybrid (Vercel + Railway)

Keep your existing Vercel deployment for the frontend, deploy only the scheduler to Railway.

### Create Scheduler-Only Service

**File: `scheduler-service/index.js`:**
```javascript
const { startScheduler } = require('../src/lib/video-scheduler');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', scheduler: 'running' });
});

// Start scheduler on boot
startScheduler({
  maxVideosPerDay: { carz: 5, ownerfi: 5 },
  feedCheckInterval: 15,
  videoProcessInterval: 5,
  enabled: true
});

app.listen(PORT, () => {
  console.log(`Scheduler service running on port ${PORT}`);
});
```

Deploy this separately to Railway.

---

## 🎯 Option 3: Render.com

Similar to Railway but with a free tier:

1. Go to https://render.com/
2. New → Web Service
3. Connect GitHub repo
4. Build Command: `npm install && npm run build`
5. Start Command: `npm start`
6. Add all environment variables
7. Deploy

---

## ✅ Post-Deployment Checklist

### 1. Test Scheduler
```bash
curl https://your-app.railway.app/api/scheduler
```

Should return running status.

### 2. Test Video Generation
```bash
curl -X POST https://your-app.railway.app/api/workflow/viral-video-webhook \
  -H "Content-Type: application/json" \
  -d '{"article_content": "Test article", "auto_generate_script": true, ...}'
```

### 3. Verify Webhooks
- Check HeyGen dashboard for webhook delivery
- Check Submagic dashboard for webhook delivery

### 4. Monitor Logs
```bash
# Railway
railway logs

# Render
# View in dashboard
```

### 5. Verify Social Media Posts
- Check Metricool dashboard: https://app.metricool.com/
- Verify posts on all 6 platforms

---

## 🔧 Troubleshooting

### Scheduler Not Running
- Check environment variables
- Check logs for errors
- Restart the service

### Webhooks Not Received
- Verify webhook URLs are correct
- Check that app is publicly accessible
- Ensure no firewall blocking

### Videos Not Posting
- Check Metricool API credentials
- Verify platforms are connected in Metricool
- Check auto-post is enabled

### High Memory Usage
- Consider using Redis for workflow storage
- Set `USE_REDIS=true` and add Redis addon

---

## 📊 Monitoring

### Railway Dashboard
- View logs
- Monitor resource usage
- Check deployments

### Application Logs
All important events are logged:
- Feed fetches
- Article evaluations
- Video generations
- Social media posts

### Metrics to Track
- Videos generated per day
- Success rate
- Platform posting success
- Webhook delivery rate

---

## 💰 Cost Estimates

### Railway
- **Hobby Plan**: $5/month
- Includes: 512MB RAM, $5 usage credit

### Render
- **Free Tier**: $0 (limited)
- **Starter**: $7/month

### Total Monthly Cost
- **Railway/Render**: $5-7
- **APIs**:
  - OpenAI: ~$10-20 (depends on usage)
  - HeyGen: Per video pricing
  - Submagic: Per video pricing
  - Metricool: ~$12-20/month

**Total**: ~$30-50/month for complete automation

---

## 🚀 Ready to Deploy?

Choose your platform and follow the steps above. The system is ready to go!

**Need Help?**
- Railway Docs: https://docs.railway.app/
- Render Docs: https://render.com/docs
- This repo's issues: Create an issue for support
