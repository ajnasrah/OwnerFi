# Queue Integration - Quick Reference Guide

## Directory Structure of Key Files

```
ownerfi/
├── src/
│   ├── lib/
│   │   ├── feed-store-firestore.ts          # Workflow queue management
│   │   ├── late-api.ts                      # Social media publishing API
│   │   └── video-storage.ts                 # R2 upload management
│   └── app/api/
│       ├── webhooks/
│       │   ├── heygen/route.ts              # HeyGen callback handler
│       │   └── submagic/route.ts            # WHERE POSTS ARE CREATED
│       └── podcast/
│           └── cron/route.ts                # Podcast generation trigger
│
├── podcast/
│   ├── lib/
│   │   ├── script-generator.ts              # GPT-4 script generation
│   │   ├── podcast-scheduler.ts             # Episode scheduling
│   │   └── podcast-publisher.ts             # Publishing logic
│   └── config/
│       ├── guest-profiles.json              # Guest definitions
│       └── scheduler-state.json             # Scheduler state
│
└── social-media/
    ├── utils/
    │   ├── post_to_social_now.js            # Direct posting utility
    │   └── complete_workflow_manual.js      # Manual workflow test
    └── scripts/
        └── get-late-profile-ids.js          # Profile ID retrieval
```

## Most Critical Files for Queue System

### 1. Where Posts Are Actually Created
```
FILE: /src/app/api/webhooks/submagic/route.ts
LINES: 155-268
WHY: This is the production code that calls postToLate()
CURRENT FLOW:
  - Submagic webhook arrives
  - Download/upload video to R2
  - Call postToLate() with caption + platforms
  - Update workflow status
QUEUE INTEGRATION: Move postToLate() call to queue job
```

### 2. Late API Client (All Platform Publishing)
```
FILE: /src/lib/late-api.ts
FUNCTION: postToLate() - Line 154
WHY: Entry point for all social media platform publishing
SUPPORTED PLATFORMS:
  - Instagram (Reels/Stories)
  - TikTok
  - YouTube (Shorts)
  - Facebook (Feed/Reels/Stories)
  - LinkedIn, Twitter, Threads, Bluesky, Pinterest, Reddit
QUEUE INTEGRATION: Create separate queue worker for this
```

### 3. Workflow Status Management
```
FILE: /src/lib/feed-store-firestore.ts
FUNCTIONS:
  - addWorkflowToQueue() - Line 316
  - updateWorkflowStatus() - Line 336
  - getWorkflowQueueStats() - Line 351
  - findWorkflowBySubmagicId() - Line 779
WHY: Manages all workflow state in Firestore
STATUS FLOW:
  pending → heygen_processing → submagic_processing → posting → completed
QUEUE INTEGRATION: Queue worker updates these statuses
```

### 4. Podcast Queue Management
```
FILE: /src/lib/feed-store-firestore.ts
FUNCTIONS:
  - addPodcastWorkflow() - Line 671
  - updatePodcastWorkflow() - Line 690
  - getPodcastWorkflowById() - Line 863
COLLECTION: podcast_workflow_queue
STATUS FLOW:
  script_generation → heygen_processing → submagic_processing → publishing → completed
QUEUE INTEGRATION: Separate queue for podcast episodes
```

## Data Models

### Social Media Workflow Item
```typescript
interface WorkflowQueueItem {
  id: string;                    // wf_${timestamp}_${random}
  articleId: string;
  brand: 'carz' | 'ownerfi';
  status: 'pending' | 'heygen_processing' | 'submagic_processing' | 'posting' | 'completed' | 'failed';
  articleTitle: string;
  heygenVideoId?: string;        // From HeyGen callback
  submagicVideoId?: string;      // From Submagic submission
  latePostId?: string;           // From Late API response
  finalVideoUrl?: string;        // R2 public URL after processing
  caption?: string;              // Post caption text
  title?: string;                // Post title
  scheduledFor?: number;         // Unix timestamp for scheduling
  platforms?: string[];          // Which platforms were posted to
  retryCount?: number;           // Number of retry attempts
  lastRetryAt?: number;
  error?: string;                // Error message if failed
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
```

### Podcast Workflow Item
```typescript
interface PodcastWorkflowItem {
  id: string;                    // podcast_${timestamp}_${random}
  episodeNumber: number;
  episodeTitle: string;
  guestName: string;
  topic: string;
  status: 'script_generation' | 'heygen_processing' | 'submagic_processing' | 'publishing' | 'completed' | 'failed';
  heygenVideoId?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;
  latePostId?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
```

## Firestore Collections

```
Social Media (by brand):
  - carz_workflow_queue       (status-indexed queries)
  - ownerfi_workflow_queue    (status-indexed queries)

Podcast:
  - podcast_workflow_queue    (status-indexed queries)
  - podcast_scheduler         (global state document)

Media Storage Metadata:
  - (stored in R2, referenced by URLs in workflow items)
```

