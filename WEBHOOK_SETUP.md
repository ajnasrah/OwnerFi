# Webhook-Based Viral Video Workflow Setup

This document explains how to set up the webhook-based viral video workflow, which is **much more efficient** than the polling-based approach.

## Why Webhooks?

### Old Way (Polling):
- Makes 10+ API calls to HeyGen every 30 seconds
- Makes 10+ API calls to Submagic every 30 seconds
- Wastes API quota and resources
- Can timeout or miss completions

### New Way (Webhooks):
- ✅ **Zero polling** - Services notify you when done
- ✅ **Instant response** - Get workflow ID immediately
- ✅ **More reliable** - Notified the moment video is ready
- ✅ **Efficient** - Only 2 webhook calls total

## How It Works

```
1. You submit request → Get workflow_id instantly ⚡
                             ↓
2. HeyGen generates video → Sends webhook 🔔
                             ↓
3. System auto-sends to Submagic
                             ↓
4. Submagic adds effects → Sends webhook 🔔
                             ↓
5. Video is ready! Check status endpoint 🎉
```

## Setup Instructions

### Step 1: Configure Environment Variables

Add to `.env.local`:

```bash
# Required
HEYGEN_API_KEY=your-heygen-api-key
SUBMAGIC_API_KEY=your-submagic-api-key
OPENAI_API_KEY=your-openai-api-key

# For webhooks (required in production)
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# Webhook security (optional but recommended)
WEBHOOK_SECRET=your-random-secret-key-here
```

### Step 2: Make Your Webhooks Publicly Accessible

HeyGen and Submagic need to reach your webhook endpoints. You have 3 options:

#### Option A: Use ngrok (for local development)

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start ngrok tunnel
ngrok http 3000

# You'll get a URL like: https://abc123.ngrok.io
# Add to .env.local:
NEXT_PUBLIC_BASE_URL=https://abc123.ngrok.io
```

#### Option B: Deploy to Production

Deploy your app to Vercel, Railway, or any hosting platform:

```bash
# .env.local
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
```

#### Option C: Use Other Tunnel Services

- [localtunnel](https://localtunnel.github.io/www/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [serveo](https://serveo.net/)

### Step 3: Start Your Dev Server

```bash
npm run dev
```

Your server must be running for webhooks to work!

### Step 4: Register HeyGen Webhook

Run the setup script:

```bash
node scripts/setup-webhooks.js
```

This will:
- ✅ Register your webhook URL with HeyGen
- ✅ Configure events: `avatar_video.success`, `avatar_video.fail`
- ✅ Return an `endpoint_id` (save this!)

**Note:** Submagic webhooks don't need registration - they work automatically when you provide `webhookUrl` in the request.

### Step 5: Test the Workflow

```bash
node test_viral_video_webhook.js
```

This will:
1. Submit a viral video request
2. Get a `workflow_id` immediately
3. Monitor status every 30 seconds
4. Show final results when complete

## API Endpoints

### Start Workflow

```bash
POST /api/workflow/viral-video-webhook
```

**Request:**
```json
{
  "rss_url": "https://www.motor1.com/rss/reviews/all/",
  "auto_generate_script": true,
  "talking_photo_id": "31c6b2b6306b47a2ba3572a23be09dbc",
  "voice_id": "9070a6c2dbd54c10bb111dc8c655bff7",
  "scale": 1.4,
  "width": 1080,
  "height": 1920,
  "submagic_template": "Hormozi 2",
  "language": "en"
}
```

**Response (Immediate):**
```json
{
  "success": true,
  "message": "Video generation started",
  "workflow_id": "abc-123-def",
  "heygen_video_id": "vid_456",
  "status_url": "http://localhost:3000/api/workflow/viral-video-webhook/status?id=abc-123-def",
  "script": "Your generated script..."
}
```

### Check Status

```bash
GET /api/workflow/viral-video-webhook/status?id=WORKFLOW_ID
```

**Response:**
```json
{
  "workflow_id": "abc-123-def",
  "status": "complete",
  "message": "Video is ready! Download from final_video_url",
  "script": "Your script...",
  "heygen_video_id": "vid_456",
  "heygen_video_url": "https://...",
  "submagic_project_id": "proj_789",
  "final_video_url": "https://...",
  "submagic_editor_url": "https://app.submagic.co/projects/proj_789"
}
```

### Workflow Statuses

- `heygen_pending` - HeyGen is generating the video
- `heygen_complete` - HeyGen done, sending to Submagic
- `submagic_pending` - Submagic is adding effects
- `complete` - ✅ Video is ready!
- `failed` - ❌ Something went wrong

## Webhook Endpoints (For Reference)

### HeyGen Webhook
```
POST /api/webhooks/heygen
```

Receives:
```json
{
  "event_type": "avatar_video.success",
  "event_data": {
    "video_id": "vid_456",
    "url": "https://...",
    "callback_id": "abc-123-def"
  }
}
```

### Submagic Webhook
```
POST /api/webhooks/submagic
```

Receives:
```json
{
  "id": "proj_789",
  "status": "completed",
  "video_url": "https://..."
}
```

## Troubleshooting

### Webhook not receiving calls

1. **Check server is running:**
   ```bash
   lsof -ti:3000  # Should show a process ID
   ```

2. **Check ngrok/tunnel is active:**
   ```bash
   curl https://your-ngrok-url.ngrok.io/api/webhooks/heygen
   ```

3. **Check HeyGen webhook registration:**
   ```bash
   node scripts/setup-webhooks.js list
   ```

4. **Check logs:**
   Look for `🔔 HeyGen webhook received` in your server logs

### OPTIONS request failing

Make sure your webhook endpoint responds to OPTIONS requests within 1 second. The HeyGen webhook already handles this.

### Workflow stuck in "pending"

Check the status endpoint to see current state:
```bash
curl "http://localhost:3000/api/workflow/viral-video-webhook/status?id=YOUR_WORKFLOW_ID"
```

If HeyGen completed but Submagic hasn't started, check:
- Submagic API key is valid
- Submagic account has credits
- Server logs for errors

## Production Checklist

- [ ] Set `NEXT_PUBLIC_BASE_URL` to your production domain
- [ ] Set `WEBHOOK_SECRET` to a strong random value
- [ ] Register production webhook URL with HeyGen
- [ ] Test webhook delivery in production
- [ ] Set up monitoring/alerts for webhook failures
- [ ] Consider using Redis instead of in-memory workflow store

## Comparison: Old vs New

| Feature | Polling (Old) | Webhooks (New) |
|---------|---------------|----------------|
| API Calls | 20+ per video | 2 per video |
| Response Time | 2-10 minutes | Instant status |
| Reliability | Can timeout | Always notified |
| Resource Usage | High | Low |
| Scalability | Limited | Unlimited |

## Next Steps

After webhooks are working:

1. **Scale up** - Process multiple videos in parallel
2. **Add queue** - Use BullMQ or similar for job management
3. **Add persistence** - Use Redis or PostgreSQL for workflow state
4. **Add monitoring** - Track webhook delivery and failures
5. **Add retries** - Handle failed webhooks gracefully

## Questions?

Check these resources:
- [HeyGen Webhook Docs](https://docs.heygen.com/docs/using-heygens-webhook-events)
- [Submagic API Docs](https://docs.submagic.co/)
