# Metricool Multi-Brand Setup

## Overview

The system now supports **2 separate Metricool brands**:
- **Carz Inc** - For Carz automotive videos
- **Prosway** - For OwnerFi real estate videos

Each brand posts to its own set of 6 social media platforms via Metricool.

## Required Environment Variables

Add these 4 environment variables to Railway:

### Carz Inc (Carz Brand)
```bash
METRICOOL_CARZ_API_KEY=your_carz_api_key_here
METRICOOL_CARZ_USER_ID=your_carz_user_id_here
```

### Prosway (OwnerFi Brand)
```bash
METRICOOL_OWNERFI_API_KEY=your_prosway_api_key_here
METRICOOL_OWNERFI_USER_ID=your_prosway_user_id_here
```

## How to Get Your Metricool Credentials

1. Log into your Metricool account
2. Go to **Settings** → **API**
3. Generate API keys for each brand/workspace
4. Copy the **API Key** and **User ID** for each brand

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

### Error: "Metricool credentials not configured for Carz Inc"
- Missing `METRICOOL_CARZ_API_KEY` or `METRICOOL_CARZ_USER_ID`
- Add both variables to Railway and redeploy

### Error: "Metricool credentials not configured for Prosway (OwnerFi)"
- Missing `METRICOOL_OWNERFI_API_KEY` or `METRICOOL_OWNERFI_USER_ID`
- Add both variables to Railway and redeploy

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

✅ **2 separate Metricool brands** (Carz Inc + Prosway)
✅ **Automatic brand detection** from RSS feed category
✅ **4 new environment variables** required
✅ **6 platforms per brand** (Instagram, TikTok, YouTube, Facebook, LinkedIn, Threads)
✅ **10 videos per day** (5 Carz + 5 OwnerFi)
✅ **Scheduled posting** at optimal times
