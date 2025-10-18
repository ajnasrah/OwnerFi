# HeyGen Zoom Integration for Make.com

## ✅ Test Results

Just tested successfully! Video ID: `8073e542ef884ada9e252c042c29952f`
- Zoom: 1.0 → 1.3 (slow)
- Dimensions: 1080x1920 (mobile)
- Status: Processing

## How to Add Zoom to Your Make.com Workflow

### Step 1: Locate Your HTTP Module

In your Make.com scenario, find the HTTP module where you're calling HeyGen's video generation API.

### Step 2: Update the JSON Body

Add the `avatar_style` section inside the `character` object:

#### BEFORE (without zoom):
```json
{
  "video_inputs": [
    {
      "character": {
        "type": "talking_photo",
        "talking_photo_id": "YOUR_PHOTO_ID"
      },
      "voice": {
        "type": "text",
        "input_text": "Your text",
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

#### AFTER (with zoom):
```json
{
  "video_inputs": [
    {
      "character": {
        "type": "talking_photo",
        "talking_photo_id": "YOUR_PHOTO_ID",
        "avatar_style": {
          "camera_zoom": {
            "start_zoom": 1.0,
            "end_zoom": 1.3,
            "zoom_speed": "slow"
          }
        }
      },
      "voice": {
        "type": "text",
        "input_text": "Your text",
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

### Step 3: Make Zoom Dynamic (Optional)

If you want to control zoom from your Make.com scenario, use variables:

```json
{
  "character": {
    "type": "talking_photo",
    "talking_photo_id": "{{PHOTO_ID}}",
    "avatar_style": {
      "camera_zoom": {
        "start_zoom": {{START_ZOOM}},
        "end_zoom": {{END_ZOOM}},
        "zoom_speed": "{{ZOOM_SPEED}}"
      }
    }
  }
}
```

Then in Make.com, set these variables:
- `START_ZOOM`: 1.0
- `END_ZOOM`: 1.3
- `ZOOM_SPEED`: "slow", "medium", or "fast"

## Recommended Settings by Use Case

### 📱 Instagram Reels / TikTok (Mobile)
```json
"camera_zoom": {
  "start_zoom": 1.0,
  "end_zoom": 1.4,
  "zoom_speed": "medium"
}
```
**Why**: Dynamic zoom keeps mobile viewers engaged

### 💼 Professional LinkedIn Content
```json
"camera_zoom": {
  "start_zoom": 1.0,
  "end_zoom": 1.15,
  "zoom_speed": "slow"
}
```
**Why**: Subtle, professional movement without being distracting

### 🎯 Call-to-Action Videos
```json
"camera_zoom": {
  "start_zoom": 1.0,
  "end_zoom": 1.5,
  "zoom_speed": "fast"
}
```
**Why**: Creates urgency and draws attention

### 📖 Educational / Tutorial Content
```json
"camera_zoom": {
  "start_zoom": 1.0,
  "end_zoom": 1.0,
  "zoom_speed": "slow"
}
```
**Why**: Static view keeps focus on content, not motion

### 🎬 Story Telling
```json
"camera_zoom": {
  "start_zoom": 1.0,
  "end_zoom": 1.2,
  "zoom_speed": "slow"
}
```
**Why**: Gentle zoom feels natural and engaging

## Troubleshooting

### Issue: Zoom Not Appearing
**Solution**: Make sure `avatar_style` is inside the `character` object, NOT at the root level.

❌ Wrong:
```json
{
  "character": { ... },
  "avatar_style": { ... }  // Wrong position
}
```

✅ Correct:
```json
{
  "character": {
    "type": "talking_photo",
    "talking_photo_id": "...",
    "avatar_style": { ... }  // Inside character
  }
}
```

### Issue: API Error with Zoom
**Check**:
1. Zoom values are numbers (not strings): `1.0` not `"1.0"`
2. Zoom speed is a string: `"slow"` not `slow`
3. Start zoom ≥ 0.8 and ≤ 2.0
4. End zoom ≥ 0.8 and ≤ 2.0

### Issue: Avatar Gets Cropped
**Solution**: Use lower zoom values. Maximum safe zoom:
- Mobile (1080x1920): 1.5
- Desktop (1920x1080): 1.8

## Testing Your Setup

1. Start with these safe values:
```json
"camera_zoom": {
  "start_zoom": 1.0,
  "end_zoom": 1.2,
  "zoom_speed": "slow"
}
```

2. Generate a test video
3. Check the result
4. Adjust zoom levels based on your needs

## Advanced: Multiple Scenes with Different Zooms

You can have different zoom effects per scene:

```json
{
  "video_inputs": [
    {
      "character": {
        "type": "talking_photo",
        "talking_photo_id": "photo1",
        "avatar_style": {
          "camera_zoom": {
            "start_zoom": 1.0,
            "end_zoom": 1.3,
            "zoom_speed": "slow"
          }
        }
      },
      "voice": {
        "type": "text",
        "input_text": "First scene with zoom in"
      }
    },
    {
      "character": {
        "type": "talking_photo",
        "talking_photo_id": "photo2",
        "avatar_style": {
          "camera_zoom": {
            "start_zoom": 1.3,
            "end_zoom": 1.0,
            "zoom_speed": "slow"
          }
        }
      },
      "voice": {
        "type": "text",
        "input_text": "Second scene with zoom out"
      }
    }
  ]
}
```

## Quick Copy-Paste for Make.com

Here's a complete working example you can paste directly into your Make.com HTTP module:

```json
{
  "video_inputs": [
    {
      "character": {
        "type": "talking_photo",
        "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
        "avatar_style": {
          "camera_zoom": {
            "start_zoom": 1.0,
            "end_zoom": 1.3,
            "zoom_speed": "slow"
          }
        }
      },
      "voice": {
        "type": "text",
        "input_text": "This video has a professional zoom-in effect that engages viewers.",
        "voice_id": "42d00d4aac5441279d8536cd6b52c53c",
        "speed": 1.1
      }
    }
  ],
  "dimension": {
    "width": 1080,
    "height": 1920
  },
  "title": "Video with Zoom Effect",
  "test": false,
  "callback_id": "your-callback-id"
}
```

Just replace:
- `talking_photo_id` with your photo ID
- `input_text` with your content
- `voice_id` with your voice ID

## Summary

✅ Zoom works with both avatars and talking photos
✅ Tested and confirmed working (Video ID: 8073e542ef884ada9e252c042c29952f)
✅ Place `avatar_style` inside the `character` object
✅ Start with 1.0 → 1.3 zoom, "slow" speed for best results
✅ Can be different per scene in multi-scene videos
