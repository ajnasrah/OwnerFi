# R2 Storage Configuration Guide

## Current Setup

### Environment Variables (.env.local)
```bash
CLOUDFLARE_ACCOUNT_ID=e4ce3ce781d8f8d849ab151834eb6b2e
R2_ACCOUNT_ID=e4ce3ce781d8f8d849ab151834eb6b2e
R2_ACCESS_KEY_ID=c78fb3a9e66093ab06edf68cc5245c81
R2_SECRET_ACCESS_KEY=640ae9ced7103a84c9ab95d56f73e79cfa085ea99b9f937de70e4feb97ba6248
R2_BUCKET_NAME=ownerfi-podcast-videos
R2_PUBLIC_URL=https://pub-2476f0809ce64c369348d90eb220788e.r2.dev
```

### Verification Status

✅ **Public URL Working**: https://pub-2476f0809ce64c369348d90eb220788e.r2.dev
- Tested: 2025-10-16
- Status: 200 OK
- Sample URL: https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/viral-videos/submagic-1760454624699-jry0dj.mp4

## How Video URLs Are Generated

### Flow:
1. **Submagic Webhook** receives completed video
2. **downloadAndUploadToR2()** function:
   - Downloads video from Submagic
   - Uploads to R2 bucket: `ownerfi-podcast-videos`
   - Generates filename: `viral-videos/submagic-{timestamp}-{random}.mp4`
3. **Constructs Public URL**:
   ```typescript
   const publicUrl = process.env.R2_PUBLIC_URL
     ? `${process.env.R2_PUBLIC_URL}/${fileName}`
     : `https://pub-${accountId}.r2.dev/${fileName}`;
   ```
4. **Sends to Late API** for social media posting

### Files Involved:
- `src/lib/video-storage.ts:189-254` - `uploadSubmagicVideo()`
- `src/app/api/webhooks/submagic/route.ts:131` - Calls upload function
- `src/lib/late-api.ts:266` - Sends URL to Late API

## Troubleshooting 404 Errors

### If You See 404 Errors:

1. **Check R2 Bucket Public Access**:
   - Go to: https://dash.cloudflare.com/e4ce3ce781d8f8d849ab151834eb6b2e/r2
   - Click bucket: `ownerfi-podcast-videos`
   - Go to **Settings** → **Public Access**
   - Ensure "Allow Access" is enabled

2. **Verify Public Domain**:
   - In R2 bucket settings, check **Public URL** section
   - Should show: `pub-2476f0809ce64c369348d90eb220788e.r2.dev`
   - If not, click "Connect Domain" to set it up

3. **Test a Specific URL**:
   ```bash
   curl -I https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/viral-videos/FILENAME.mp4
   ```
   - Should return `200 OK`
   - If returns `404`, file wasn't uploaded or was deleted

4. **Check File Exists in R2**:
   - Go to R2 dashboard
   - Navigate to bucket
   - Look in `viral-videos/` folder
   - Verify file exists

5. **Late API Caching**:
   - Late API might cache 404 responses
   - Wait 5-10 minutes before retrying
   - Or use a new video URL

## Alternative: Use Custom Domain

For more reliability, you can connect a custom domain:

1. Go to R2 bucket → Settings → Custom Domains
2. Click "Connect Domain"
3. Enter domain: e.g., `cdn.ownerfi.ai`
4. Follow DNS setup instructions
5. Update `.env.local`:
   ```bash
   R2_PUBLIC_URL=https://cdn.ownerfi.ai
   ```

## Monitoring

### Check R2 URL Health:
```bash
node check-all-brand-failures.mjs
```

This script:
- Shows recent workflows for all brands
- Tests video URL accessibility
- Reports 200 OK or 404 errors

### Manual Test:
```bash
curl -I https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/viral-videos/submagic-1760454624699-jry0dj.mp4
```

Expected output:
```
HTTP/1.1 200 OK
Content-Type: video/mp4
...
```

## Auto-Deletion Policy

Videos are set to auto-delete after 7 days:
- Metadata includes: `auto-delete-after` timestamp
- Cron job should run weekly to clean up
- Keeps storage costs low

## Rate Limits

Cloudflare R2 Free Tier:
- 10 GB storage
- 10M Class A operations/month (uploads)
- 10M Class B operations/month (downloads)

## Contact Support

If persistent 404 errors occur:
1. Check Cloudflare status page: https://www.cloudflarestatus.com/
2. Review R2 dashboard for errors
3. Check webhook logs for upload failures
4. Contact Cloudflare support if R2 domain is down
