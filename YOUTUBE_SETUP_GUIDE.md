# YouTube Direct API Setup Guide

This guide shows you how to set up direct YouTube API access for each brand to bypass Late.dev's quota limits.

## Why Direct YouTube API?

- **No quota limits from Late.dev** - Use your own YouTube quota
- **Better reliability** - Direct connection to YouTube
- **More control** - Set categories, privacy, Shorts designation
- **Cost-effective** - YouTube API is free (quota-based)

## Prerequisites

1. Google Cloud Console account
2. YouTube channel for each brand
3. OAuth 2.0 credentials

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "OwnerFi Social Media")
3. Enable the **YouTube Data API v3**:
   - Go to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Add authorized redirect URI: `https://developers.google.com/oauthplayground`
5. Save the **Client ID** and **Client Secret**

### 3. Get Refresh Token for Each Brand

For each brand's YouTube channel, follow these steps:

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in the top right
3. Check "Use your own OAuth credentials"
4. Enter your **Client ID** and **Client Secret**
5. In Step 1, select:
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/youtube.upload`
6. Click "Authorize APIs"
7. Sign in with the Google account that owns the YouTube channel
8. Grant permissions
9. Click "Exchange authorization code for tokens"
10. Copy the **Refresh Token** (starts with `1//`)

**Important**: Make sure you're signed in with the correct Google account for each brand's YouTube channel!

### 4. Add Environment Variables

Add these to your `.env.local` file for each brand:

```bash
# Abdullah Brand
YOUTUBE_ABDULLAH_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_ABDULLAH_CLIENT_SECRET=your-client-secret
YOUTUBE_ABDULLAH_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxx

# OwnerFi Brand
YOUTUBE_OWNERFI_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_OWNERFI_CLIENT_SECRET=your-client-secret
YOUTUBE_OWNERFI_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxx

# Carz Brand
YOUTUBE_CARZ_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_CARZ_CLIENT_SECRET=your-client-secret
YOUTUBE_CARZ_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxx

# Property Brand (if different channel)
YOUTUBE_PROPERTY_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_PROPERTY_CLIENT_SECRET=your-client-secret
YOUTUBE_PROPERTY_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxx

# Benefit Brand (if different channel)
YOUTUBE_BENEFIT_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_BENEFIT_CLIENT_SECRET=your-client-secret
YOUTUBE_BENEFIT_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxx

# VassDistro Brand
YOUTUBE_VASSDISTRO_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_VASSDISTRO_CLIENT_SECRET=your-client-secret
YOUTUBE_VASSDISTRO_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxx

# Podcast Brand
YOUTUBE_PODCAST_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_PODCAST_CLIENT_SECRET=your-client-secret
YOUTUBE_PODCAST_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxx
```

**Note**: If multiple brands use the same YouTube channel, you can reuse the same credentials.

### 5. Install Required Package

Install the Google APIs client library:

```bash
npm install googleapis
```

### 6. Update Your Posting Code

Replace your current Late.dev posting calls with the unified posting function:

**Before:**
```typescript
import { postToLate } from '@/lib/late-api';

const result = await postToLate({
  videoUrl,
  caption,
  title,
  platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'],
  brand: 'abdullah',
  useQueue: true,
});
```

**After:**
```typescript
import { postToAllPlatforms, getYouTubeCategoryForBrand } from '@/lib/unified-posting';

const result = await postToAllPlatforms({
  videoUrl,
  caption,
  title,
  platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin'],
  brand: 'abdullah',
  hashtags: ['#Abdullah', '#Mindset', '#Business'],
  useQueue: true,
  timezone: 'America/Chicago',
  youtubeCategory: getYouTubeCategoryForBrand('abdullah'),
  youtubePrivacy: 'public',
  youtubeMadeForKids: false,
});

// Check results
if (result.youtube?.success) {
  console.log('YouTube:', result.youtube.videoUrl);
}
if (result.otherPlatforms?.success) {
  console.log('Other platforms:', result.otherPlatforms.platforms);
}
```

## Testing

Test the YouTube upload for a single brand:

```bash
npx tsx scripts/test-youtube-upload.ts
```

## YouTube Quota Limits

- **Default quota**: 10,000 units/day
- **Video upload cost**: ~1,600 units per video
- **Daily limit**: ~6 videos/day per project

To increase quota:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "IAM & Admin" → "Quotas"
3. Search for "YouTube Data API v3"
4. Request quota increase (usually approved within 24 hours)

## Troubleshooting

### "Invalid credentials" error
- Verify Client ID and Client Secret are correct
- Make sure you're using the refresh token from the correct Google account
- Check that YouTube Data API v3 is enabled

### "Quota exceeded" error
- You've hit the daily 10,000 unit limit
- Wait until midnight Pacific Time for quota reset
- Or request quota increase in Google Cloud Console

### "Refresh token expired" error
- Refresh tokens don't expire unless revoked
- Re-generate the refresh token using OAuth Playground
- Update the environment variable

### Videos not appearing as Shorts
- Make sure video is less than 60 seconds
- Title should include #Shorts
- Video must be in vertical format (9:16 ratio)

## Cost Comparison

### Before (Late.dev only):
- All platforms through Late.dev
- YouTube quota shared across all brands
- Frequent YouTube upload failures

### After (Direct YouTube):
- YouTube: Direct API (your own quota)
- Other platforms: Late.dev
- No more YouTube quota issues

## Security Best Practices

1. **Never commit credentials to git**
   - Add `.env.local` to `.gitignore`
   - Use Vercel environment variables for production

2. **Rotate credentials periodically**
   - Generate new Client Secret every 6 months
   - Update refresh tokens if compromised

3. **Limit OAuth scopes**
   - Only request `youtube.upload` scope
   - Don't request unnecessary permissions

4. **Monitor API usage**
   - Check quota usage in Google Cloud Console
   - Set up alerts for high usage

## Production Deployment

Add the environment variables to Vercel:

```bash
# For each brand, add:
vercel env add YOUTUBE_ABDULLAH_CLIENT_ID
vercel env add YOUTUBE_ABDULLAH_CLIENT_SECRET
vercel env add YOUTUBE_ABDULLAH_REFRESH_TOKEN

# Repeat for other brands...
```

Or use the Vercel dashboard:
1. Go to your project settings
2. Click "Environment Variables"
3. Add each variable for Production, Preview, and Development

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify environment variables are set correctly
3. Test with OAuth Playground to ensure credentials work
4. Check Google Cloud Console for API quota usage
