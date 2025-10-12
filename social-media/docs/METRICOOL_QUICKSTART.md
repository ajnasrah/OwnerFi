# 🚀 Metricool Auto-Posting - Quick Start

## What This Does

Automatically posts your AI-generated viral videos to Instagram, TikTok, YouTube Shorts, and Facebook with the ChatGPT-generated title, caption, and hashtags.

## Complete Flow

```
1. RSS Feed → Article
   ↓
2. ChatGPT Generates:
   • Viral Script (45-60 seconds)
   • Caption with emojis (<150 chars)
   • YouTube Title (SEO-optimized)
   • Hashtags
   ↓
3. HeyGen Creates Video
   • Talking avatar with script
   • Vertical format (1080x1920)
   ↓
4. Submagic Adds Effects
   • Auto-captions
   • Viral templates
   ↓
5. 📱 AUTO-POSTS TO METRICOOL
   • Instagram Reels
   • TikTok
   • YouTube Shorts
   • Facebook Reels
   ↓
6. Videos Go Live! 🎉
```

---

## Setup (5 Minutes)

### 1. Add to `.env.local`:

```bash
# Metricool Credentials
METRICOOL_API_KEY=your_api_key_here
METRICOOL_USER_ID=your_user_id_here

# Enable Auto-Posting
METRICOOL_AUTO_POST=true

# Choose Platforms (comma-separated)
METRICOOL_PLATFORMS=instagram,tiktok,youtube

# Schedule (optional)
METRICOOL_SCHEDULE_DELAY=immediate
```

### 2. Get Metricool API Key:

1. Go to https://metricool.com/
2. Sign up / Log in
3. Connect your social media accounts
4. Contact support or check Settings > API to get:
   - API Key
   - User ID

### 3. Test It:

```bash
# Start server
npm run dev

# Generate a video
node social-media/tests/test_viral_video_webhook.js
```

---

## What Gets Posted

### Example Output:

**Video URL:** `https://submagic.co/...final-video.mp4`

**Caption:**
```
New Tesla at $25K?! This is a game changer! 🤯⚡
```

**Hashtags:**
```
#Tesla #ElectricCar #EV #CarNews #TeslaModel2
```

**Title (YouTube):**
```
Tesla's $25K Car Changes EVERYTHING! 🚗⚡
```

**Platforms:** Instagram, TikTok, YouTube

---

## Configuration Options

### Post Immediately:
```bash
METRICOOL_SCHEDULE_DELAY=immediate
```

### Delay 1 Hour:
```bash
METRICOOL_SCHEDULE_DELAY=1hour
```

### Post at Optimal Time (7 PM):
```bash
METRICOOL_SCHEDULE_DELAY=optimal
```

### Choose Specific Platforms:
```bash
# Instagram + TikTok only
METRICOOL_PLATFORMS=instagram,tiktok

# All platforms
METRICOOL_PLATFORMS=instagram,tiktok,youtube,facebook

# YouTube Shorts only
METRICOOL_PLATFORMS=youtube
```

---

## Expected Logs

When video is complete, you'll see:

```
🔔 Submagic webhook received
✅ Submagic video completed: https://...
🎉 WORKFLOW COMPLETE!

📱 Auto-posting to social media via Metricool...
📤 Posting to Metricool...
   Platforms: instagram, tiktok, youtube
   Caption: New Tesla at $25K?! This is a game changer...
✅ Posted to Metricool!
   Post ID: post_12345
   Platforms: instagram, tiktok, youtube
```

---

## Files Added/Modified

### New Files:
- `src/lib/metricool-api.ts` - Metricool API integration
- `social-media/docs/METRICOOL_SETUP.md` - Complete documentation
- `social-media/docs/METRICOOL_QUICKSTART.md` - This file

### Modified Files:
- `src/app/api/webhooks/submagic/route.ts` - Added auto-posting after video complete
- `src/lib/workflow-store.ts` - Added title, caption, hashtags fields
- `src/app/api/workflow/viral-video-webhook/route.ts` - Stores title & caption

---

## Troubleshooting

### "Metricool API credentials not configured"

**Fix:**
```bash
# Add to .env.local
METRICOOL_API_KEY=your_key_here
METRICOOL_USER_ID=your_id_here

# Restart server
npm run dev
```

### Auto-posting not working

**Check:**
1. `METRICOOL_AUTO_POST=true` in `.env.local`
2. API credentials are correct
3. Social accounts connected in Metricool
4. Server logs for errors

### Video not appearing on social media

**Possible reasons:**
1. Video is scheduled (not posted immediately)
2. Metricool is processing
3. Platform API delay
4. Video format/size issue

**Check Metricool Dashboard:**
https://app.metricool.com/ → Publisher → Scheduled Posts

---

## Disable Auto-Posting

```bash
# In .env.local
METRICOOL_AUTO_POST=false
```

---

## What You Need

✅ Metricool account (Free or Premium)
✅ Social media accounts connected to Metricool
✅ Metricool API access
✅ API Key and User ID from Metricool

---

## Next Steps

1. Get Metricool API credentials
2. Add to `.env.local`
3. Test with `node social-media/tests/test_viral_video_webhook.js`
4. Check Metricool dashboard for scheduled post
5. Verify video appears on social media

**That's it!** Your viral videos will now auto-post to all platforms with the perfect caption and hashtags. 🚀

---

## Platform-Specific Notes

### Instagram Reels
- Max 90 seconds
- Vertical (1080x1920)
- Max 30 hashtags

### TikTok
- Max 60 seconds
- Caption max 150 chars
- 3-5 hashtags recommended

### YouTube Shorts
- Max 60 seconds
- Title max 100 chars
- Full description supported

### Facebook Reels
- 3-90 seconds
- Vertical format
- Similar to Instagram

---

**Questions?** Check `social-media/docs/METRICOOL_SETUP.md` for full documentation!
