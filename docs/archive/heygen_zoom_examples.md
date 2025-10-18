# HeyGen Camera Zoom Function Guide

## Basic Zoom-In Effect

Add the `avatar_style` parameter to your character configuration:

```javascript
{
  "character": {
    "type": "talking_photo", // or "avatar"
    "talking_photo_id": "your_photo_id",
    "avatar_style": {
      "camera_zoom": {
        "start_zoom": 1.0,    // Starting zoom (1.0 = 100%)
        "end_zoom": 1.3,      // Ending zoom (1.3 = 130%)
        "zoom_speed": "slow"  // "slow", "medium", or "fast"
      }
    }
  }
}
```

## Zoom Options

### 1. **Zoom-In (Closer to face)**
```javascript
"camera_zoom": {
  "start_zoom": 1.0,   // Start at normal
  "end_zoom": 1.5,     // Zoom in to 150%
  "zoom_speed": "medium"
}
```

### 2. **Zoom-Out (Further from face)**
```javascript
"camera_zoom": {
  "start_zoom": 1.3,   // Start zoomed in
  "end_zoom": 1.0,     // Zoom out to normal
  "zoom_speed": "slow"
}
```

### 3. **Dramatic Zoom-In (Fast)**
```javascript
"camera_zoom": {
  "start_zoom": 1.0,
  "end_zoom": 2.0,     // 200% zoom
  "zoom_speed": "fast"
}
```

### 4. **Subtle Zoom (Professional)**
```javascript
"camera_zoom": {
  "start_zoom": 1.0,
  "end_zoom": 1.15,    // Subtle 15% zoom
  "zoom_speed": "slow"
}
```

### 5. **No Zoom (Static)**
```javascript
"camera_zoom": {
  "start_zoom": 1.0,
  "end_zoom": 1.0,     // Same value = no zoom
  "zoom_speed": "medium"
}
```

## Zoom Speed Options

- **"slow"**: Gradual, professional zoom (recommended for most content)
- **"medium"**: Moderate zoom speed (good for engaging content)
- **"fast"**: Quick zoom (dramatic effect, use sparingly)

## Zoom Range Guidelines

- **0.8 - 1.0**: Zoom out range (shows more of avatar)
- **1.0**: Default/Normal view (100%)
- **1.0 - 1.3**: Subtle zoom (professional, natural)
- **1.3 - 1.5**: Moderate zoom (engaging, dynamic)
- **1.5 - 2.0**: Strong zoom (dramatic, attention-grabbing)
- **2.0+**: Extreme zoom (may crop avatar, use carefully)

## Complete Example for Make.com / HTTP Module

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
        "input_text": "Your text here",
        "voice_id": "42d00d4aac5441279d8536cd6b52c53c",
        "speed": 1.1
      }
    }
  ],
  "dimension": {
    "width": 1080,
    "height": 1920
  },
  "title": "Video with Zoom Effect"
}
```

## Best Practices

1. **Mobile Content (1080x1920)**: Use subtle zoom (1.0 → 1.15) for better viewing
2. **Desktop Content (1920x1080)**: Can use stronger zoom (1.0 → 1.3)
3. **Speed**: Start with "slow" - it looks more professional
4. **Testing**: Try different values to see what works best for your content
5. **Consistency**: Use the same zoom settings across videos for brand consistency

## Common Use Cases

- **Introduction Videos**: Start at 1.0, zoom to 1.2 slowly
- **Call-to-Action**: Zoom from 1.0 to 1.4 medium speed for emphasis
- **Story Telling**: Keep static (1.0 → 1.0) or subtle zoom
- **Product Demos**: Zoom out (1.2 → 1.0) to show more context
- **Social Media**: Dynamic zoom (1.0 → 1.5 fast) for engagement
