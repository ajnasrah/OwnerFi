# HeyGen Scale (Zoom) - Quick Reference Card

## ⚡ Your New Request Format

```json
{
  "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
  "input_text": "{{5.result}}",
  "voice_id": "9070a6c2dbd54c10bb111dc8c655bff7",
  "scale": 1.4,
  "width": 720,
  "height": 1280,
  "speed": 1.1,
  "caption": false
}
```

## 📍 API Endpoint

**Local**: `http://localhost:3000/api/heygen/generate-video`
**Production**: `https://yourdomain.com/api/heygen/generate-video`

## 🎚️ Scale Values

| Value | Effect |
|-------|--------|
| 1.0 | No zoom (default) |
| 1.2 | Subtle zoom |
| 1.4 | **Recommended** |
| 1.5 | Close-up |
| 1.8 | Very close |

## 📱 Common Dimensions

| Platform | Width x Height |
|----------|----------------|
| Your setup | 720 x 1280 |
| Instagram/TikTok | 1080 x 1920 |
| YouTube | 1920 x 1080 |

## ✅ What's Working

- ✅ Scale/zoom function (tested)
- ✅ API endpoint created
- ✅ Simplified request format
- ✅ Status checking included

## 🚀 Quick Test

```bash
node test_local_api.js
```

## 📚 Full Documentation

- `SETUP_COMPLETE.md` - Overview
- `HEYGEN_API_EXAMPLES.md` - All examples
- `HEYGEN_SCALE_SETUP.md` - Detailed guide
