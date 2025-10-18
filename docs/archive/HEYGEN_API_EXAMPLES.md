# HeyGen Video Generation API Examples

## Your New API Endpoint

### Base URL (Local)
```
http://localhost:3000/api/heygen/generate-video
```

### Base URL (Production)
```
https://yourdomain.com/api/heygen/generate-video
```

## 1. Simple Request (Your Original with Scale Added)

### POST `/api/heygen/generate-video`

```json
{
  "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
  "input_text": "Your text here",
  "voice_id": "9070a6c2dbd54c10bb111dc8c655bff7",
  "scale": 1.4,
  "width": 720,
  "height": 1280,
  "speed": 1.1,
  "caption": false
}
```

### Response:
```json
{
  "success": true,
  "video_id": "abc123...",
  "data": {
    "error": null,
    "data": {
      "video_id": "abc123..."
    }
  }
}
```

## 2. Full Featured Request

```json
{
  "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
  "input_text": "This is a fully featured video with all options enabled.",
  "voice_id": "9070a6c2dbd54c10bb111dc8c655bff7",
  "scale": 1.5,
  "width": 720,
  "height": 1280,
  "speed": 1.1,
  "caption": false,
  "talking_photo_style": "square",
  "talking_style": "expressive",
  "super_resolution": true,
  "offset": {
    "x": 0.0,
    "y": -0.1
  },
  "title": "My Awesome Video",
  "test": false,
  "callback_id": "my-callback-123"
}
```

## 3. Mobile Short-Form Content (Instagram/TikTok)

```json
{
  "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
  "input_text": "Hey! Check out this amazing product!",
  "voice_id": "9070a6c2dbd54c10bb111dc8c655bff7",
  "scale": 1.5,
  "width": 1080,
  "height": 1920,
  "speed": 1.15,
  "caption": false,
  "talking_style": "expressive"
}
```

## 4. Professional LinkedIn Video

```json
{
  "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
  "input_text": "We're excited to announce our new product launch.",
  "voice_id": "9070a6c2dbd54c10bb111dc8c655bff7",
  "scale": 1.2,
  "width": 1920,
  "height": 1080,
  "speed": 1.0,
  "caption": false,
  "talking_style": "stable",
  "super_resolution": true
}
```

## 5. YouTube Shorts

```json
{
  "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
  "input_text": "In this short, I'll show you 3 quick tips...",
  "voice_id": "9070a6c2dbd54c10bb111dc8c655bff7",
  "scale": 1.4,
  "width": 1080,
  "height": 1920,
  "speed": 1.1,
  "caption": true,
  "talking_style": "expressive"
}
```

## Check Video Status

### GET `/api/heygen/generate-video?video_id=YOUR_VIDEO_ID`

```bash
curl "http://localhost:3000/api/heygen/generate-video?video_id=abc123..."
```

### Response:
```json
{
  "success": true,
  "status": "completed",
  "video_url": "https://...",
  "data": {
    "code": 100,
    "data": {
      "video_id": "abc123...",
      "status": "completed",
      "video_url": "https://files2.heygen.ai/...",
      "duration": 5.2,
      "thumbnail_url": "https://...",
      "gif_url": "https://..."
    }
  }
}
```

## Parameters Reference

### Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `talking_photo_id` | string | HeyGen talking photo ID | "31c6b2b6..." |
| `input_text` | string | Text to be spoken | "Hello world" |
| `voice_id` | string | HeyGen voice ID | "9070a6c2..." |

### Optional Parameters (with defaults)

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `scale` | number | 1.4 | 0-2.0 | Zoom level (1.0=normal, 1.4=close-up) |
| `width` | number | 720 | - | Video width in pixels |
| `height` | number | 1280 | - | Video height in pixels |
| `speed` | number | 1.1 | 0.5-2.0 | Voice speed multiplier |
| `caption` | boolean | false | - | Show captions |
| `talking_photo_style` | string | "square" | square/circle | Frame style |
| `talking_style` | string | "expressive" | stable/expressive | Animation style |
| `super_resolution` | boolean | false | - | Enable high quality |
| `offset` | object | - | - | Position adjustment |
| `title` | string | "Generated Video" | - | Video title |
| `test` | boolean | false | - | Test mode |
| `callback_id` | string | - | - | Your callback ID |

### Offset Object (optional)

```json
"offset": {
  "x": 0.0,    // -1.0 to 1.0 (left to right)
  "y": -0.1    // -1.0 to 1.0 (up to down, negative = up)
}
```

## Using in Make.com

### HTTP Module Configuration

**URL**: `https://yourdomain.com/api/heygen/generate-video`
**Method**: POST
**Headers**:
```
Content-Type: application/json
```

**Body** (use Make.com variables):
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

## Testing Locally

### Using cURL

```bash
curl -X POST http://localhost:3000/api/heygen/generate-video \
  -H "Content-Type: application/json" \
  -d '{
    "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
    "input_text": "This is a test video",
    "voice_id": "9070a6c2dbd54c10bb111dc8c655bff7",
    "scale": 1.4,
    "width": 720,
    "height": 1280
  }'
```

### Using Node.js

```javascript
const response = await fetch('http://localhost:3000/api/heygen/generate-video', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    talking_photo_id: '31c6b2b6306b47a2ba3572a23be09dbc',
    input_text: 'This is a test video',
    voice_id: '9070a6c2dbd54c10bb111dc8c655bff7',
    scale: 1.4,
    width: 720,
    height: 1280
  })
});

const data = await response.json();
console.log('Video ID:', data.video_id);
```

## Common Dimension Presets

### Mobile (Portrait)
```json
{ "width": 1080, "height": 1920 }  // Instagram/TikTok/Shorts
{ "width": 720, "height": 1280 }   // Your current setup
```

### Desktop (Landscape)
```json
{ "width": 1920, "height": 1080 }  // Full HD
{ "width": 1280, "height": 720 }   // HD
```

### Square (Social)
```json
{ "width": 1080, "height": 1080 }  // Instagram square
```

## Error Responses

### Missing Required Fields
```json
{
  "error": "Missing required fields: talking_photo_id, input_text, voice_id"
}
```

### HeyGen API Error
```json
{
  "error": "Failed to generate video",
  "details": { ... }
}
```

### Video Not Found (GET request)
```json
{
  "error": "video_id parameter is required"
}
```

## Best Practices

1. **Scale Settings**:
   - Mobile content: 1.4 - 1.5
   - Desktop content: 1.2 - 1.3
   - Professional: 1.1 - 1.2

2. **Speed Settings**:
   - Casual content: 1.1 - 1.15
   - Professional: 1.0
   - Fast-paced: 1.2 - 1.3

3. **Always Check Status**:
   - Videos take 30-60 seconds to generate
   - Poll the GET endpoint every 5-10 seconds
   - Wait for status: "completed"

4. **Error Handling**:
   - Check for `success: true` in response
   - Handle API errors gracefully
   - Retry on timeout errors

## Status Values

| Status | Description |
|--------|-------------|
| `pending` | Video generation queued |
| `processing` | Currently generating |
| `completed` | Ready to download |
| `failed` | Generation failed |

## Complete Workflow

1. **Generate Video**: POST to `/api/heygen/generate-video`
2. **Get video_id** from response
3. **Poll Status**: GET `/api/heygen/generate-video?video_id=...`
4. **Wait** for `status: "completed"`
5. **Download** from `video_url` in response

---

**API Endpoint**: `/api/heygen/generate-video`
**Status**: ✅ Ready
**Default Scale**: 1.4 (close-up zoom)
**Tested**: 2025-10-11
