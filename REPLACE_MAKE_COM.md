# Replace Make.com - Automated Video Workflow

## 🎯 What This Does

This replaces your entire Make.com workflow with a single API endpoint that:

1. ✅ Reads RSS feeds (optional)
2. ✅ Generates video scripts with OpenAI (optional)
3. ✅ Creates HeyGen videos with scale/zoom
4. ✅ Waits for completion automatically
5. ✅ Returns the final video URL

**No Make.com needed!** Just one API call does everything.

## 🚀 New Endpoint

### POST `/api/workflow/auto-video`

## 📋 Setup

### 1. Environment Variables

Add to `.env` or `.env.local`:

```env
HEYGEN_API_KEY=your_heygen_key
OPENAI_API_KEY=your_openai_key  # Optional, for script generation
```

### 2. Install (if needed)

```bash
npm install
```

### 3. Start Server

```bash
npm run dev
```

## 🎬 Usage Examples

### Example 1: Simple Text to Video (No Make.com!)

```bash
curl -X POST http://localhost:3000/api/workflow/auto-video \
  -H "Content-Type: application/json" \
  -d '{
    "article_content": "Today we are announcing a major product update that will change how you work.",
    "auto_generate_script": true,
    "scale": 1.4
  }'
```

**Response:**
```json
{
  "success": true,
  "video_id": "abc123...",
  "video_url": "https://files2.heygen.ai/...",
  "script": "Hey! Exciting news - we have a major product update...",
  "message": "Video generated successfully"
}
```

### Example 2: RSS Feed to Video

```bash
curl -X POST http://localhost:3000/api/workflow/auto-video \
  -H "Content-Type": application/json" \
  -d '{
    "rss_url": "https://example.com/feed.xml",
    "auto_generate_script": true,
    "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
    "voice_id": "9070a6c2dbd54c10bb111dc8c655bff7",
    "scale": 1.4,
    "width": 720,
    "height": 1280
  }'
```

### Example 3: With JavaScript

```javascript
const response = await fetch('http://localhost:3000/api/workflow/auto-video', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    article_content: 'Your article content here',
    auto_generate_script: true,
    scale: 1.4,
    width: 720,
    height: 1280
  })
});

const result = await response.json();

if (result.success) {
  console.log('Video URL:', result.video_url);
  console.log('Script:', result.script);
}
```

### Example 4: Scheduled with Cron (No Make.com!)

Create `/scripts/generate-daily-video.js`:

```javascript
async function generateDailyVideo() {
  const response = await fetch('http://localhost:3000/api/workflow/auto-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rss_url: 'https://your-blog.com/feed.xml',
      auto_generate_script: true,
      scale: 1.4
    })
  });

  const result = await response.json();
  console.log('Daily video generated:', result.video_url);
}

generateDailyVideo();
```

Then schedule with cron:
```bash
# Run every day at 9 AM
0 9 * * * node /path/to/generate-daily-video.js
```

## 📝 Parameters

### Required

None! At minimum, provide either:
- `article_content` OR
- `rss_url`

### Optional

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `article_content` | string | - | Direct text content for video |
| `rss_url` | string | - | RSS feed URL to fetch content |
| `auto_generate_script` | boolean | true | Use OpenAI to generate script |
| `talking_photo_id` | string | "31c6b..." | HeyGen talking photo ID |
| `voice_id` | string | "9070a6..." | HeyGen voice ID |
| `scale` | number | 1.4 | Zoom level (1.0-2.0) |
| `width` | number | 720 | Video width |
| `height` | number | 1280 | Video height |

## ⚙️ How It Works (Behind the Scenes)

```
1. Content Input
   ↓
2. OpenAI Script Generation (if enabled)
   ↓
3. HeyGen Video Generation (with scale/zoom)
   ↓
4. Auto-wait for Completion (polls every 5 seconds)
   ↓
5. Return Video URL
```

**Total time**: ~60-90 seconds (fully automatic)

## 🔄 Comparison: Make.com vs This API

### Make.com Workflow (OLD)
```
1. RSS Reader Module
2. OpenAI Module #1
3. Set Variable Module
4. OpenAI Module #2
5. HTTP Module (HeyGen)
6. Sleep Module
7. HTTP Module (Status Check)
8. Router Module

= 8 modules, complex setup, monthly cost
```

### This API (NEW)
```
1. One API call

= 1 endpoint, simple, no extra cost
```

## 🎨 Use Cases

### 1. Daily Blog Post Videos

```javascript
// Automated: Run daily
POST /api/workflow/auto-video
{
  "rss_url": "https://blog.com/feed.xml",
  "auto_generate_script": true,
  "scale": 1.4
}
```

### 2. Product Announcements

