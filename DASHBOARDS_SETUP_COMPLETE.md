# Dashboards Setup Complete ✅

## Overview

Two new dedicated admin dashboards have been created and integrated into the admin panel:

### 1. 📈 Analytics Dashboard
**URL:** `/admin/analytics`

**Features:**
- Social media performance analytics from Late.dev
- Time slot analysis (best posting times)
- Content type comparison (viral, benefit, property, podcast, etc.)
- Hook performance tracking
- Platform breakdown (Facebook, Instagram, TikTok, YouTube, LinkedIn, Threads)
- Day of week analysis
- Top 10 performing posts
- Growth rate tracking
- Engagement metrics

**Data Source:**
- Syncs from Late.dev API
- Stored in `workflow_analytics` Firestore collection
- Automatically refreshes every 30 seconds

**Setup Required:**
1. Run data collection: `npx tsx scripts/collect-analytics-data.ts`
2. Or click "Sync Analytics Data" button in the UI
3. Data will populate once you have posts with analytics from Late.dev

---

### 2. 💰 Cost Dashboard
**URL:** `/admin/costs`

**Features:**
- Real-time API cost tracking
- Budget monitoring and alerts
- Daily and monthly spend tracking
- Service breakdown:
  - HeyGen: $0.50/credit (660 credits/month)
  - Submagic: $0.25/credit (600 credits/month)
  - OpenAI: Variable pricing
  - Late: $50/month flat
  - R2 Storage: $0.015/GB/month
- Brand-specific cost tracking
- Recent activity log (last 50 transactions)
- Budget alerts at 80% and 95% thresholds
- Projected monthly spend
- HeyGen quota tracking

**Data Source:**
- Automatically tracked via `trackCost()` function
- Stored in Firestore:
  - `cost_entries` - Individual transactions
  - `daily_costs` - Daily aggregates by brand
  - `monthly_costs` - Monthly aggregates by brand

**Budget Limits:**
- Daily limits enforced per service
- Monthly budget caps
- Configurable in `/src/lib/env-config.ts`

---

## Navigation

The dashboards are accessible from multiple locations:

### Sidebar Navigation
- Navigate to `/admin`
- Look for "Dashboards" section in the left sidebar
- Click "Analytics" or "Cost Tracking"

### Quick Actions (Overview Tab)
- Two prominent cards in the Overview tab:
  - **Analytics Dashboard** - Blue gradient card
  - **Cost Dashboard** - Green gradient card

### Direct URLs
- Analytics: `https://your-domain.com/admin/analytics`
- Costs: `https://your-domain.com/admin/costs`

---

## Files Created/Modified

### New Files:
1. `/src/app/admin/analytics/page.tsx` - Analytics dashboard page
2. `/src/app/admin/costs/page.tsx` - Cost dashboard page

### Existing Files (Already Built):
- `/src/components/AnalyticsDashboard.tsx` - Analytics UI component
- `/src/components/CostDashboard.tsx` - Cost tracking UI component
- `/src/lib/cost-tracker.ts` - Cost tracking logic
- `/src/lib/late-analytics.ts` - Analytics sync logic
- `/src/app/api/analytics/performance/route.ts` - Analytics API
- `/src/app/api/analytics/sync/route.ts` - Analytics sync API
- `/src/app/api/costs/dashboard/route.ts` - Cost data API

### Modified Files:
- `/src/app/admin/page.tsx` - Added dashboard links to sidebar and overview

---

## Usage

### Analytics Dashboard

1. **Initial Setup:**
   ```bash
   npx tsx scripts/collect-analytics-data.ts
   ```

2. **View Analytics:**
   - Navigate to `/admin/analytics`
   - Select brand filter (or view all)
   - Choose time period (7, 14, 30, or 90 days)
   - Explore tabs: Overview, Timing, Content, Platforms

3. **Refresh Data:**
   - Click "Sync Data" button
   - Or run the collection script periodically via cron

### Cost Dashboard

**Automatic Tracking:**
- Costs are automatically tracked when:
  - HeyGen videos are generated
  - Submagic processes captions
  - OpenAI API is called
  - R2 storage is used

**View Costs:**
- Navigate to `/admin/costs`
- Auto-refreshes every 30 seconds
- Manual refresh available via button

**Budget Alerts:**
- Warning at 80% of daily/monthly budget
- Critical alert at 95%
- Budget enforcement configurable in settings

---

## Next Steps

### Analytics
- ✅ System is ready to use
- ⏳ Waiting for posted content with analytics data
- 📊 Currently showing 0 views (all posts are scheduled/pending)
- 🔄 Run sync after posts are published to see data

### Costs
- ✅ Fully functional and tracking
- 📈 Already capturing cost data from API calls
- 💰 Budget limits are enforced
- 🔔 Alerts configured for Slack (if webhook is set)

---

## Configuration

**Environment Variables Required:**
```bash
# Analytics
LATE_API_KEY=your_late_api_key
LATE_CARZ_PROFILE_ID=...
LATE_OWNERFI_PROFILE_ID=...
LATE_PODCAST_PROFILE_ID=...
LATE_VASSDISTRO_PROFILE_ID=...
LATE_ABDULLAH_PROFILE_ID=...

# Cost Tracking (Optional)
SLACK_WEBHOOK=your_slack_webhook_url  # For budget alerts
```

**Budget Configuration:**
Edit `/src/lib/env-config.ts` to adjust:
- Daily budget limits
- Monthly budget caps
- Alert thresholds (80%, 95%)
- Cost per unit for each service

---

## Support

For issues or questions:
1. Check Firestore collections for data
2. Review console logs for errors
3. Verify environment variables are set
4. Run collection scripts manually to test

---

**Created:** October 29, 2025
**Status:** ✅ Complete and Ready to Use
