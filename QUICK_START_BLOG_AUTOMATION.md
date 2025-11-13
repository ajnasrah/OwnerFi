# Blog Automation - Quick Start

## System Ready ✅

Your **100% automated blog-to-social system** is complete and ready to deploy!

## What It Does

Every day at 6 AM CST:
1. ✅ **Generates educational blog** with AI (1200-1500 words)
2. ✅ **Posts to ALL platforms**: Instagram, Facebook, LinkedIn, Twitter, Threads
3. ✅ **Optimal times** for 25-40 demographic
4. ✅ **Zero manual work** after setup

## Deploy & Setup (5 Minutes)

### Step 1: Deploy to Production

```bash
git add .
git commit -m "Add automated blog system with AI generation and multi-platform posting"
git push
```

Vercel will auto-deploy with the new cron job.

### Step 2: Add Required Environment Variables

Make sure these are set in Vercel:

```bash
# Required for AI blog generation
OPENAI_API_KEY=sk-...

# Required for social posting (you already have these)
LATE_API_KEY=...
LATE_OWNERFI_PROFILE_ID=...
LATE_CARZ_PROFILE_ID=...
LATE_ABDULLAH_PROFILE_ID=...
LATE_VASSDISTRO_PROFILE_ID=...

# Required for cron authentication
CRON_SECRET=your_secret_here
```

### Step 3: Populate Blog Queues

After deploy, run these commands:

```bash
# OwnerFi (30 days of content)
curl -X POST https://ownerfi.ai/api/blog-queue/populate \
  -H "Content-Type: application/json" \
  -d '{"brand": "ownerfi", "count": 15, "daysApart": 2}'

# Carz Inc (30 days of content)
curl -X POST https://ownerfi.ai/api/blog-queue/populate \
  -H "Content-Type: application/json" \
  -d '{"brand": "carz", "count": 15, "daysApart": 2}'

# Abdullah (30 days of content)
curl -X POST https://ownerfi.ai/api/blog-queue/populate \
  -H "Content-Type: application/json" \
  -d '{"brand": "abdullah", "count": 15, "daysApart": 2}'

# Vass Distro (30 days of content)
curl -X POST https://ownerfi.ai/api/blog-queue/populate \
  -H "Content-Type: application/json" \
  -d '{"brand": "vassdistro", "count": 15, "daysApart": 2}'
```

### Step 4: Done!

Tomorrow at 6 AM CST, your first blog will be:
- Generated with AI
- Published to blog
- Scheduled to all 5 platforms
- Posted throughout the day at optimal times

## What Gets Posted (Tips & Knowledge Only)

### OwnerFi Topics
- "5 Common Mistakes First-Time Buyers Make With Owner Financing"
- "How Balloon Payments Actually Work in Seller Financing Deals"
- "What Credit Score Do You Really Need for Owner Financing?"
- "Understanding Down Payments: Why Sellers Ask for 10-20%"

### Carz Inc Topics
- "5 Red Flags When Buying a Used Car That Dealers Won't Tell You"
- "How Long Cars Actually Sit on Dealer Lots Before Price Drops"
- "What Happens at Auto Auctions: Behind the Scenes"
- "Why Wholesale Prices Are 20-30% Lower Than Retail"

### Abdullah Topics
- "5 Money Mistakes I Made in My First Year of Business"
- "How to Actually Build Credit From Scratch"
- "Why Most Side Hustles Fail in the First 90 Days"
- "The Real Cost of Being Your Own Boss Nobody Talks About"

### Vass Distro Topics
- "5 Inventory Management Mistakes New Vape Stores Make"
- "How to Price Products to Stay Competitive in Your Market"
- "Understanding Wholesale Margins in the Vape Industry"

**ALL EDUCATIONAL. NO PROMOTIONAL CONTENT.**

## Posting Schedule

Daily posting times (CST):
- **6:00 PM**: Facebook & LinkedIn
- **7:00 PM**: Twitter
- **9:00 PM**: Instagram & Threads

## Monitoring

### Check Queue Status
```bash
curl https://ownerfi.ai/api/blog-queue/stats
```

### View Generated Blogs
- OwnerFi: `https://ownerfi.ai/blog?brand=ownerfi`
- Carz Inc: `https://ownerfi.ai/blog?brand=carz`
- Abdullah: `https://ownerfi.ai/blog?brand=abdullah`

### Admin Dashboard
`https://ownerfi.ai/admin/blog`

## Cost

**~$3/month** for all 4 brands (60 blogs with AI generation)

## Files Created

✅ AI content generation
✅ Social media scheduling
✅ Queue management
✅ Daily cron job
✅ API routes
✅ Admin interface
✅ Blog pages

## Note: Route Adjustment Needed

The blog routes need a small adjustment to avoid conflict with your `[location]` dynamic route.

**Current structure:** `/[brand]/blog` conflicts with `/[location]`
**Fix:** Blog pages moved to `/blog?brand=ownerfi` format

This avoids the slug conflict and works immediately.

## Next Steps

1. **Deploy** (git push)
2. **Add env vars** (if not already set)
3. **Populate queues** (4 curl commands)
4. **Wait until tomorrow 6 AM CST**
5. **Watch the magic happen!**

Read `BLOG_AUTOMATION_GUIDE.md` for complete documentation.

---

**Questions or want to customize?** Let me know!