## Environment Variables for Queue Integration

```env
# Late API (Required for all publishing)
LATE_API_KEY=<api_key>
LATE_OWNERFI_PROFILE_ID=<profile_id>
LATE_CARZ_PROFILE_ID=<profile_id>
LATE_PODCAST_PROFILE_ID=<profile_id>

# R2 Storage (For video processing)
R2_ACCOUNT_ID=<account_id>
R2_ACCESS_KEY_ID=<access_key>
R2_SECRET_ACCESS_KEY=<secret_key>
R2_BUCKET_NAME=<bucket_name>

# HeyGen (For video generation)
HEYGEN_API_KEY=<api_key>

# Submagic (For caption processing)
SUBMAGIC_API_KEY=<api_key>

# Firebase (For Firestore access)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project_id>
FIREBASE_ADMIN_SDK_KEY=<admin_sdk_key>  # For backend queue workers

# Podcast (For cron generation)
OPENAI_API_KEY=<api_key>
CRON_SECRET=<cron_secret>
```

## Queue Job Types to Implement

### 1. Social Media Publishing Job
```typescript
interface PublishToSocialJob {
  type: 'PUBLISH_TO_SOCIAL',
  workflowId: string,
  brand: 'carz' | 'ownerfi',
  videoUrl: string,             // R2 public URL
  caption: string,
  title: string,
  platforms: string[],          // instagram, tiktok, youtube, etc.
  scheduledFor?: string,        // ISO timestamp
  retryCount?: number,
  maxRetries?: number
}
```

### 2. Podcast Publishing Job
```typescript
interface PublishPodcastJob {
  type: 'PUBLISH_PODCAST',
  workflowId: string,
  episodeNumber: number,
  videoUrl: string,             // R2 public URL
  episodeTitle: string,
  guestName: string,
  topic: string,
  platforms?: string[],         // Defaults to all podcast platforms
  scheduledFor?: string,
  retryCount?: number,
  maxRetries?: number
}
```

### 3. Retry Failed Publishing Job
```typescript
interface RetryPublishingJob {
  type: 'RETRY_PUBLISHING',
  workflowId: string,
  workflowType: 'social_media' | 'podcast',
  brand?: 'carz' | 'ownerfi',
  retryCount: number,
  lastError?: string
}
```

## Webhook Integration Points

### HeyGen Webhook Flow
```
HeyGen generates video
  ↓
POST /api/webhooks/heygen
  ├─ Find workflow by callback_id
  ├─ Download video from HeyGen URL
  ├─ Upload to R2 (get public URL)
  ├─ Submit to Submagic with webhook callback
  └─ Update workflow status: submagic_processing
```

### Submagic Webhook Flow
```
Submagic completes captioning
  ↓
POST /api/webhooks/submagic
  ├─ Find workflow by Submagic project ID
  ├─ Download processed video from Submagic
  ├─ Upload to R2 (get public URL)
  ├─ QUEUE POINT: Add PublishToSocialJob or PublishPodcastJob
  └─ Update workflow status: posting
```

**NOTE**: Currently line 159 in submagic/route.ts calls `postToLate()` directly.
**TO QUEUE**: Change to `enqueuePublishingJob(workflow, videoUrl, caption, platforms)`

## Current Bottlenecks for Queue System

### 1. Synchronous Publishing
- **Problem**: Webhook handler waits for Late API response
- **Solution**: Queue job + async processing

### 2. No Priority Handling
- **Problem**: All posts treated equally
- **Solution**: Queue with priority levels (podcast > trending > regular)

### 3. Limited Retry Strategy
- **Problem**: Basic retry in Late API client
- **Solution**: Exponential backoff queue

### 4. No Rate Limiting
- **Problem**: Could hit platform rate limits
- **Solution**: Queue with per-platform rate limiting

### 5. No Batch Processing
- **Problem**: Each post sent individually
- **Solution**: Batch similar posts per platform

## How to Test Queue Integration

1. **Test Single Publishing Job**:
   ```
   Trigger: POST /api/webhooks/submagic with sample payload
   Check: Queue job created in queue system
   Check: Workflow status updated to 'posting'
   ```

2. **Test Retry Logic**:
   ```
   Trigger: Late API failure
   Check: Job moved to retry queue
   Check: Exponential backoff applied
   ```

3. **Test Podcast Publishing**:
   ```
   Trigger: Podcast cron completes
   Check: PublishPodcastJob queued
   Check: Episode published to all platforms
   ```

## Files NOT to Modify (Keep External Webhooks)

- `/src/app/api/webhooks/heygen/route.ts` - Keep webhook handler
- `/src/app/api/webhooks/submagic/route.ts` - Keep webhook handler
- `/src/app/api/podcast/cron/route.ts` - Keep cron endpoint

**ONLY modify the `postToLate()` call in submagic webhook to enqueue job instead**

