# HeyGen Zoom Function - CORRECT METHOD ✅

## ⚠️ Important: Use `scale` Parameter, NOT `camera_zoom`

The HeyGen API does NOT have a `camera_zoom` parameter. Instead, use the **`scale`** parameter to zoom in/out.

## How It Works

The `scale` parameter controls the size of the avatar in the frame:
- **scale < 1.0**: Zoomed out (avatar appears smaller)
- **scale = 1.0**: Normal/default (100%)
- **scale > 1.0**: Zoomed in (avatar appears larger/closer)

## Talking Photos (type: "talking_photo")
- **Range**: 0 to 2.0
- **Default**: 1.0

## Avatars (type: "avatar")
- **Range**: 0 to 5.0
- **Default**: 1.0

## Working Example

```json
{
  "video_inputs": [
    {
      "character": {
        "type": "talking_photo",
        "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
        "scale": 1.5,
        "talking_photo_style": "square"
      },
      "voice": {
        "type": "text",
        "input_text": "Your text here",
        "voice_id": "42d00d4aac5441279d8536cd6b52c53c",
        "speed": 1.1
      }
    }
  ],
  "dimension": {
    "width": 1080,
    "height": 1920
  }
}
```

## Zoom Levels by Use Case

### 📱 Instagram Reels / TikTok (Mobile)
```json
"scale": 1.4
```
**Effect**: Close-up, engaging view

### 💼 Professional Content
```json
"scale": 1.2
```
**Effect**: Subtle zoom, professional framing

### 🎯 Extreme Close-Up (Face only)
```json
"scale": 1.8
```
**Effect**: Very close, attention-grabbing

### 📖 Full View (More body visible)
```json
"scale": 0.8
```
**Effect**: Zoomed out, shows more of avatar

### 🎬 Default / Balanced
```json
"scale": 1.0
```
**Effect**: Standard framing (default)

## ⚠️ Important Notes

### For Talking Photos
- **Maximum scale**: 2.0
- **Recommended range**: 1.0 - 1.6
- **Safe for most content**: 1.2 - 1.4

### For Avatars
- **Maximum scale**: 5.0
- **Recommended range**: 1.0 - 2.5
- **Safe for most content**: 1.0 - 1.8

### Cropping Warning
If scale is too high, the avatar may get cropped:
- **Mobile (1080x1920)**: Don't exceed 1.8 for talking photos
- **Desktop (1920x1080)**: Don't exceed 1.6 for talking photos

## Make.com Integration

### BEFORE (no zoom):
```json
{
  "character": {
    "type": "talking_photo",
    "talking_photo_id": "YOUR_PHOTO_ID"
  }
}
```

### AFTER (with zoom):
```json
{
  "character": {
    "type": "talking_photo",
    "talking_photo_id": "YOUR_PHOTO_ID",
    "scale": 1.4
  }
}
```

## Dynamic Scale with Make.com Variables

```json
{
  "character": {
    "type": "talking_photo",
    "talking_photo_id": "{{PHOTO_ID}}",
    "scale": {{ZOOM_LEVEL}}
  }
}
```

Then set variable:
- `ZOOM_LEVEL`: 1.4 (or any value 0-2.0)

## Combining Scale with Other Parameters

### Full Example with All Options

```json
{
  "character": {
    "type": "talking_photo",
    "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
    "scale": 1.4,
    "offset": {
      "x": 0.0,
      "y": -0.1
    },
    "talking_photo_style": "square",
    "talking_style": "expressive",
    "super_resolution": true
  }
}
```

**Parameters explained:**
- `scale: 1.4` - Zooms in 40%
- `offset.y: -0.1` - Shifts avatar up slightly (good for mobile)
- `talking_photo_style: "square"` - Frame style
- `talking_style: "expressive"` - More animated expressions
- `super_resolution: true` - Higher quality output

## Scale vs Avatar Style

You can also use `avatar_style` (for avatars) or `talking_photo_style` for different framing:

### For Avatars:
```json
{
  "type": "avatar",
  "avatar_id": "your_avatar_id",
  "avatar_style": "closeUp",  // Options: "normal", "closeUp", "circle"
  "scale": 1.2
}
```

### For Talking Photos:
```json
{
  "type": "talking_photo",
  "talking_photo_id": "your_photo_id",
  "talking_photo_style": "circle",  // Options: "square", "circle"
  "scale": 1.4
}
```

## Testing Different Scales

Quick test values to try:

| Scale | Effect | Use Case |
|-------|--------|----------|
| 0.7 | Wide shot | Group context, more background |
| 0.8 | Medium wide | Professional presentation |
| 1.0 | Default | Standard talking head |
| 1.2 | Slight zoom | Engaging, natural |
| 1.4 | Close-up | Social media, mobile |
| 1.6 | Tight close-up | Emphasis, dramatic |
| 1.8 | Very tight | Face focus (may crop) |
| 2.0 | Maximum | Extreme close-up (use carefully) |

## Common Mistakes

### ❌ Wrong:
```json
{
  "character": {
    "type": "talking_photo",
    "talking_photo_id": "...",
    "camera_zoom": {  // This doesn't exist!
      "start_zoom": 1.0,
      "end_zoom": 1.3
    }
  }
}
```

### ✅ Correct:
```json
{
  "character": {
    "type": "talking_photo",
    "talking_photo_id": "...",
    "scale": 1.3  // Use scale parameter
  }
}
```

## Limitation: Static Zoom Only

**Important**: The `scale` parameter creates a **static zoom level** for the entire video. It does NOT animate or gradually zoom in during the video.

If you need animated zoom (gradual zoom-in during playback), you would need to:
1. Generate the video with HeyGen at a specific scale
2. Apply zoom animation in post-processing (using video editing software or tools like FFmpeg)

## Complete Working Example for Make.com

```json
{
  "video_inputs": [
    {
      "character": {
        "type": "talking_photo",
        "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
        "scale": 1.4,
        "talking_photo_style": "square",
        "talking_style": "expressive"
      },
      "voice": {
        "type": "text",
        "input_text": "This video is zoomed in using the scale parameter set to 1.4, creating a close-up engaging view perfect for mobile content.",
        "voice_id": "42d00d4aac5441279d8536cd6b52c53c",
        "speed": 1.1
      }
    }
  ],
  "dimension": {
    "width": 1080,
    "height": 1920
  },
  "title": "Video with Zoom (Scale 1.4)",
  "test": false
}
```

## Testing the Scale

✅ **Test video generated**: `95a3d97d5df5472ea7bf7302eada0d74`
- Scale: 1.5 (150% zoom)
- Dimensions: 1080x1920
- Status: Processing

Run the test yourself:
```bash
node test_heygen_scale_zoom.js
```

## Summary

✅ Use `scale` parameter (not `camera_zoom`)
✅ Range: 0-2.0 for talking photos, 0-5.0 for avatars
✅ Recommended: 1.2-1.4 for most use cases
✅ Place scale directly in character object
✅ Static zoom (not animated)
✅ Test before production use

## Need Animated Zoom?

If you need the camera to gradually zoom in during the video (not just a static close-up), HeyGen doesn't support this natively. You would need to:

1. Generate video with HeyGen at desired scale
2. Use post-processing tools like:
   - FFmpeg with zoompan filter
   - Video editing software (After Effects, Premiere, etc.)
   - Cloudinary or similar video transformation APIs