```javascript
POST /api/workflow/auto-video
{
  "article_content": "We're launching our new feature...",
  "auto_generate_script": true,
  "scale": 1.5,
  "width": 1080,
  "height": 1920
}
```

### 3. Social Media Content

```javascript
// Instagram/TikTok format
POST /api/workflow/auto-video
{
  "article_content": "{{your_content}}",
  "scale": 1.5,
  "width": 1080,
  "height": 1920
}
```

### 4. Email Marketing Videos

```javascript
POST /api/workflow/auto-video
{
  "article_content": "{{email_content}}",
  "auto_generate_script": true,
  "scale": 1.3,
  "width": 720,
  "height": 1280
}
```

## ⚡ Advanced: Batch Processing

Generate multiple videos at once:

```javascript
const articles = [
  'Article 1 content...',
  'Article 2 content...',
  'Article 3 content...'
];

const videos = await Promise.all(
  articles.map(content =>
    fetch('http://localhost:3000/api/workflow/auto-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        article_content: content,
        auto_generate_script: true,
        scale: 1.4
      })
    }).then(r => r.json())
  )
);

console.log('Generated', videos.length, 'videos');
videos.forEach((v, i) => {
  console.log(`Video ${i + 1}:`, v.video_url);
});
```

## 🔧 Configuration Options

### Disable OpenAI (Use Original Text)

```json
{
  "article_content": "Your text",
  "auto_generate_script": false
}
```

### Custom Scale/Zoom Per Video

```json
{
  "article_content": "Professional announcement",
  "scale": 1.2
}
```

### Different Video Dimensions

```json
{
  "article_content": "LinkedIn post",
  "width": 1920,
  "height": 1080,
  "scale": 1.3
}
```

## 📊 Response Format

### Success (202 Accepted - Processing)
```json
{
  "success": false,
  "message": "Video generation timed out or failed",
  "video_id": "abc123...",
  "check_status_url": "/api/heygen/generate-video?video_id=abc123..."
}
```

### Success (200 OK - Completed)
```json
{
  "success": true,
  "video_id": "abc123...",
  "video_url": "https://files2.heygen.ai/...",
  "script": "Generated script text...",
  "message": "Video generated successfully"
}
```

### Error
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

## 🚨 Error Handling

```javascript
const response = await fetch('/api/workflow/auto-video', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ article_content: 'Test' })
});

const result = await response.json();

if (result.success) {
  console.log('✅ Video ready:', result.video_url);
} else if (result.video_id) {
  console.log('⏳ Still processing, check:', result.check_status_url);
} else {
  console.error('❌ Error:', result.error);
}
```

## ⏱️ Timing

- **API Call**: Instant
- **OpenAI Script**: ~2-5 seconds
- **HeyGen Generation**: ~30-60 seconds
- **Status Polling**: Every 5 seconds (max 20 attempts = 100 seconds)

**Total**: ~60-90 seconds for complete video

## 🎯 Migration from Make.com

### Before (Make.com)
1. Create scenario
2. Configure 8 modules
3. Connect APIs
4. Test workflow
5. Pay monthly fee

### After (This API)
1. Add environment variables
2. Make one API call

**Savings**:
- ✅ No Make.com subscription
- ✅ No complex workflow setup
- ✅ Faster execution
- ✅ Easier to modify
- ✅ Full control over code

## 📦 Files

- **API Route**: `/src/app/api/workflow/auto-video/route.ts`
- **Documentation**: `REPLACE_MAKE_COM.md` (this file)
- **Test Script**: `test_auto_workflow.js`

## 🧪 Testing

```bash
# Test the endpoint
node test_auto_workflow.js
```

## 🔐 Security

- API keys stored in environment variables
- No external services needed (except HeyGen + OpenAI)
- Runs on your own server
- Full control over data

## 📈 Scaling

### Option 1: Add to Queue (Recommended for Production)

Instead of waiting for completion, add to a job queue:

```javascript
// Return immediately
return { job_id: 'xyz', status: 'queued' };

// Process in background
// Check status later
```

### Option 2: Webhook Callback

Add webhook support for async processing:

```json
{
  "article_content": "...",
  "callback_url": "https://yoursite.com/webhook"
}
```

## 🎉 Summary

✅ **Replaces Make.com completely**
✅ **One API call does everything**
✅ **Automatic script generation (OpenAI)**
✅ **Automatic video generation (HeyGen)**
✅ **Auto-wait for completion**
✅ **Scale/zoom included (default 1.4)**
✅ **No monthly subscription needed**
✅ **Runs on your infrastructure**

---

**Endpoint**: `/api/workflow/auto-video`
**Status**: ✅ Ready to use
**Replaces**: Make.com 8-module workflow
**Time**: ~60-90 seconds per video
**Cost**: Only HeyGen + OpenAI API costs (no Make.com subscription)
