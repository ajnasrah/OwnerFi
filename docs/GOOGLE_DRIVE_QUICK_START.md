# Google Drive Personal Video Upload - Quick Start

## TL;DR

Upload raw videos to Google Drive → Auto-processed with AI captions → Posted to Instagram/TikTok/YouTube → Original deleted

## 5-Minute Setup

### 1. Get Google Credentials

```bash
# Visit: https://console.cloud.google.com/
# 1. Create project
# 2. Enable Google Drive API
# 3. Create OAuth credentials (Desktop app)
# 4. Download JSON
```

### 2. Get Refresh Token

```bash
# Add client ID and secret to .env.local first:
npm run setup:google-drive
```

### 3. Create Drive Folder

```bash
# 1. Create folder in Google Drive
# 2. Copy folder ID from URL
# 3. Add to .env.local
```

### 4. Environment Variables

```bash
# .env.local
GOOGLE_DRIVE_CLIENT_ID="..."
GOOGLE_DRIVE_CLIENT_SECRET="..."
GOOGLE_DRIVE_REFRESH_TOKEN="..."
GOOGLE_DRIVE_FOLDER_ID="..."
LATE_PERSONAL_PROFILE_ID="..."
```

### 5. Deploy

```bash
# Add to vercel.json
{
  "crons": [
    {
      "path": "/api/cron/check-google-drive",
      "schedule": "*/5 * * * *"
    }
  ]
}

# Deploy
vercel --prod
```

## Usage

1. Upload `.mp4` or `.mov` to Google Drive folder
2. Wait 5 minutes
3. Video automatically processed with:
   - AI captions (Hormozi style)
   - Silence removal
   - Auto zooms
4. Posted to Instagram Reels, TikTok, YouTube Shorts
5. Original file deleted from Drive

## Video Specs

- **Format**: MP4, MOV, AVI
- **Duration**: 15-90 seconds
- **Orientation**: Vertical (9:16) recommended
- **Size**: Under 500MB

## Monitoring

- **Dashboard**: `/admin/social-dashboard`
- **Collection**: `personal_workflow_queue`
- **Status**: pending → submagic_processing → video_processing → posting → completed

## Features Applied by SubMagic

- ✅ AI Captions (Hormozi 2 template)
- ✅ Silence Removal (fast)
- ✅ Magic Zooms
- ✅ Remove bad takes
- ❌ B-rolls (disabled)

## Posting Platforms

- Instagram Reels + Stories
- TikTok
- YouTube Shorts

Scheduled at: 8am, 12pm, 4pm, 8pm ET

## Manual Trigger

```bash
curl -X POST https://ownerfi.ai/api/cron/check-google-drive \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## File Cleanup

Original files are automatically deleted from Google Drive after successful posting to all platforms.

## Cost per Video

- SubMagic: ~$0.10
- R2 Storage: ~$0.01/month
- Late.so: Flat rate ($20-50/month)

**Total**: ~$0.11 per video

## Troubleshooting

**Videos not detected?**
- Check folder ID is correct
- Verify cron job is running
- Check Vercel logs

**Authentication errors?**
- Re-run `npm run setup:google-drive`
- Verify credentials in .env.local

**Processing failures?**
- Check Firestore for error messages
- Review `/admin/social-dashboard`
- Check SubMagic credit balance

## Support

Full docs: `docs/GOOGLE_DRIVE_SETUP.md`
