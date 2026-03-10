# AI Video Provider Requirements — OwnerFi Social Media System

## Who We Are

OwnerFi is an automated social media content platform that generates and posts AI avatar videos across **7 brands** and **10+ social platforms** daily. We currently use **HeyGen** and **Synthesia** but are experiencing reliability issues with both and want to evaluate a new provider.

---

## What We Need From a New AI Video Provider

### Must-Have Requirements

1. **Talking Avatar Videos (Text-to-Video)**
   - We send a script (text) and get back a video of a realistic AI avatar speaking that script
   - Avatar must have natural lip sync, facial expressions, and upper-body movement
   - We need multiple diverse avatars (male/female, different ethnicities, professional/casual looks)
   - Minimum 6+ stock avatars available, ideally 10+

2. **API Access (No Manual UI)**
   - Everything runs via cron jobs — zero human involvement in video creation
   - Need a REST API to: create video, check status, and retrieve the finished video
   - Must support async workflow: submit video → receive webhook OR poll for completion → download result

3. **Webhook Support (Strongly Preferred)**
   - We need a callback/webhook when the video is done rendering
   - Webhook payload must include: video ID, status (success/fail), download URL
   - Bonus: ability to pass a custom `callbackId` that gets echoed back in the webhook (we use this to route videos back to the correct brand/workflow)

4. **Vertical Video (9:16)**
   - All our content is short-form vertical video for TikTok, Instagram Reels, YouTube Shorts
   - Must support 9:16 aspect ratio natively (not cropped from 16:9)
   - 1080x1920 resolution minimum

5. **Reasonable Rendering Speed**
   - Current providers take 3-10 minutes per video
   - Anything under 15 minutes is acceptable
   - Under 5 minutes is ideal

