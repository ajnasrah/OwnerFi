# Social Media System Documentation

This document provides a comprehensive overview of the OwnerFi social media posting system for easy replication.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Supported Brands](#supported-brands)
3. [Supported Platforms](#supported-platforms)
4. [API Endpoints](#api-endpoints)
5. [Webhook Endpoints](#webhook-endpoints)
6. [Database Collections](#database-collections)
7. [Environment Variables](#environment-variables)
8. [Video Workflow Pipeline](#video-workflow-pipeline)
9. [Platform Scheduling](#platform-scheduling)
10. [Key Libraries](#key-libraries)

---

## System Overview

The system uses a **hybrid posting approach**:
- **YouTube**: Direct upload via Google YouTube Data API v3 (bypasses Late.dev to avoid quota limits)
- **All Other Platforms**: Late.dev API (Instagram, TikTok, Facebook, LinkedIn, Twitter, Threads, etc.)

### Video Generation Flow

```
1. Content Generated (Script/Article)
        ↓
2. HeyGen API → Avatar Video
        ↓
3. Webhook: /api/webhooks/heygen/[brand]
        ↓
4. Submagic API → Add Captions + B-rolls
        ↓
5. Webhook: /api/webhooks/submagic/[brand]
        ↓
6. Upload to R2 Storage
        ↓
7. Post to Social Media (Late.dev + YouTube Direct)
        ↓
8. Mark Workflow Complete
```

---

## Supported Brands

| Brand | Display Name | Late Profile ID Env Var | Workflow Collection |
|-------|-------------|------------------------|---------------------|
| `carz` | Carz Inc | `LATE_CARZ_PROFILE_ID` | `carz_workflow_queue` |
| `ownerfi` | OwnerFi | `LATE_OWNERFI_PROFILE_ID` | `ownerfi_workflow_queue` |
| `podcast` | Podcast | `LATE_PODCAST_PROFILE_ID` | `podcast_workflow_queue` |
| `benefit` | Owner Finance Benefits | `LATE_OWNERFI_PROFILE_ID` | `benefit_workflow_queue` |
| `property` | Property Showcase | `LATE_OWNERFI_PROFILE_ID` | `propertyShowcaseWorkflows` |
| `property-spanish` | Property (Spanish) | `LATE_OWNERFI_PROFILE_ID` | `propertyShowcaseWorkflows` |
| `vassdistro` | Vass Distro | `LATE_VASSDISTRO_PROFILE_ID` | `vassdistro_workflow_queue` |
| `abdullah` | Abdullah Personal | `LATE_ABDULLAH_PROFILE_ID` | `abdullah_workflow_queue` |
| `personal` | Personal Videos | `LATE_PERSONAL_PROFILE_ID` | `personal_workflow_queue` |

---

## Supported Platforms

### Via Late.dev API
- Instagram (Reels, Feed, Stories)
- TikTok
- YouTube (Shorts)
- Facebook (Feed, Stories)
- LinkedIn
- Twitter/X
- Threads
- Pinterest
- Reddit
- Bluesky

### Via Direct API (YouTube Only)
- YouTube Shorts - Direct upload using Google APIs library

---

## API Endpoints

### Late.dev Social Media Posting

**Base URL:** `https://getlate.dev/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/profiles` | List all Late profiles |
| `GET` | `/accounts?profileId={id}` | Get accounts for a profile |
| `POST` | `/posts` | Create and schedule social media post |
| `GET` | `/queue/next-slot?profileId={id}` | Get next available queue slot |
| `GET` | `/queue/slots?profileId={id}` | Get queue schedule |
| `PUT` | `/queue/slots` | Update queue schedule |

### Late.dev Post Request Body

```json
{
  "content": "Caption with hashtags",
  "platforms": [
    {
      "platform": "instagram",
      "accountId": "account_id_here",
      "platformSpecificData": {
        "contentType": "reel"
      }
    },
    {
      "platform": "youtube",
      "accountId": "account_id_here",
      "platformSpecificData": {
        "title": "Video Title",
        "category": "Howto & Style",
        "privacy": "public",
        "madeForKids": false,
        "short": true
      }
    }
  ],
  "mediaItems": [
    {
      "type": "video",
      "url": "https://video-url.mp4"
    }
  ],
  "queuedFromProfile": "profile_id",
  "timezone": "America/Chicago",
  "firstComment": "Optional first comment for engagement"
}
```

### YouTube Direct Upload (Bypassing Late.dev)

**File:** `src/lib/youtube-api.ts`

```typescript
import { uploadToYouTube, postVideoToYouTube } from '@/lib/youtube-api';

// Basic upload
const result = await uploadToYouTube({
  videoUrl: 'https://video-url.mp4',
  title: 'Video Title',
  description: 'Video description',
  tags: ['tag1', 'tag2'],
  category: 'Howto & Style', // or 'Autos & Vehicles', 'Education', etc.
  privacy: 'public',
  madeForKids: false,
  isShort: true,
  brand: 'ownerfi'
});

// With retry logic
const result = await postVideoToYouTube(
  'https://video-url.mp4',
  'Video Title',
  'Description',
  'ownerfi',
  {
    tags: ['realestate', 'ownerfinancing'],
    category: 'Howto & Style',
    privacy: 'public',
    madeForKids: false,
    isShort: true
  }
);
```

### Unified Posting (YouTube Direct + Late.dev)

**File:** `src/lib/unified-posting.ts`

```typescript
import { postToAllPlatforms } from '@/lib/unified-posting';

const result = await postToAllPlatforms({
  videoUrl: 'https://video-url.mp4',
  caption: 'Your caption here',
  title: 'Video Title',
  platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads', 'twitter'],
  brand: 'ownerfi',
  hashtags: ['realestate', 'ownerfinancing'],
  useQueue: true,
  timezone: 'America/Chicago',
  firstComment: 'Comment for engagement',
  youtubeCategory: 'Howto & Style',
  youtubeMadeForKids: false,
  youtubePrivacy: 'public'
});
```

### Internal API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/benefit/cron` | Generate buyer benefit videos (5x daily) |
| `GET/POST` | `/api/podcast/cron` | Generate podcast videos |
| `GET/POST` | `/api/property/video-cron` | Generate property videos (English) |
| `GET/POST` | `/api/property/video-cron-spanish` | Generate property videos (Spanish) |
| `GET/POST` | `/api/cron/sync-youtube-analytics` | Sync YouTube analytics |
| `GET` | `/api/analytics/youtube?brand={brand}` | Get YouTube analytics |
| `GET` | `/api/admin/late-failures?brand={brand}` | Get failed Late posts |
| `POST` | `/api/admin/retry-late-post` | Retry failed post |

---

## Webhook Endpoints

### HeyGen Video Completion Webhook

**Endpoint:** `POST /api/webhooks/heygen/[brand]`

**Brands:** `carz`, `ownerfi`, `podcast`, `benefit`, `property`, `property-spanish`, `vassdistro`, `abdullah`

**Request Headers:**
```
Content-Type: application/json
X-HeyGen-Signature: <optional signature>
```

**Request Payload:**
```json
{
  "event_type": "avatar_video.success",
  "event_data": {
    "video_id": "heygen-video-id-123",
    "url": "https://heygen.com/video/output.mp4",
    "callback_id": "workflow-id-here"
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "brand": "ownerfi",
  "event_type": "avatar_video.success",
  "workflow_id": "wf_ownerfi_1234567890_abc123",
  "processing_time_ms": 1234
}
```

**Processing Flow:**
1. Validates brand from URL path
2. Checks idempotency (prevents duplicate processing)
3. Saves HeyGen video URL to workflow document
4. Triggers Submagic processing with brand-specific webhook URL
5. Updates workflow status to `submagic_processing`

### Submagic Caption Completion Webhook

**Endpoint:** `POST /api/webhooks/submagic/[brand]`

**Brands:** `carz`, `ownerfi`, `vassdistro`, `property`, `property-spanish`, `abdullah`, `personal`

**Request Payload (Initial Completion - Captions Done):**
```json
{
  "projectId": "submagic-project-id-123",
  "status": "completed"
}
```

**Request Payload (Export Completion - Video Ready):**
```json
{
  "projectId": "submagic-project-id-123",
  "status": "completed",
  "downloadUrl": "https://submagic.com/exports/video.mp4"
}
```

**Processing Flow:**
1. If no `downloadUrl`: Triggers `/export` to generate final video
2. If has `downloadUrl`:
   - Saves Submagic URL to workflow
   - Triggers async video processing (upload to R2 + post to social)
   - Updates workflow status to `video_processing`

### GoHighLevel Webhooks

**Property Match:** `POST /api/webhooks/gohighlevel/property-match`
**Property:** `POST /api/webhooks/gohighlevel/property`
**Agent Response:** `POST /api/webhooks/gohighlevel/agent-response`

---

## Database Collections

### Firestore Collections

| Collection | Brand | Description |
|------------|-------|-------------|
| `carz_workflow_queue` | carz | Carz video workflows |
| `ownerfi_workflow_queue` | ownerfi | OwnerFi video workflows |
| `podcast_workflow_queue` | podcast | Podcast video workflows |
| `benefit_workflow_queue` | benefit | Buyer benefit video workflows |
| `propertyShowcaseWorkflows` | property, property-spanish | Property showcase workflows |
| `vassdistro_workflow_queue` | vassdistro | VassDistro video workflows |
| `abdullah_workflow_queue` | abdullah | Abdullah personal brand workflows |
| `personal_workflow_queue` | personal | Personal video workflows |
| `late_failures` | all | Failed Late posting attempts |
| `youtube_analytics` | all | Cached YouTube analytics |
| `workflow_analytics` | all | Cross-platform performance metrics |

### Workflow Document Schema

```typescript
interface Workflow {
  // Status tracking
  status: 'pending' | 'heygen_processing' | 'submagic_processing' |
          'video_processing' | 'posting' | 'complete' | 'failed';

  // HeyGen data
  heygenVideoId?: string;
  heygenVideoUrl?: string;
  heygenCompletedAt?: number;

  // Submagic data
  submagicVideoId?: string;
  submagicProjectId?: string;
  submagicDownloadUrl?: string;

  // Final video
  finalVideoUrl?: string;

  // Social posting
  latePostId?: string;
  scheduledFor?: string;
  platformsUsed?: number;

  // Content
  caption?: string;
  title?: string;
  script?: string;
  hashtags?: string[];
  platforms?: string[];

  // Metadata
  brand: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  failedAt?: number;
  error?: string;
}
```

### Late Failure Document Schema

```typescript
interface LateFailure {
  id: string;
  postId?: string;
  brand: string;
  profileId?: string;
  platforms: string[];
  failedPlatforms?: string[];
  caption: string;
  videoUrl?: string;
  error: string;
  timestamp: Date;
  retryCount: number;
  lastRetryAt?: Date;
  status: 'failed' | 'retrying' | 'resolved';
  workflowId?: string;
}
```

---

## Environment Variables

### Required for Late.dev

```bash
# Late.dev API Key
LATE_API_KEY=your_late_api_key

# Brand-specific Late Profile IDs
LATE_OWNERFI_PROFILE_ID=profile_id_here
LATE_CARZ_PROFILE_ID=profile_id_here
LATE_PODCAST_PROFILE_ID=profile_id_here
LATE_VASSDISTRO_PROFILE_ID=profile_id_here
LATE_ABDULLAH_PROFILE_ID=profile_id_here
LATE_PERSONAL_PROFILE_ID=profile_id_here
```

### Required for YouTube Direct Upload

```bash
# Shared OAuth credentials (same app, different channels)
YOUTUBE_CLIENT_ID=your_google_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_google_oauth_client_secret

# Brand-specific refresh tokens (one per YouTube channel)
YOUTUBE_ABDUL_REFRESH_TOKEN=refresh_token_for_abdullah_channel
YOUTUBE_OWNERFI_REFRESH_TOKEN=refresh_token_for_ownerfi_channel
YOUTUBE_CARZ_REFRESH_TOKEN=refresh_token_for_carz_channel
```

### Required for Video Generation

```bash
# HeyGen (Avatar video generation)
HEYGEN_API_KEY=your_heygen_api_key

# Submagic (Auto-captions + B-rolls)
SUBMAGIC_API_KEY=your_submagic_api_key
```

### Required for System

```bash
# Firebase
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Base URL for webhooks
NEXT_PUBLIC_BASE_URL=https://ownerfi.ai
# OR fallback to:
VERCEL_URL=your-project.vercel.app

# Cron Authorization
CRON_SECRET=your_secret_for_cron_auth
```

---

## Video Workflow Pipeline

### 1. HeyGen Video Generation

```typescript
// Trigger HeyGen video generation
const response = await fetch('https://api.heygen.com/v2/video/generate', {
  method: 'POST',
  headers: {
    'X-Api-Key': process.env.HEYGEN_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    video_inputs: [...],
    callback_id: workflowId, // Links back to workflow
    callback_url: `${BASE_URL}/api/webhooks/heygen/${brand}`
  })
});
```

### 2. Submagic Caption Processing

```typescript
// After HeyGen completes, trigger Submagic
const response = await fetch('https://api.submagic.co/v1/projects', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.SUBMAGIC_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Video Title',
    language: 'en', // or 'es' for Spanish
    videoUrl: heygenVideoUrl,
    webhookUrl: `${BASE_URL}/api/webhooks/submagic/${brand}`,
    templateName: 'Hormozi 2',
    magicZooms: true,
    magicBrolls: true, // false for property/podcast
    magicBrollsPercentage: 75,
    removeSilencePace: 'fast', // 'natural' for property
    removeBadTakes: true
  })
});
```

### 3. Export Final Video

```typescript
// After captions complete, trigger export
const response = await fetch(`https://api.submagic.co/v1/projects/${projectId}/export`, {
  method: 'POST',
  headers: {
    'x-api-key': process.env.SUBMAGIC_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    webhookUrl: `${BASE_URL}/api/webhooks/submagic/${brand}`
  })
});
```

### 4. Upload to R2 Storage

```typescript
import { uploadSubmagicVideo } from '@/lib/video-storage';

const publicVideoUrl = await uploadSubmagicVideo(
  submagicDownloadUrl,
  `${brand}/submagic-videos/${workflowId}.mp4`
);
```

### 5. Post to Social Media

```typescript
import { postToLate } from '@/lib/late-api';

const result = await postToLate({
  videoUrl: publicVideoUrl,
  caption: workflow.caption,
  title: workflow.title,
  platforms: ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'threads'],
  brand: 'ownerfi',
  useQueue: true,
  timezone: 'America/Chicago'
});
```

---

## Platform Scheduling

The system uses **3 platform groups** for optimal engagement:

### Platform Groups

| Group | Platforms | Time (CST) | Rationale |
|-------|-----------|------------|-----------|
| Professional | LinkedIn, Twitter, Bluesky | 8 AM | B2B morning audience |
| Midday | Facebook, YouTube | 1 PM | Lunch/afternoon break |
| Evening | Instagram, TikTok, Threads | 7 PM | Peak entertainment time |

### VassDistro Exception
- Evening group posts at **5 PM CST** (B2B audience ends workday earlier)

### Implementation

```typescript
import { postToMultiplePlatformGroups } from '@/lib/platform-scheduling';

const result = await postToMultiplePlatformGroups(
  videoUrl,
  caption,
  title,
  'ownerfi', // brand
  {
    firstComment: 'Comment for engagement boost',
    hashtags: ['realestate', 'ownerfinancing']
  }
);
```

---

## Key Libraries

### Core Social Media Libraries

| File | Purpose |
|------|---------|
| `src/lib/late-api.ts` | Late.dev API integration |
| `src/lib/youtube-api.ts` | Direct YouTube upload API |
| `src/lib/unified-posting.ts` | Multi-platform posting orchestration |
| `src/lib/platform-scheduling.ts` | Platform group scheduling |

### Brand Configuration

| File | Purpose |
|------|---------|
| `src/config/brand-configs.ts` | All brand configurations |
| `src/lib/brand-utils.ts` | Brand utility functions |
| `src/config/constants.ts` | Brand type definitions |

### Video Processing

| File | Purpose |
|------|---------|
| `src/lib/video-storage.ts` | R2 video upload/storage |
| `src/lib/cost-tracker.ts` | Service cost tracking |

### Webhook Handlers

| File | Purpose |
|------|---------|
| `src/app/api/webhooks/heygen/[brand]/route.ts` | HeyGen completion handler |
| `src/app/api/webhooks/submagic/[brand]/route.ts` | Submagic completion handler |

### Analytics

| File | Purpose |
|------|---------|
| `src/lib/youtube-analytics.ts` | YouTube analytics fetching |
| `src/lib/late-analytics.ts` | Late.dev analytics sync |

---

## Replication Checklist

To replicate this system for a new project:

### 1. Environment Setup
- [ ] Create Late.dev account and profiles for each brand
- [ ] Get Google Cloud OAuth credentials for YouTube
- [ ] Set up refresh tokens for each YouTube channel
- [ ] Get HeyGen API key
- [ ] Get Submagic API key
- [ ] Set up Firebase/Firestore project
- [ ] Configure R2 (or S3) storage

### 2. Copy Core Libraries
- [ ] `src/lib/late-api.ts`
- [ ] `src/lib/youtube-api.ts`
- [ ] `src/lib/unified-posting.ts`
- [ ] `src/lib/platform-scheduling.ts`
- [ ] `src/lib/video-storage.ts`
- [ ] `src/lib/api-utils.ts` (for retry/circuit breaker)

### 3. Copy Configuration
- [ ] `src/config/brand-configs.ts` (modify for your brands)
- [ ] `src/lib/brand-utils.ts`

### 4. Copy Webhook Handlers
- [ ] `src/app/api/webhooks/heygen/[brand]/route.ts`
- [ ] `src/app/api/webhooks/submagic/[brand]/route.ts`

### 5. Set Up Environment Variables
- [ ] All Late.dev API keys and profile IDs
- [ ] All YouTube OAuth credentials
- [ ] HeyGen and Submagic API keys
- [ ] Firebase credentials
- [ ] Base URL for webhooks

### 6. Configure Cron Jobs
- [ ] Set up scheduled triggers for content generation
- [ ] Configure YouTube analytics sync

---

## Cost Tracking

Monthly costs tracked in `src/lib/cost-tracker.ts`:

| Service | Monthly Cost | Unit Cost |
|---------|-------------|-----------|
| HeyGen | $330/month | ~$0.50 per video |
| Submagic | $150/month | ~$0.25 per video |
| Late.dev | $50/month | Unlimited posts |
| YouTube | Free | Quota-based |

---

## Error Handling

### Idempotency
- Webhooks use `src/lib/webhook-idempotency.ts` to prevent duplicate processing
- Each HeyGen video ID is checked before processing

### Dead Letter Queue
- Failed webhooks are logged to `src/lib/webhook-dlq.ts`
- Can be reprocessed later

### Late Failure Recovery
- Failed posts logged to `late_failures` collection
- Retry via `/api/admin/retry-late-post`

### Circuit Breaker
- `src/lib/api-utils.ts` implements circuit breaker pattern
- Prevents cascading failures to external APIs
