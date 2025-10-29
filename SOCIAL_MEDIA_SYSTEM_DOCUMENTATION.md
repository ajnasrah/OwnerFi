# SOCIAL MEDIA AUTOMATION SYSTEM - COMPLETE DOCUMENTATION

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Content Types & Brands](#content-types--brands)
4. [Core Workflow Pipeline](#core-workflow-pipeline)
5. [API Integration Details](#api-integration-details)
6. [Webhook System](#webhook-system)
7. [Failsafe & Recovery Systems](#failsafe--recovery-systems)
8. [Content Generation Systems](#content-generation-systems)
9. [Cron Jobs & Automation](#cron-jobs--automation)
10. [Data Models & Collections](#data-models--collections)
11. [Admin Dashboards](#admin-dashboards)
12. [Configuration & Environment](#configuration--environment)
13. [Troubleshooting Guide](#troubleshooting-guide)

---

## System Overview

### What This System Does
This is a **fully automated, multi-brand social media content generation and publishing system** that:

1. **Generates AI-powered video content** across 6 different brands
2. **Enhances videos** with professional captions, zooms, and effects
3. **Posts automatically** to 10+ social media platforms
4. **Self-heals** with comprehensive failsafe systems
5. **Tracks analytics** for performance optimization
6. **Manages costs** across multiple AI/video APIs

### Supported Platforms
- Instagram (Reels & Stories)
- TikTok
- YouTube Shorts
- Facebook (Feed & Stories)
- LinkedIn
- Twitter/X
- Threads
- Pinterest
- Reddit
- Bluesky

### Technology Stack
- **Framework**: Next.js 14+ (App Router)
- **Database**: Firebase Firestore
- **Storage**: Cloudflare R2 (CDN)
- **Video Generation**: HeyGen API
- **Video Enhancement**: Submagic API
- **Social Posting**: Late.so API
- **AI Scripts**: OpenAI GPT-4o-mini
- **Hosting**: Vercel (with cron jobs)

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT SOURCE                                │
│  RSS Feeds | Property Listings | Manual Triggers | Cron Jobs    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 CONTENT SELECTION                                │
│  • AI Quality Rating (OpenAI)                                    │
│  • Eligibility Checks                                            │
│  • Queue Management                                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              SCRIPT GENERATION (OpenAI GPT-4o-mini)             │
│  • Brand-specific prompts                                        │
│  • A/B variant generation (30s vs 15s)                          │
│  • Caption & hashtag creation                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│         VIDEO GENERATION (HeyGen) - Avatar + Voice              │
│  Status: pending → heygen_processing                             │
│  Callback: webhook receives video URL                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼ [HeyGen Webhook]
┌─────────────────────────────────────────────────────────────────┐
│      VIDEO ENHANCEMENT (Submagic) - Captions + Effects         │
│  Status: heygen_processing → submagic_processing                 │
│  Features: Hormozi-style captions, zooms, B-rolls                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼ [Submagic Webhook #1: Captions Done]
                       │ Triggers /export
                       │
                       ▼ [Submagic Webhook #2: Export Done]
┌─────────────────────────────────────────────────────────────────┐
│         ASYNC VIDEO PROCESSING (/api/process-video)             │
│  Status: video_processing                                        │
│  1. Download from Submagic (fresh URL fetch)                     │
│  2. Upload to R2 Storage (permanent CDN URL)                     │
│  3. Update status to 'posting' with finalVideoUrl                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│           SOCIAL MEDIA POSTING (Late.so API)                    │
│  Status: posting → completed                                     │
│  • Queue-aware scheduling (15 posts/day max)                    │
│  • Multi-platform distribution                                   │
│  • Saves latePostId for tracking                                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              SOCIAL MEDIA PLATFORMS                              │
│  Live posts on Instagram, TikTok, YouTube, etc.                 │
│  Late.so handles actual publishing at scheduled time             │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Status Progression

```
pending
  ↓ (HeyGen API called)
heygen_processing
  ↓ (HeyGen webhook received)
submagic_processing
  ↓ (Submagic captions done, /export called)
  ↓ (Submagic export complete)
video_processing
  ↓ (Video downloaded, uploaded to R2)
posting
  ↓ (Late API call successful)
completed
```

**Alternate Paths:**
- Any status → `failed` (with error logged)
- Stuck workflows → Detected by failsafe crons → Auto-retry

---

## Content Types & Brands

### 1. Carz (Automotive Content)
- **Source**: RSS feeds from car industry news sites
- **Frequency**: 5x daily (9am, 12pm, 3pm, 6pm, 9pm ET)
- **Platforms**: Instagram Reels, TikTok, YouTube, LinkedIn
- **Avatar**: Default HeyGen avatar
- **Voice**: Male professional voice
- **Special Features**: B-rolls enabled, silence removal

**Collection**: `carz_workflow_queue`

### 2. OwnerFi (Real Estate/Owner Financing)
- **Source**: RSS feeds from real estate blogs
- **Frequency**: 5x daily
- **Platforms**: Instagram Reels, TikTok, YouTube Shorts, Facebook
- **Content**: Educational content about owner financing, buyer benefits
- **Special Features**: B-rolls enabled

**Collection**: `ownerfi_workflow_queue`

### 3. Property Videos (Property Showcases)
- **Source**: Property listings in Firestore (`properties` collection)
- **Eligibility**: Active properties with images
- **Platforms**: Instagram Reels, TikTok, YouTube
- **Avatar**: Motion-enabled avatar (left side, small)
- **Background**: Property images (exterior preferred)
- **A/B Testing**: Generates both 30-sec and 15-sec variants
- **Special Features**:
  - **NO B-rolls** (preserves full property view)
  - **NO silence removal** (keeps complete script)
  - Location-targeted hashtags (#HoustonHomes, #HoustonRealEstate)

**Collection**: `property_videos`
**Schema**: Uses nested `workflowStatus` object in `properties` collection

**Key Features**:
- Financial calculations (down payment, monthly payment)
- Property highlight selection (pool, view, updated features)
- City/state location targeting
- Mandatory legal disclaimers

### 4. Benefit Videos (Buyer Education)
- **Source**: Predefined benefit topics (rotating daily themes)
- **Frequency**: Daily generation
- **Platforms**: Instagram Stories, TikTok, YouTube
- **Avatar**: Motion-enabled with **green background** (buyer-focused)
- **Duration**: Fixed 30 seconds
- **Themes by Day**:
  - Monday: Credit Myths
  - Tuesday: Real Stories
  - Wednesday: Market Insights
  - Thursday: Success Stories
  - Friday: Weekend Opportunities
  - Saturday: How-To Guides
  - Sunday: Motivation & Goals

**Collection**: `benefit_workflow_queue`

### 5. Podcast (AI-Generated Episodes)
- **Source**: Guest profiles with Q&A format
- **Platforms**: Instagram, TikTok, YouTube + Podcast RSS
- **Format**: Full dialogue with host/guest interaction
- **Special Features**:
  - Publishes to podcast platforms (Apple, Spotify)
  - 60-90 second social clips
  - RSS feed generation

**Collection**: `podcast_workflow_queue`

### 6. VassDistro (Vape Industry)
- **Source**: RSS feeds from vape industry news
- **Frequency**: Custom schedule
- **Platforms**: Instagram, TikTok, YouTube
- **Special Features**: Industry-specific content

**Collection**: `vassdistro_workflow_queue`

### 7. Abdullah (Personal Brand)
- **Source**: Daily content generation (5 videos/day)
- **Themes**: Mindset, Business, Money, Freedom, Story
- **Platforms**: Instagram, TikTok, YouTube
- **Voice**: Abdullah's authentic voice tone
- **Engagement**: Includes daily questions for audience interaction

**Collection**: `abdullah_workflow_queue`

---

## Core Workflow Pipeline

### Step-by-Step Detailed Flow

#### **Step 1: Content Selection & Workflow Creation**

**Trigger Points**:
- Cron job (scheduled)
- Manual API call
- Webhook from external system (e.g., GoHighLevel for buyer leads)

**Process**:
1. Fetch eligible content (articles, properties, topics)
2. Rate quality (AI-powered for articles)
3. Check eligibility criteria
4. Create workflow document in Firestore
5. Generate script using OpenAI

**Files**:
- `/src/app/api/cron/generate-video/route.ts` - Main generation cron
- `/src/lib/rss-fetcher.ts` - Fetch RSS content
- `/src/lib/property-video-generator.ts` - Property script generation

---

#### **Step 2: Video Generation (HeyGen)**

**Process**:
1. Call HeyGen API with:
   - Avatar ID (motion or standard)
   - Voice ID
   - Script text
   - Background (image or color)
   - Callback URL: `/api/webhooks/heygen/[brand]`
   - Callback ID: workflow ID

2. HeyGen processes video (30-60 seconds)
3. Workflow status: `pending` → `heygen_processing`

**Configuration**:
```javascript
{
  video_inputs: [{
    character: {
      type: 'talking_photo',
      talking_photo_id: 'd33fe3abc2914faa88309c3bdb9f47f4', // Motion avatar
      scale: 0.4, // For property videos (smaller)
      talking_style: 'expressive'
    },
    voice: {
      type: 'text',
      input_text: script,
      voice_id: '5bd25d00f41c477989e1e121a16986d3'
    },
    background: {
      type: 'image',
      url: propertyImageUrl // Or solid color
    }
  }],
  dimension: { width: 1080, height: 1920 }, // Vertical video
  callback_id: workflowId
}
```

**Files**:
- `/src/lib/heygen-client.ts` - HeyGen API integration (397 lines)

---

#### **Step 3: HeyGen Webhook Handler**

**Endpoint**: `/api/webhooks/heygen/[brand]`

**Process**:
1. Verify webhook signature (if enabled)
2. Check idempotency (prevent duplicate processing)
3. Extract video URL from payload
4. Find workflow by `callback_id`
5. **Trigger Submagic processing asynchronously** (non-blocking)
6. Save HeyGen video URL to workflow
7. Status: `heygen_processing` → `submagic_processing`
8. Return 200 OK immediately (prevents timeout)

**Why Async?**
- Webhook must respond within 30 seconds
- Submagic processing can take 60-120 seconds
- Fire-and-forget pattern prevents cascading timeouts

**Payload Example**:
```json
{
  "event_type": "avatar_video.success",
  "event_data": {
    "video_id": "abc123",
    "url": "https://cdn.heygen.com/video.mp4",
    "callback_id": "workflow_xyz"
  }
}
```

**Files**:
- `/src/app/api/webhooks/heygen/[brand]/route.ts` (447 lines)
- `/src/lib/webhook-verification.ts` - Signature validation
- `/src/lib/webhook-idempotency.ts` - Duplicate prevention
- `/src/lib/webhook-dlq.ts` - Dead letter queue for failures

---

#### **Step 4: Video Enhancement (Submagic)**

**Process**:
1. Send HeyGen video URL directly to Submagic (no R2 upload yet)
2. Configure brand-specific features:
   - Template: "Hormozi 2" (professional captions)
   - Magic Zooms: Enabled for all brands
   - B-rolls: Enabled for Carz/OwnerFi, **disabled for Property/Podcast**
   - Silence Removal: Enabled except for Property (keeps full script)
3. Webhook URL: `/api/webhooks/submagic/[brand]`
4. Submagic generates captions (30-60 seconds)

**Configuration**:
```javascript
{
  title: 'Property Video',
  language: 'en',
  videoUrl: heygenVideoUrl,
  webhookUrl: 'https://ownerfi.ai/api/webhooks/submagic/property',
  templateName: 'Hormozi 2',
  magicZooms: true,
  magicBrolls: false, // Property videos
  removeSilencePace: 'off', // Property videos
  removeBadTakes: false // Property videos
}
```

**Files**:
- `/src/lib/submagic-client.ts` - Submagic API client

---

#### **Step 5: Submagic Webhook Handler (Two-Stage Process)**

**Endpoint**: `/api/webhooks/submagic/[brand]`

**Stage 1: Captions Complete**
- Payload: `{ projectId, status: 'completed' }`
- **No download URL yet**
- Action: Call `/export` endpoint to generate final video
- Returns immediately

**Stage 2: Export Complete**
- Payload: `{ projectId, status: 'completed', downloadUrl: 'url' }`
- **Video is ready for download**
- Action: Save URL, trigger async processing
- Status: `submagic_processing` → `video_processing`

**Why Two Webhooks?**
- Submagic completes captions first (webhook #1)
- Export must be explicitly triggered
- Export generates the final downloadable video (webhook #2)

**Critical Steps**:
1. Extract `downloadUrl` from payload
2. **Save URL immediately** to workflow (`submagicDownloadUrl`)
3. Trigger `/api/process-video` asynchronously
4. Return 200 OK (webhook completes fast)

**Files**:
- `/src/app/api/webhooks/submagic/[brand]/route.ts` (525 lines)

---

#### **Step 6: Async Video Processing**

**Endpoint**: `/api/process-video`
**Max Duration**: 300 seconds (5 minutes)

**Process**:
1. **Fetch fresh download URL** from Submagic API
   - Webhook URLs can expire
   - API call gets a valid URL every time

2. **Download video** from Submagic
   - Handles large file sizes
   - Retry logic with exponential backoff

3. **Upload to R2 Storage**
   - Path: `{brand}/submagic-videos/{workflowId}.mp4`
   - Returns public CDN URL
   - Permanent storage (no expiration)

4. **Update workflow status to 'posting'**
   - **Critical**: Status changes AFTER R2 upload succeeds
   - Saves `finalVideoUrl` before attempting Late API
   - This ensures failsafe can retry if posting fails

5. **Post to Late API**
   - Uses queue-aware scheduling
   - Multi-platform distribution
   - Returns `latePostId`

6. **Mark as completed**
   - Saves `latePostId`
   - Sets `completedAt` timestamp
   - Status: `posting` → `completed`

**Why Separate from Webhook?**
- Downloading + uploading takes 30-90 seconds
- Late API call adds 5-10 seconds
- Webhook would timeout
- Separate endpoint has 5-minute timeout

**Error Handling**:
- If R2 upload fails: Keep status as `video_processing`
- If Late fails: Status stays `posting`, video URL saved
- Failsafe cron retries both scenarios

**Files**:
- `/src/app/api/process-video/route.ts` (289 lines)
- `/src/lib/video-storage.ts` - R2 upload utilities

---

#### **Step 7: Social Media Posting (Late.so)**

**API**: Late.so REST API
**Base URL**: `https://getlate.dev/api/v1`

**Process**:
1. Get profile ID for brand
2. Fetch connected accounts (Instagram, TikTok, etc.)
3. Map platforms to account IDs
4. **Get next queue slot** (if using queue)
5. Build request payload
6. Post to Late API
7. Return post ID

**Queue System**:
- Each profile has daily posting slots (e.g., 9am, 12pm, 3pm, 6pm, 9pm)
- Late automatically schedules to next available slot
- Max 15 posts/day per profile (platform limit)

**Request Payload**:
```javascript
{
  content: caption,
  mediaItems: [{
    type: 'video',
    url: r2VideoUrl
  }],
  platforms: [
    {
      platform: 'instagram',
      accountId: 'account_123',
      platformSpecificData: {
        contentType: 'reel' // or 'story'
      }
    },
    {
      platform: 'youtube',
      accountId: 'account_456',
      platformSpecificData: {
        title: 'Video Title',
        category: 'Howto & Style',
        short: true
      }
    }
  ],
  scheduledFor: '2025-01-15T19:00:00Z',
  timezone: 'America/New_York',
  queuedFromProfile: profileId
}
```

**Platform-Specific Configs**:
- **Instagram**: Reel or Story
- **YouTube**: Title, category, privacy (shorts mode)
- **TikTok**: Privacy setting
- **Facebook**: Feed or Story

**Files**:
- `/src/lib/late-api.ts` - Complete Late integration (662 lines)

---

## API Integration Details

### HeyGen API

**Endpoint**: `https://api.heygen.com/v2/video/generate`
**Auth**: Bearer token
**Timeout**: 60 seconds
**Rate Limit**: 10 requests/minute

**Key Features**:
- Avatar-based video generation
- Motion-enabled avatars (more natural movement)
- Custom backgrounds (images or solid colors)
- Voice cloning support
- Webhook notifications

**Cost**: ~$0.10-0.30 per video (30-60 seconds)

---

### Submagic API

**Base URL**: `https://api.submagic.co/v1`
**Auth**: `x-api-key` header
**Timeout**: 90 seconds
**Rate Limit**: 20 requests/minute

**Endpoints**:
- `POST /projects` - Create project (captions)
- `POST /projects/{id}/export` - Generate final video
- `GET /projects/{id}` - Get project status & download URL

**Templates**:
- "Hormozi 2" - Bold yellow captions, high energy
- Custom templates available

**Features**:
- Auto-caption generation (AI-powered)
- Magic Zooms (face/object tracking)
- B-roll insertion (stock footage)
- Silence removal (fast-paced editing)
- Bad take removal (AI quality filter)

**Cost**: ~$0.05-0.15 per video

---

### Late.so API

**Base URL**: `https://getlate.dev/api/v1`
**Auth**: Bearer token
**Timeout**: 30 seconds
**Rate Limit**: 100 requests/minute

**Key Endpoints**:
```bash
# Profiles & Accounts
GET  /profiles
GET  /accounts?profileId={id}

# Queue Management
GET  /queue/next-slot?profileId={id}
GET  /queue/slots?profileId={id}
PUT  /queue/slots

# Posting
POST /posts
GET  /posts/{id}
DELETE /posts/{id}

# Analytics
GET /analytics/posts?profileId={id}&startDate={date}
```

**Cost**: $20-50/month (unlimited posts)

**Connected Platforms**:
Each profile can connect multiple social accounts:
- Instagram Business Account
- TikTok Creator Account
- YouTube Channel
- Facebook Page
- LinkedIn Profile/Page
- Twitter Account
- Threads (via Instagram)
- Pinterest Board
- Reddit Profile
- Bluesky Account

---

### OpenAI API

**Endpoint**: `https://api.openai.com/v1/chat/completions`
**Model**: `gpt-4o-mini`
**Rate Limit**: 3 requests/minute (custom implementation)

**Usage**:
- Article descriptions
- Property video scripts (30s & 15s variants)
- Benefit video content
- Podcast episode scripts
- Abdullah daily content

**Cost**: ~$0.001-0.005 per script

---

### Cloudflare R2

**Purpose**: Permanent video storage with CDN delivery
**Access**: S3-compatible API
**Cost**: $0.015/GB storage, $0.36/GB bandwidth (first 10GB free)

**Bucket Structure**:
```
ownerfi-videos/
├── carz/submagic-videos/
│   ├── workflow_001.mp4
│   └── workflow_002.mp4
├── ownerfi/submagic-videos/
├── property/submagic-videos/
├── benefit/submagic-videos/
└── podcast/submagic-videos/
```

**Files**:
- `/src/lib/video-storage.ts` (365 lines)

---

## Webhook System

### Brand-Specific Webhook URLs

Each brand has isolated webhook endpoints to prevent cross-brand failures:

**HeyGen Webhooks**:
```
https://ownerfi.ai/api/webhooks/heygen/carz
https://ownerfi.ai/api/webhooks/heygen/ownerfi
https://ownerfi.ai/api/webhooks/heygen/property
https://ownerfi.ai/api/webhooks/heygen/benefit
https://ownerfi.ai/api/webhooks/heygen/podcast
https://ownerfi.ai/api/webhooks/heygen/vassdistro
https://ownerfi.ai/api/webhooks/heygen/abdullah
```

**Submagic Webhooks**:
```
https://ownerfi.ai/api/webhooks/submagic/carz
https://ownerfi.ai/api/webhooks/submagic/ownerfi
https://ownerfi.ai/api/webhooks/submagic/property
https://ownerfi.ai/api/webhooks/submagic/benefit
https://ownerfi.ai/api/webhooks/submagic/podcast
https://ownerfi.ai/api/webhooks/submagic/vassdistro
https://ownerfi.ai/api/webhooks/submagic/abdullah
```

### Webhook Security

**Signature Verification**:
- HeyGen: `X-HeyGen-Signature` header
- Submagic: Custom signature (if enabled)
- Validation: `HMAC-SHA256(secret, payload)`

**Idempotency**:
- Tracks processed webhook IDs
- Returns cached response for duplicates
- Prevents double-processing

**Dead Letter Queue (DLQ)**:
- Failed webhooks logged to Firestore
- Includes full payload, headers, error message
- Manual review & retry via admin dashboard

**Files**:
- `/src/lib/webhook-verification.ts`
- `/src/lib/webhook-idempotency.ts`
- `/src/lib/webhook-dlq.ts`

### Webhook Payload Examples

**HeyGen Success**:
```json
{
  "event_type": "avatar_video.success",
  "event_data": {
    "video_id": "1234567890abcdef",
    "url": "https://cdn.heygen.com/videos/abc.mp4",
    "callback_id": "workflow_abc123",
    "duration": 32.5,
    "created_at": "2025-01-15T12:00:00Z"
  }
}
```

**Submagic Complete**:
```json
{
  "projectId": "proj_xyz789",
  "status": "completed",
  "downloadUrl": "https://storage.submagic.co/exports/video.mp4",
  "media_url": "https://storage.submagic.co/exports/video.mp4",
  "thumbnailUrl": "https://storage.submagic.co/thumbs/thumb.jpg"
}
```

---

## Failsafe & Recovery Systems

### Overview
The system has **three layers of failsafe protection** to ensure no workflow gets stuck:

1. **Webhook-level failsafes** (immediate)
2. **Cron-based stuck detection** (every 10-30 minutes)
3. **Manual recovery tools** (admin dashboard)

---

### Stuck Workflow Detection Crons

#### 1. Check Stuck Posting
**File**: `/src/app/api/cron/check-stuck-posting/route.ts` (555 lines)
**Schedule**: Every 10 minutes
**Threshold**: 10 minutes stuck

**Checks For**:
- Workflows stuck in `posting` status
- Workflows stuck in `video_processing` status
- Properties stuck in "Posting" stage

**Recovery Actions**:
1. **If stuck in `video_processing`**:
   - Trigger `/api/process-video` again
   - Fetch fresh Submagic URL
   - Retry R2 upload

2. **If stuck in `posting` with video URL**:
   - Retry Late API posting
   - Use same R2 URL (already uploaded)

3. **If stuck in `posting` without video URL**:
   - Revert to `submagic_processing`
   - Let check-stuck-submagic handle it

4. **Max Retries**:
   - 3 attempts maximum
   - After 3 failures: Mark as `failed`
   - After 60 minutes: Force fail (no recovery path)

**Workflow Logic**:
```javascript
if (status === 'video_processing' && stuckMinutes > 10) {
  // Retry video download/upload
  await triggerProcessVideo(workflowId, videoUrl, submagicProjectId);
}

if (status === 'posting' && stuckMinutes > 10) {
  if (finalVideoUrl) {
    // Retry Late API posting
    await postToLate({ videoUrl: finalVideoUrl, ... });
  } else {
    // No video URL - revert to earlier stage
    await revertToSubmagicProcessing(workflowId);
  }
}

if (retryCount >= 3) {
  // Mark as failed
  await markAsFailed(workflowId, 'Max retries exceeded');
}
```

---

#### 2. Check Stuck HeyGen
**File**: `/src/app/api/cron/check-stuck-heygen/route.ts`
**Schedule**: Every 30 minutes
**Threshold**: 30 minutes stuck

**Checks For**:
- Workflows stuck in `heygen_processing`

**Recovery Actions**:
- Manually fetch HeyGen video status
- If complete: Trigger Submagic processing
- If failed: Mark workflow as failed

---

#### 3. Check Stuck Submagic
**File**: `/src/app/api/cron/check-stuck-submagic/route.ts`
**Schedule**: Every 30 minutes
**Threshold**: 30 minutes stuck

**Checks For**:
- Workflows stuck in `submagic_processing`

**Recovery Actions**:
- Fetch Submagic project status
- If complete: Trigger video processing
- If export not triggered: Call `/export`
- If failed: Mark workflow as failed

---

### Error Tracking & Alerting

**Slack Integration**:
- Workflow failures send Slack notifications
- Includes workflow ID, brand, error message
- Links to admin dashboard for recovery

**Error Monitoring**:
```javascript
// src/lib/error-monitoring.ts
export async function alertWorkflowFailure(
  brand: string,
  workflowId: string,
  title: string,
  error: string
) {
  // Send to Slack webhook
  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      text: `🚨 ${brand} Workflow Failed`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `*Workflow*: ${workflowId}` }},
        { type: 'section', text: { type: 'mrkdwn', text: `*Title*: ${title}` }},
        { type: 'section', text: { type: 'mrkdwn', text: `*Error*: ${error}` }}
      ]
    })
  });
}
```

---

## Content Generation Systems

### Property Video Generator

**File**: `/src/lib/property-video-generator.ts` (575 lines)

**Input**: Property listing data from Firestore
**Output**: Dual scripts (30-sec & 15-sec variants)

**Key Features**:

1. **Financial Calculations**:
   - Down payment (amount or percentage)
   - Monthly payment (before taxes/insurance)
   - Interest rate and term display

2. **Highlight Selection** (Priority Order):
   - Unique features (pool, view, waterfront, acreage)
   - Updated/remodeled mentions
   - Low down payment percentage
   - Affordable monthly payment
   - Default: "Great owner financing opportunity"

3. **Location Targeting**:
   - City-specific hashtags (#HoustonHomes)
   - State-specific tags (#HoustonTX)
   - Real estate tags (#HoustonRealEstate)

4. **Legal Disclaimers**:
   - "Prices and terms may change anytime"
   - "Estimated before taxes and insurance"
   - "Visit OwnerFi.ai for more details"

**System Prompt** (GPT-4o-mini):
- Abdullah voice: Friendly, goofy, confident
- 5th-grade clarity
- No guarantees or investment advice
- Mandatory CTAs + engagement questions

**Example 30-Second Script**:
```
If your rent's over $1,200, you need to see this.

This 3-bed home near Dallas is around $250K, and the
seller's open to owner financing — no bank, no credit drama.

Try finding anything close to this monthly — you can't.

Visit Owner-Fy dot A Eye to see more homes near you —
all free with agent contact info. Prices and terms may
change anytime.

Follow Abdullah for daily homeownership hacks.

Would you take this deal or keep renting?
```

---

### Benefit Video Generator

**File**: `/src/lib/benefit-video-generator.ts` (433 lines)

**Daily Themes**:
- Monday: Credit Myths
- Tuesday: Real Stories
- Wednesday: Market Insights
- Thursday: Success Stories
- Friday: Weekend Opportunities
- Saturday: How-To Guides
- Sunday: Motivation & Goals

**Visual Identity**:
- Avatar: Motion-enabled
- Background: **Green** (buyer-focused, not seller-orange)
- Duration: Fixed 30 seconds
- Template: Hormozi 2 captions

**Content Structure**:
```
Hook (3s) → Education (18s) → CTA (5s) → Question (4s)
```

**Emotion-Paired CTAs**:
- Motivational: "You've got this 💪"
- Informative: "Knowledge is power 📚"
- Opportunity: "Deals are out there 🔍"

---

### Article-Based Generators (Carz, OwnerFi, VassDistro)

**Process**:
1. Fetch articles from RSS feeds
2. Rate article quality (OpenAI)
3. Generate video description
4. Create HeyGen video
5. Enhance with Submagic
6. Post to Late

**Rating Criteria**:
- Relevance to brand
- Engagement potential
- Freshness (recent articles prioritized)
- Content quality (well-written, informative)

---

## Cron Jobs & Automation

### Cron Schedule Overview

| Cron Job | Schedule | Purpose |
|----------|----------|---------|
| **generate-video** | 5x daily (9am, 12pm, 3pm, 6pm, 9pm) | Generate Carz/OwnerFi videos |
| **generate-abdullah-daily** | Daily 6am ET | Generate 5 Abdullah videos |
| **generate-video-vassdistro** | Custom | Generate VassDistro videos |
| **check-stuck-posting** | Every 10 min | Failsafe for posting/video_processing |
| **check-stuck-heygen** | Every 30 min | Failsafe for heygen_processing |
| **check-stuck-submagic** | Every 30 min | Failsafe for submagic_processing |
| **fetch-rss** | Hourly | Fetch new articles from feeds |
| **rate-articles** | Every 6 hours | AI quality rating |
| **refill-articles** | Daily | Ensure sufficient article queue |
| **cleanup-videos** | Daily 2am | Delete old temporary files |
| **weekly-maintenance** | Weekly Sun 3am | System health check |

### Cron Authentication

**Method 1: Vercel Cron (Recommended)**
- Vercel automatically authenticates cron requests
- User-Agent: `vercel-cron/1.0`
- No manual auth needed

**Method 2: CRON_SECRET**
- Bearer token in Authorization header
- `Authorization: Bearer {CRON_SECRET}`
- Fallback for manual triggers

**Implementation**:
```javascript
const authHeader = request.headers.get('authorization');
const userAgent = request.headers.get('user-agent');
const isVercelCron = userAgent === 'vercel-cron/1.0';

if (authHeader !== `Bearer ${CRON_SECRET}` && !isVercelCron) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Data Models & Collections

### Workflow Document Schema

**Used By**: Carz, OwnerFi, VassDistro, Abdullah

```typescript
interface Workflow {
  // Identity
  id: string;
  brand: 'carz' | 'ownerfi' | 'vassdistro' | 'abdullah';
  articleId?: string;

  // Status
  status: 'pending' | 'heygen_processing' | 'submagic_processing'
        | 'video_processing' | 'posting' | 'completed' | 'failed';

  // Video IDs
  heygenVideoId?: string;
  heygenVideoUrl?: string;
  submagicProjectId?: string;
  submagicVideoId?: string;
  submagicDownloadUrl?: string; // Cached from webhook
  finalVideoUrl?: string;        // R2 CDN URL

  // Content
  articleTitle?: string;
  caption?: string;
  title?: string;
  hashtags?: string[];
  script?: string;

  // Social posting
  latePostId?: string;
  platforms?: string[];

  // Timestamps
  createdAt: number;
  updatedAt: number;
  statusChangedAt?: number;
  completedAt?: number;

  // Error handling
  error?: string;
  retryCount?: number;
  lastRetryAt?: number;
  failedAt?: number;

  // A/B Testing
  abTestId?: string;
  abTestVariantId?: string;
}
```

---

### Property Video Schema

**Collection**: `property_videos`

```typescript
interface PropertyVideo {
  // References
  id: string;
  propertyId: string;

  // Workflow status
  status: 'pending' | 'heygen_processing' | 'submagic_processing'
        | 'video_processing' | 'posting' | 'completed' | 'failed';

  // Video IDs
  heygenVideoId?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;

  // A/B Testing
  variant: '30' | '15'; // 30-sec or 15-sec version
  abTestId?: string;

  // Content
  script: string;
  caption: string;
  title: string;
  hashtags: string[];

  // Property data snapshot
  address: string;
  city: string;
  state: string;
  listPrice: number;
  downPaymentAmount: number;
  monthlyPayment: number;
  bedrooms: number;
  bathrooms: number;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  completedAt?: number;

  // Social posting
  latePostId?: string;
}
```

**Note**: Properties also have a nested `workflowStatus` object in the `properties` collection for tracking.

---

### Benefit Workflow Schema

**Collection**: `benefit_workflow_queue`

```typescript
interface BenefitWorkflow {
  // Identity
  id: string;
  brand: 'benefit';

  // Status
  status: 'pending' | 'heygen_processing' | 'submagic_processing'
        | 'video_processing' | 'posting' | 'completed' | 'failed';

  // Content
  theme: 'credit-myths' | 'real-stories' | 'market-insights' | ...;
  benefitTitle: string;
  script: string;
  caption: string;
  title: string;

  // Video IDs
  heygenVideoId?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  completedAt?: number;

  // Social posting
  latePostId?: string;
}
```

---

### Podcast Workflow Schema

**Collection**: `podcast_workflow_queue`

```typescript
interface PodcastWorkflow {
  // Identity
  id: string;
  brand: 'podcast';

  // Status (note: uses 'publishing' instead of 'posting')
  status: 'pending' | 'heygen_processing' | 'submagic_processing'
        | 'video_processing' | 'publishing' | 'completed' | 'failed';

  // Episode info
  episodeNumber: number;
  episodeTitle: string;
  guestName?: string;
  guestBio?: string;

  // Content
  script: string; // Full dialogue
  caption: string;

  // Video IDs
  heygenVideoId?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  completedAt?: number;

  // Social posting
  latePostId?: string;

  // Podcast-specific
  rssPublished?: boolean;
  podcastPlatforms?: string[];
}
```

---

### Article Schema

**Collections**: `carz_articles`, `ownerfi_articles`, `vassdistro_articles`

```typescript
interface Article {
  id: string;
  title: string;
  description?: string;
  link: string;
  pubDate: string;
  feedId: string;
  brand: string;

  // Quality rating
  rating?: number; // 1-10
  ratingReason?: string;
  rated?: boolean;

  // Status
  used?: boolean;
  usedAt?: number;
  workflowId?: string;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}
```

---

## Admin Dashboards

### Social Dashboard

**Route**: `/admin/social-dashboard`
**File**: `/src/app/admin/social-dashboard/page.tsx` (very large file)

**Features**:
1. **Workflow Logs** (Real-time)
   - All brands in one view
   - Filter by brand, status, date
   - Color-coded status indicators
   - Quick actions (retry, view details)

2. **Scheduler Status**
   - Cron job last run times
   - Next scheduled run
   - Success/failure indicators
   - Manual trigger buttons

3. **Queue Monitoring**
   - Late.so queue status per brand
   - Next posting slots
   - Daily post count
   - Queue health indicators

4. **System Metrics**
   - Pending workflows
   - In-progress workflows
   - Completed today
   - Failed workflows

5. **Quick Actions**
   - Manual workflow trigger
   - Retry failed workflows
   - View logs
   - Export data

**Status Color Codes**:
- 🟢 `completed` - Green
- 🟡 `pending` - Yellow
- 🔵 `heygen_processing` - Blue
- 🔵 `submagic_processing` - Blue
- 🟠 `video_processing` - Orange
- 🟠 `posting` - Orange
- 🔴 `failed` - Red

---

### Analytics Dashboard

**Component**: `/src/components/AnalyticsDashboard.tsx`

**Metrics**:
1. **Performance**
   - Total posts published
   - Average engagement rate
   - Best performing platform
   - Best performing time

2. **Engagement**
   - Likes, comments, shares per platform
   - Video views
   - Click-through rates

3. **Cost Tracking**
   - HeyGen API costs
   - Submagic API costs
   - Late API subscription
   - Total monthly spend

4. **A/B Testing Results**
   - 30s vs 15s performance
   - Best performing variant
   - Engagement comparison

---

### Cost Dashboard

**Component**: `/src/components/CostDashboard.tsx`
**Data Source**: `/src/lib/cost-tracker.ts` (656 lines)

**Breakdown**:
- **HeyGen**: Per-video generation costs
- **Submagic**: Per-video enhancement costs
- **Late**: Monthly subscription ($20-50)
- **OpenAI**: Script generation costs
- **R2 Storage**: Storage + bandwidth costs

**Optimization Recommendations**:
- Reduce unnecessary retries
- Batch API calls
- Optimize video lengths
- Monitor failed workflows

---

### Workflow Failures Dashboard

**Route**: `/admin/workflow-failures`

**Features**:
- List all failed workflows
- Filter by brand, date, error type
- View full error messages
- Retry individual workflows
- Bulk retry actions

---

### Late Failures Dashboard

**Route**: `/admin/late-failures`

**Features**:
- Failed Late.so posting attempts
- Missing account connections
- Rate limit issues
- Retry posting

---

## Configuration & Environment

### Required Environment Variables

```bash
# Next.js
NEXTAUTH_URL=https://ownerfi.ai
NEXT_PUBLIC_BASE_URL=https://ownerfi.ai

# Cron Authentication
CRON_SECRET=your_cron_secret_here

# HeyGen
HEYGEN_API_KEY=your_heygen_api_key

# Submagic
SUBMAGIC_API_KEY=your_submagic_api_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Late.so
LATE_API_KEY=your_late_api_key
LATE_OWNERFI_PROFILE_ID=prof_ownerfi_123
LATE_CARZ_PROFILE_ID=prof_carz_456
LATE_PODCAST_PROFILE_ID=prof_podcast_789
LATE_VASSDISTRO_PROFILE_ID=prof_vassdistro_101

# Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# Cloudflare R2
R2_BUCKET_NAME=ownerfi-videos
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_PUBLIC_URL=https://videos.ownerfi.ai

# Monitoring (Optional)
SLACK_WEBHOOK_URL=your_slack_webhook_url

# Webhook Security (Optional)
HEYGEN_WEBHOOK_SECRET=your_heygen_webhook_secret
SUBMAGIC_WEBHOOK_SECRET=your_submagic_webhook_secret
ENFORCE_WEBHOOK_VERIFICATION=false # Set to true in production
```

---

### Brand Configuration

**File**: `/src/config/brand-configs.ts`

```typescript
export const BRAND_CONFIGS = {
  ownerfi: {
    displayName: 'OwnerFi',
    platforms: ['instagram', 'tiktok', 'youtube', 'facebook'],
    webhooks: {
      heygen: 'https://ownerfi.ai/api/webhooks/heygen/ownerfi',
      submagic: 'https://ownerfi.ai/api/webhooks/submagic/ownerfi'
    },
    avatarId: 'd33fe3abc2914faa88309c3bdb9f47f4',
    voiceId: '5bd25d00f41c477989e1e121a16986d3',
    features: {
      brolls: true,
      silenceRemoval: true,
      zooms: true
    }
  },
  property: {
    displayName: 'Property',
    platforms: ['instagram', 'tiktok', 'youtube'],
    webhooks: {
      heygen: 'https://ownerfi.ai/api/webhooks/heygen/property',
      submagic: 'https://ownerfi.ai/api/webhooks/submagic/property'
    },
    avatarId: 'd33fe3abc2914faa88309c3bdb9f47f4',
    voiceId: '5bd25d00f41c477989e1e121a16986d3',
    features: {
      brolls: false,        // Keep property visible
      silenceRemoval: false, // Keep full script
      zooms: true
    }
  },
  // ... other brands
};
```

---

### RSS Feed Configuration

**File**: `/src/config/feed-sources.ts`

```typescript
export const RSS_FEEDS = {
  carz: [
    { url: 'https://www.motortrend.com/feed/', name: 'Motor Trend' },
    { url: 'https://www.caranddriver.com/rss/', name: 'Car and Driver' },
    // ... more feeds
  ],
  ownerfi: [
    { url: 'https://www.biggerpockets.com/blog/feed/', name: 'BiggerPockets' },
    { url: 'https://www.inman.com/feed/', name: 'Inman' },
    // ... more feeds
  ],
  vassdistro: [
    { url: 'https://vapingpost.com/feed/', name: 'Vaping Post' },
    // ... more feeds
  ]
};
```

---

## Troubleshooting Guide

### Common Issues & Solutions

#### 1. Workflow Stuck in `heygen_processing`

**Symptoms**:
- Workflow stays in `heygen_processing` for >30 minutes
- No HeyGen webhook received

**Causes**:
- HeyGen API failure
- Webhook URL misconfigured
- HeyGen processing timeout

**Solutions**:
1. Check HeyGen webhook configuration
2. Manually fetch video status via HeyGen API
3. Wait for failsafe cron (runs every 30 min)
4. Manual retry via admin dashboard

---

#### 2. Workflow Stuck in `submagic_processing`

**Symptoms**:
- Workflow stays in `submagic_processing` for >30 minutes
- Submagic webhook not firing

**Causes**:
- Export not triggered
- Submagic processing failure
- Webhook URL issue

**Solutions**:
1. Check Submagic webhook URL
2. Manually trigger export via Submagic API
3. Wait for failsafe cron
4. Check DLQ for failed webhook payloads

---

#### 3. Workflow Stuck in `video_processing`

**Symptoms**:
- Workflow stays in `video_processing` for >10 minutes
- Video not downloading/uploading

**Causes**:
- Expired Submagic download URL
- R2 upload failure
- Network timeout

**Solutions**:
1. Failsafe cron retries automatically (every 10 min)
2. Check R2 credentials
3. Verify Submagic project ID exists
4. Manual trigger via `/api/process-video`

---

#### 4. Workflow Stuck in `posting`

**Symptoms**:
- Workflow stays in `posting` for >10 minutes
- Late API not responding

**Causes**:
- Late API rate limit
- Missing connected accounts
- Network timeout

**Solutions**:
1. Failsafe cron retries (every 10 min)
2. Check Late.so account connections
3. Verify Late profile ID
4. Check Late API status

---

#### 5. "No video URL found" Error

**Symptoms**:
- Workflow fails with "No finalVideoUrl found"

**Causes**:
- R2 upload skipped
- Status changed too early

**Solutions**:
1. Failsafe cron reverts to `submagic_processing`
2. Retry R2 upload manually
3. Check workflow has `submagicDownloadUrl`

---

#### 6. Late API "Missing Account" Error

**Symptoms**:
- Posting fails with "No {platform} account found"

**Causes**:
- Account disconnected in Late.so
- Wrong profile ID

**Solutions**:
1. Reconnect account in Late.so dashboard
2. Verify profile ID in environment variables
3. Check brand platform mapping

---

#### 7. HeyGen Video Generation Fails

**Symptoms**:
- HeyGen webhook returns "avatar_video.fail"

**Causes**:
- Invalid avatar ID
- Script too long (>500 words)
- Invalid background image URL

**Solutions**:
1. Verify avatar ID exists
2. Check script length
3. Test background image URL
4. Check HeyGen account credits

---

#### 8. Submagic Export Fails

**Symptoms**:
- Submagic webhook #1 fires, export call fails

**Causes**:
- Invalid project ID
- Submagic API rate limit
- Project still processing

**Solutions**:
1. Check Submagic project status
2. Retry export after 30 seconds
3. Verify Submagic API key

---

### Debugging Tools

#### View Workflow Status
```bash
# Via Firestore Console
Collection: {brand}_workflow_queue
Document ID: workflow_abc123

# Via Admin Dashboard
https://ownerfi.ai/admin/social-dashboard
```

#### Check Webhook Logs
```bash
# Vercel Logs
vercel logs --follow

# Filter by webhook
vercel logs --grep "webhooks/heygen"
```

#### Manual API Calls
```bash
# Check HeyGen video status
curl -X GET "https://api.heygen.com/v2/video/{videoId}" \
  -H "Authorization: Bearer $HEYGEN_API_KEY"

# Check Submagic project status
curl -X GET "https://api.submagic.co/v1/projects/{projectId}" \
  -H "x-api-key: $SUBMAGIC_API_KEY"

# Check Late post status
curl -X GET "https://getlate.dev/api/v1/posts/{postId}" \
  -H "Authorization: Bearer $LATE_API_KEY"
```

---

### Performance Optimization

#### Reduce API Costs
1. **Minimize Retries**: Fix root causes instead of relying on failsafes
2. **Batch Operations**: Group API calls where possible
3. **Cache Results**: Store video URLs, avoid re-fetching
4. **Optimize Scripts**: Shorter scripts = cheaper HeyGen costs

#### Improve Success Rate
1. **Monitor Webhooks**: Set up alerts for webhook failures
2. **Test Regularly**: Verify all integrations weekly
3. **Update Credentials**: Rotate API keys before expiration
4. **Check Quotas**: Monitor rate limits and daily caps

---

## Summary

This social media automation system is a **production-grade, self-healing content pipeline** that:

✅ **Generates** AI-powered video content across 6 brands
✅ **Enhances** videos with professional captions and effects
✅ **Posts** to 10+ social platforms automatically
✅ **Recovers** from failures with comprehensive failsafes
✅ **Tracks** analytics and costs
✅ **Scales** to handle hundreds of videos per day

**Key Success Factors**:
1. **Brand Isolation**: Failures don't cascade
2. **Async Processing**: No webhook timeouts
3. **Status Tracking**: Clear progression through pipeline
4. **Failsafe Crons**: Multiple recovery layers
5. **Queue Management**: Respects platform limits

**Maintenance Requirements**:
- Monitor dashboards daily
- Review failed workflows weekly
- Update API keys as needed
- Optimize costs monthly
- Test integrations regularly

---

## File Reference Map

### Core API Routes
- `/src/app/api/webhooks/heygen/[brand]/route.ts` - HeyGen webhook handler
- `/src/app/api/webhooks/submagic/[brand]/route.ts` - Submagic webhook handler
- `/src/app/api/process-video/route.ts` - Async video processing
- `/src/app/api/cron/check-stuck-posting/route.ts` - Main failsafe
- `/src/app/api/cron/generate-video/route.ts` - Content generation

### Libraries
- `/src/lib/late-api.ts` (662 lines) - Late.so integration
- `/src/lib/heygen-client.ts` (397 lines) - HeyGen API
- `/src/lib/submagic-client.ts` - Submagic API
- `/src/lib/property-video-generator.ts` (575 lines) - Property scripts
- `/src/lib/benefit-video-generator.ts` (433 lines) - Benefit scripts
- `/src/lib/feed-store-firestore.ts` (1,770 lines) - Database operations
- `/src/lib/video-storage.ts` (365 lines) - R2 uploads
- `/src/lib/webhook-verification.ts` - Security
- `/src/lib/webhook-idempotency.ts` - Duplicate prevention
- `/src/lib/webhook-dlq.ts` - Dead letter queue
- `/src/lib/error-monitoring.ts` - Alerts & Slack
- `/src/lib/cost-tracker.ts` (656 lines) - Cost analytics

### Admin Pages
- `/src/app/admin/social-dashboard/page.tsx` - Main dashboard
- `/src/app/admin/workflow-failures/page.tsx` - Failed workflows
- `/src/app/admin/late-failures/page.tsx` - Late posting failures
- `/src/components/AnalyticsDashboard.tsx` - Performance metrics
- `/src/components/CostDashboard.tsx` - Cost tracking

---

**Last Updated**: 2025-01-15
**Version**: 1.0
**Author**: System Analysis by Claude Code