6. **Stable Download URLs**
   - We need to download the finished video file (MP4) to our own storage (Cloudflare R2)
   - Download URLs must remain valid for at least 1 hour after completion
   - Permanent URLs are ideal (Synthesia's presigned URLs expire quickly and have caused issues)

7. **Voice Quality**
   - Natural-sounding voices with emotion support (friendly, serious, soothing)
   - English is required; Spanish is a nice-to-have
   - Speed control (0.5x - 1.5x) is a nice-to-have

### Nice-to-Have Features

- **Custom avatar creation** — we have a personal brand avatar (Abdullah) that we'd like to recreate
- **Voice cloning** — we have an existing voice clone on HeyGen we'd like to port
- **Background customization** — solid color, image, or video backgrounds per brand
- **Avatar gestures/motion prompts** — ability to control hand gestures and body language
- **Batch/bulk API** — submit multiple videos in one API call
- **Usage/quota API** — check remaining credits programmatically (HeyGen's quota API is unreliable)

---

## Our Current Architecture (For Context)

### Pipeline Overview

```
Cron Job (3x daily per brand)
  → AI generates script (topic-specific per brand)
  → Video Provider API creates avatar video
  → Webhook notifies our server when done
  → We download MP4 to Cloudflare R2 (permanent storage)
  → Submagic API adds animated captions/subtitles
  → Late.dev API posts to all social platforms
  → Workflow marked complete in Firestore
```

### Brands We Operate (7 total)

| Brand | Content Type | Videos/Day |
|-------|-------------|------------|
| **OwnerFi** | Real estate news & tips | 3 |
| **Carz Inc** | Automotive news | 3 |
| **Benefit** | Owner financing education | 3 |
| **Abdullah** | Personal brand (mindset/business) | 3-5 |
| **Gaza Relief** | Humanitarian news | 3 |
| **Realtors** | Real estate agent tips | 3 |
| **Personal** | Misc content | 1-3 |

**Total: ~20-25 videos per day**

### Social Platforms We Post To

Instagram, TikTok, YouTube Shorts, Facebook, LinkedIn, Threads, Twitter/X, Bluesky

### Current Avatar Setup

**HeyGen** (7 active avatars):
- 4 general avatars (2 male, 2 female) rotating across 6 brands via round-robin
- 4 Gaza-specific avatars with serious/soothing tone
- Supports: avatar type selection, scale/zoom, talking style (stable/expressive), emotion, motion prompts
- Has Avatar IV feature for more natural gestures

**Synthesia** (3 active avatars):
- 3 stock avatars rotating via round-robin across all brands
- Simpler config: just avatarId + scriptText + optional voiceId
- Uses avatar default voices and backgrounds

### How We Integrate a Video Provider

For each provider we maintain:

1. **Client Library** (`src/lib/{provider}-client.ts`)
   - `generateVideo(request, brand, workflowId)` → returns `{ success, video_id }`
   - `getVideoStatus(videoId)` → returns status + download URL
   - Includes quota checking and cost tracking

2. **Agent Config** (`src/config/{provider}-agents.ts`)
   - Array of avatar configurations (ID, name, voice, brands, active status)
   - Round-robin selection function: `getAgentForBrand(brand)`
   - Per-avatar settings (voice speed, emotion, scale, background)

3. **Webhook Handler** (`src/app/api/webhooks/{provider}/[brand]/route.ts`)
   - Receives completion callback
   - Downloads video to Cloudflare R2
   - Triggers Submagic captioning
   - Updates workflow status in Firestore

4. **Stuck Workflow Detection**
   - Cron checks every 30 min for videos stuck in `{provider}_processing`
   - Polls provider API for actual status
   - Auto-retries up to 3x, then marks permanently failed

### Env Configuration

```
VIDEO_PROVIDER=synthesia  # or 'heygen' — single env var switches all brands
{PROVIDER}_API_KEY=xxx
```

---

## Problems We've Had With Current Providers

### HeyGen Issues
- **Quota API is unreliable** — reports 0 credits when dashboard shows credits available, forcing us to add a `BYPASS_HEYGEN_QUOTA_CHECK` workaround
- **Avatars disappear without notice** — 3 avatars (Josh, Kayla, Edward) became unavailable with no API error, just silent failures
- **Voice IDs change** — HeyGen removed/changed voice IDs requiring code updates
- **Cost** — enterprise pricing is high for 20+ videos/day

### Synthesia Issues
- **Presigned download URLs expire quickly** — if our webhook handler is slow or R2 upload retries take too long, the download URL dies and we lose the video
- **Limited avatar customization** — no background control, no gesture/motion prompts, no emotion settings
- **No quota API** — can't check remaining credits programmatically
- **Webhook is global** — one webhook URL for all brands (we encode brand in callbackId as workaround)

### General Issues
- **No provider abstraction** — switching providers requires changes across 20+ files (we want to fix this)
- **Stuck videos** — both providers occasionally have videos stuck in processing with no webhook callback, requiring polling fallback

---

## What We're Looking For in Responses

1. **Provider Recommendations** — Which AI video companies should we evaluate? Consider: API maturity, avatar quality, pricing for 20-25 videos/day, reliability
2. **Architecture Advice** — Should we build a provider abstraction layer first? Or just integrate the new provider alongside existing ones?
3. **Pricing Analysis** — What would 750 videos/month cost on each recommended platform?
4. **Migration Strategy** — How to test a new provider without disrupting current production pipeline?
5. **Red Flags** — What to watch out for when evaluating (rate limits, rendering queues, avatar licensing, etc.)?

---

## Providers We're Aware Of (But Haven't Evaluated)

| Provider | Notes |
|----------|-------|
| **D-ID** | Talking avatars, similar to HeyGen |
| **Tavus** | Personalized video at scale |
| **Runway** | More creative/generative, may not do talking avatars |
| **Kling** | Short-form focused |
| **ElevenLabs** | Just launched video (primarily known for voice) |
| **Colossyan** | Enterprise video, avatar-based |
| **Deepbrain AI** | Avatar videos with API |
| **Hour One** | Virtual presenters |
| **Rephrase.ai** | Text-to-video with avatars |
| **Captions.ai** | AI video editing + avatars |
| **Invideo AI** | Text-to-video generation |

---

## Technical Constraints

- **Runtime**: Next.js on Vercel (serverless, 60s function timeout for API routes, 300s for crons)
- **Storage**: Cloudflare R2 (we download all videos here — provider URLs are temporary)
- **Database**: Firestore (workflow tracking, cost tracking, dedup)
- **Captioning**: Submagic (adds animated subtitles after video provider is done)
- **Posting**: Late.dev API (schedules/posts to all platforms)
- **Language**: TypeScript / Node.js
- **Budget**: Looking for best value at 750+ videos/month scale

---

*Last updated: March 9, 2026*
