# HeyGen Scale (Zoom) Setup - WORKING ✅

## ✅ Tested and Confirmed Working!

**Video Comparison:**
- Video without scale: `video_no_zoom.mp4` (1.0MB, default view)
- Video with scale=1.5: `video_with_scale_1_5.mp4` (3.1MB, zoomed in)

**Result**: The scale parameter WORKS! Avatar appears significantly larger/closer with scale=1.5.

## How to Use Scale in Your Make.com Workflow

### Step 1: Locate Your HTTP Module

In your Make.com scenario, find the HeyGen video generation HTTP module.

### Step 2: Add the `scale` Parameter

Add `"scale": 1.5` inside your `character` object:

```json
{
  "video_inputs": [
    {
      "character": {
        "type": "talking_photo",
        "talking_photo_id": "YOUR_PHOTO_ID",
        "scale": 1.5
      },
      "voice": {
        "type": "text",
        "input_text": "Your text here",
        "voice_id": "YOUR_VOICE_ID",
        "speed": 1.1
      }
    }
  ],
  "dimension": {
    "width": 1080,
    "height": 1920
  },
  "title": "Your Video Title"
}
```

## Recommended Scale Values

| Scale | Effect | Best For |
|-------|--------|----------|
| 0.8 | Zoomed out | Show more body, professional presentations |
| 1.0 | Default | Standard talking head (HeyGen default) |
| 1.2 | Slight zoom | Natural, engaging |
| 1.4 | Close-up | **Recommended for social media** |
| 1.5 | Strong close-up | Engaging, personal feel |
| 1.6 | Very close | Attention-grabbing |
| 1.8 | Maximum safe | Face-focused (may crop edges) |
| 2.0 | Extreme | Maximum for talking photos (use carefully) |

### 🎯 Recommended Starting Point

For most use cases, use **scale: 1.4** - it provides a nice close-up without cropping.

## Complete Make.com Example

### For Talking Photos:

```json
{
  "video_inputs": [
    {
      "character": {
        "type": "talking_photo",
        "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
        "scale": 1.4,
        "talking_photo_style": "square",
        "talking_style": "expressive",
        "super_resolution": true
      },
      "voice": {
        "type": "text",
        "input_text": "{{YOUR_TEXT_VARIABLE}}",
        "voice_id": "42d00d4aac5441279d8536cd6b52c53c",
        "speed": 1.1
      }
    }
  ],
  "dimension": {
    "width": 1080,
    "height": 1920
  },
  "title": "{{VIDEO_TITLE}}",
  "test": false,
  "callback_id": "{{CALLBACK_ID}}"
}
```

### For Avatars:

```json
{
  "video_inputs": [
    {
      "character": {
        "type": "avatar",
        "avatar_id": "YOUR_AVATAR_ID",
        "scale": 1.4,
        "avatar_style": "normal"
      },
      "voice": {
        "type": "text",
        "input_text": "{{YOUR_TEXT}}",
        "voice_id": "YOUR_VOICE_ID"
      }
    }
  ],
  "dimension": {
    "width": 1080,
    "height": 1920
  }
}
```

## Dynamic Scale with Make.com Variables

If you want to control the zoom level dynamically:

### Setup in Make.com:

1. Create a variable: `ZOOM_LEVEL` (e.g., 1.4)
2. Use it in your JSON:

```json
{
  "character": {
    "type": "talking_photo",
    "talking_photo_id": "{{PHOTO_ID}}",
    "scale": {{ZOOM_LEVEL}},
    "talking_photo_style": "square"
  }
}
```

**Note**: Don't put quotes around `{{ZOOM_LEVEL}}` - it should be a number, not a string.

## Scale by Content Type

### 📱 Instagram Reels / TikTok
```json
"scale": 1.5
```
Close-up, engaging, mobile-optimized

### 💼 LinkedIn / Professional
```json
"scale": 1.2
```
Balanced, professional, shows context

### 🎬 YouTube Shorts
```json
"scale": 1.4
```
Engaging without being too close

### 📧 Email Marketing Videos
```json
"scale": 1.3
```
Personal but professional

### 🎓 Educational Content
```json
"scale": 1.1
```
Clear view, not distracting

## Advanced: Combine Scale with Offset

You can combine `scale` with `offset` to position the zoomed avatar:

```json
{
  "character": {
    "type": "talking_photo",
    "talking_photo_id": "YOUR_PHOTO_ID",
    "scale": 1.5,
    "offset": {
      "x": 0.0,
      "y": -0.1
    }
  }
}
```

**offset.y = -0.1**: Shifts avatar up (useful for mobile - gives headroom)
**offset.x = 0.0**: Centers horizontally

## Troubleshooting

### Avatar Gets Cropped
**Solution**: Lower the scale value
- Try 1.3 or 1.4 instead of 1.5+

### Face Too Far Away
**Solution**: Increase scale value
- Try 1.4 or 1.5 instead of 1.0

### Different Zoom Per Scene
```json
{
  "video_inputs": [
    {
      "character": {
        "scale": 1.2
      },
      "voice": {
        "input_text": "First scene with subtle zoom"
      }
    },
    {
      "character": {
        "scale": 1.6
      },
      "voice": {
        "input_text": "Second scene with strong zoom for emphasis"
      }
    }
  ]
}
```

## Testing Instructions

### Quick Test Script

Use the provided test script:

```bash
node test_heygen_scale_zoom.js
```

This will generate a test video with scale=1.5 for you to review.

### Manual Test in Make.com

1. Copy the complete example above
2. Replace:
   - `YOUR_PHOTO_ID` with your talking photo ID
   - `{{YOUR_TEXT}}` with test text
   - `YOUR_VOICE_ID` with your voice ID
3. Set scale to `1.4`
4. Run the scenario
5. Check the generated video
6. Adjust scale value based on result

## Important Notes

✅ **Static Zoom**: The scale parameter creates a static zoom level. The avatar is zoomed in for the entire video (not animated zoom).

✅ **Range Limits**:
- Talking Photos: 0 to 2.0
- Avatars: 0 to 5.0

✅ **Safe Ranges**:
- Talking Photos (mobile): 1.2 - 1.6
- Avatars (mobile): 1.0 - 2.0

✅ **Best Practice**: Start with 1.4, adjust based on your content and platform.

## Summary

✅ Use `"scale": 1.4` for most social media content
✅ Place scale directly in the character object
✅ Tested and working (verified with actual video comparison)
✅ Works with both talking photos and avatars
✅ Can be different per scene in multi-scene videos
✅ Combine with other parameters like offset, talking_style, etc.

## Files

- **Test Script**: `test_heygen_scale_zoom.js`
- **Documentation**: `HEYGEN_SCALE_SETUP.md` (this file)
- **Detailed Guide**: `HEYGEN_ZOOM_CORRECT.md`
- **Test Videos**:
  - `video_no_zoom.mp4` (scale=default)
  - `video_with_scale_1_5.mp4` (scale=1.5)

## Next Steps

1. Update your Make.com HTTP module JSON
2. Add `"scale": 1.4` to your character object
3. Test with a sample video
4. Adjust scale value to your preference
5. Deploy to production

---

**Status**: ✅ Ready for Production
**Last Tested**: 2025-10-11
**Test Videos**: Confirmed working with visible zoom difference
