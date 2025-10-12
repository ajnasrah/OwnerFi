# Metricool Multi-Brand Setup

## Overview

The system now supports **2 separate Metricool brands**:
- **Carz Inc** - For Carz automotive videos
- **OwnerFi** - For OwnerFi real estate videos

Each brand posts to its own set of 6 social media platforms via Metricool.

## Required Environment Variables

Add these 4 environment variables to Railway:

### Single Metricool Account
```bash
METRICOOL_API_KEY=your_account_api_key
METRICOOL_USER_ID=your_account_user_id
```

### Brand IDs (for routing to correct brand)
```bash
METRICOOL_CARZ_BRAND_ID=your_carz_brand_id
METRICOOL_OWNERFI_BRAND_ID=your_ownerfi_brand_id
```

## How to Get Your Metricool Credentials

### Step 1: Get Account API Key and User ID
1. Log into your Metricool account
2. Go to **Settings** → **API**
3. Copy your **API Key** (METRICOOL_API_KEY)
4. Copy your **User ID** (METRICOOL_USER_ID)

### Step 2: Get Brand IDs
1. In Metricool, go to your **Brands** section
2. For **Carz Inc** brand:
   - Find the brand ID (usually in URL or brand settings)
   - Copy as METRICOOL_CARZ_BRAND_ID
3. For **OwnerFi** brand:
   - Find the brand ID
   - Copy as METRICOOL_OWNERFI_BRAND_ID

Note: Brand IDs are typically numeric or alphanumeric identifiers that Metricool uses to route posts to the correct brand's social media accounts.

## Supported Platforms (Both Brands)

Each brand posts to these 6 platforms:
- Instagram
- TikTok
- YouTube
- Facebook
- LinkedIn
- Threads

## How It Works

### Automatic Brand Detection

The system automatically routes videos to the correct Metricool brand:

```typescript
// Carz videos → Carz Inc Metricool account
brand: 'carz' → Uses METRICOOL_CARZ_API_KEY + METRICOOL_CARZ_USER_ID

// OwnerFi videos → Prosway Metricool account
brand: 'ownerfi' → Uses METRICOOL_OWNERFI_API_KEY + METRICOOL_OWNERFI_USER_ID
```

### Brand Assignment

Videos are automatically assigned to the correct brand based on:

1. **RSS Feed Category**:
   - 10 Carz feeds → `brand: 'carz'`
   - 12 OwnerFi feeds → `brand: 'ownerfi'`

2. **Manual API Calls**:
   ```bash
   # Carz video
   POST /api/workflow/complete-viral
   {
     "brand": "carz",
     "platforms": ["instagram", "tiktok", "youtube", "facebook", "linkedin", "threads"]
   }

   # OwnerFi video
   POST /api/workflow/complete-viral
   {
     "brand": "ownerfi",
     "platforms": ["instagram", "tiktok", "youtube", "facebook", "linkedin", "threads"]
   }
   ```

## Posting Schedule

Both brands use the same optimal posting times:
- 9:00 AM
- 11:00 AM
- 2:00 PM
- 6:00 PM
- 8:00 PM

Or use `schedule: "optimal"` to post at 7:00 PM.

## Daily Limits

- **Carz**: 5 videos per day (max)
- **OwnerFi**: 5 videos per day (max)
- **Total**: 10 videos per day across both brands

## Testing

Test each brand separately:

### Test Carz Inc Posting
```bash
curl -X POST https://your-railway-url/api/workflow/complete-viral \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "carz",
    "platforms": ["instagram"],
    "schedule": "immediate"
  }'
```

### Test Prosway Posting
```bash
curl -X POST https://your-railway-url/api/workflow/complete-viral \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "ownerfi",
    "platforms": ["instagram"],
    "schedule": "immediate"
  }'
```

## Verification

After adding the environment variables, verify they're working:

1. Check Railway logs for: `📤 Posting to Metricool (Carz Inc)...` or `📤 Posting to Metricool (Prosway)...`
2. Check Metricool dashboard for scheduled posts
3. Verify posts appear in the correct brand's queue

## Troubleshooting

### Error: "Metricool API credentials not configured"
- Missing `METRICOOL_API_KEY` or `METRICOOL_USER_ID`
- Add both variables to Railway and redeploy

### Error: "Brand ID not configured for Carz Inc"
- Missing `METRICOOL_CARZ_BRAND_ID`
- Add the brand ID variable to Railway and redeploy

### Error: "Brand ID not configured for OwnerFi"
- Missing `METRICOOL_OWNERFI_BRAND_ID`
- Add the brand ID variable to Railway and redeploy

### Videos posting to wrong brand
- Check the `brand` field in the API request
- For scheduler: brand is auto-detected from feed category
- For manual calls: explicitly specify `"brand": "carz"` or `"brand": "ownerfi"`

## Files Modified

- `src/lib/metricool-api.ts` - Multi-brand credential management
- `src/lib/workflow-store.ts` - Added brand field to workflows
- `src/app/api/workflow/complete-viral/route.ts` - Pass brand to Metricool
- `src/app/api/workflow/viral-video-webhook/route.ts` - Store brand in workflow
- `src/app/api/webhooks/submagic/route.ts` - Pass brand when auto-posting
- `src/lib/video-scheduler.ts` - Pass brand from feed category

## Summary

✅ **2 separate Metricool brands** (Carz Inc + OwnerFi)
✅ **Single Metricool account** with brand-based routing
✅ **Automatic brand detection** from RSS feed category
✅ **4 new environment variables** required
✅ **6 platforms per brand** (Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads)
✅ **10 videos per day** (5 Carz + 5 OwnerFi)
✅ **Scheduled posting** at optimal times

## Environment Variables Summary

```bash
# Account-level (shared)
METRICOOL_API_KEY=your_api_key
METRICOOL_USER_ID=your_user_id

# Brand-specific routing
METRICOOL_CARZ_BRAND_ID=carz_brand_id
METRICOOL_OWNERFI_BRAND_ID=ownerfi_brand_id
```
