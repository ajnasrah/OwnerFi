# Social Media & Podcast Generation Architecture Analysis

## Executive Summary

The system currently has **two separate but complementary workflows** for content generation and social media publishing:

1. **Social Media Video Generation** - Article-driven workflow
2. **Podcast Generation** - Episode-driven workflow with AI scripting

Both workflows follow a **webhook-based pipeline** architecture that automatically chains together multiple services.

---

## Architecture Overview

### Current Pipeline Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SOCIAL MEDIA WORKFLOW                         │
└─────────────────────────────────────────────────────────────────────┘

RSS Article → Queue → HeyGen (video) → Webhook → Submagic (captions)
              ↓                                          ↓
         Status: pending                        Webhook callback
              ↓                                          ↓
    Firestore Tracking                    Status: submagic_processing
                                                    ↓
                                        Late API (All Platforms) ← Scheduled Publishing
                                                    ↓
                                          Status: completed


┌─────────────────────────────────────────────────────────────────────┐
│                      PODCAST WORKFLOW                              │
└─────────────────────────────────────────────────────────────────────┘

Cron (5x daily) → Script Gen → HeyGen (video) → Webhook → Submagic (captions)
                                              ↓               ↓
                            Status: heygen_processing   Webhook callback
                                              ↓               ↓
                                  Firestore Tracking  Status: submagic_processing
                                                           ↓
                                            Late API (All Platforms) ← Scheduled Publishing
                                                           ↓
                                              Status: completed
```

---

## 1. SOCIAL MEDIA VIDEO GENERATION WORKFLOW

### 1.1 Entry Point & Queue Management

**Location**: `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/feed-store-firestore.ts`

**Workflow Queue Structure**:
```typescript
interface WorkflowQueueItem {
  id: string;
  articleId: string;
  brand: 'carz' | 'ownerfi';
  status: 'pending' | 'heygen_processing' | 'submagic_processing' | 'posting' | 'completed' | 'failed';
  articleTitle: string;
  heygenVideoId?: string;
  submagicVideoId?: string;
  latePostId?: string;  // Post ID from Late API
  finalVideoUrl?: string;
  caption?: string;
  title?: string;
  scheduledFor?: number;  // Unix timestamp for scheduling
  platforms?: string[];
  retryCount?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
```

**Firestore Collections**:
- `carz_workflow_queue` - Carz brand workflows
- `ownerfi_workflow_queue` - OwnerFi brand workflows
- Both follow same structure

**Queue Functions**:
- `addWorkflowToQueue(articleId, articleTitle, brand)` - Add to queue
- `updateWorkflowStatus(workflowId, brand, updates)` - Update status
- `getWorkflowQueueStats()` - Get queue statistics
- `getWorkflowById(workflowId)` - Retrieve workflow
- `findWorkflowBySubmagicId()` - Find by Submagic project ID (for webhooks)

**Current Statuses**:
```
pending → heygen_processing → submagic_processing → posting → completed
                                                         ↓
                                                      failed (at any stage)
```

### 1.2 HeyGen Video Generation

**Location**: `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/podcast/cron/route.ts` (line 182-200)

**Entry Points**:
- API calls to HeyGen V2 API
- Multi-scene format: `video_inputs` array with multiple scenes
- Each scene has character (avatar/talking_photo) and voice

**API Call Structure**:
```typescript
POST https://api.heygen.com/v2/video/generate
{
  test: false,
  caption: false,
  callback_id: workflow.id,           // ← Workflow ID for webhook callback
  webhook_url: "https://ownerfi.ai/api/webhooks/heygen",
  video_inputs: [                      // ← Array of scenes
    {
      character: { avatar_id, avatar_style },
      voice: { type: 'text', input_text, voice_id }
    },
    ...
  ],
  dimension: { width: 1080, height: 1920 }
}
```

**Webhook Callback**:
- Event Type: `avatar_video.success` or `avatar_video.fail`
- Returns: `video_id` and `url` (video file location)
- Handled by: `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/webhooks/heygen/route.ts`

### 1.3 Submagic Caption Processing

**Location**: `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/webhooks/heygen/route.ts` (line 123-264)

**Trigger**: HeyGen webhook completion → `triggerSubmagicProcessing()`

**Process**:
1. Download HeyGen video from URL
2. Upload to Cloudflare R2 (public URL needed for Submagic)
3. Submit to Submagic API with webhook callback

**API Call**:
```typescript
POST https://api.submagic.co/v1/projects
{
  title: workflow.articleTitle,           // Max 50 characters
  language: 'en',
  videoUrl: r2PublicUrl,                 // ← Must be public URL
  templateName: 'Hormozi 2',
  magicBrolls: true,
  magicBrollsPercentage: 50,
  magicZooms: true,
  webhookUrl: "https://ownerfi.ai/api/webhooks/submagic"
}
```

**Workflow Status**: `submagic_processing` (after Submagic project created)

**Webhook Callback**:
- Event: `completed` or `failed`
- Returns: `media_url` or `video_url` (processed video with captions)
- Handled by: `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/webhooks/submagic/route.ts`

### 1.4 Late API Social Media Publishing

**Location**: `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/late-api.ts`

**Entry Point**: Submagic webhook completion → `postToLate()`

**Supported Platforms**:
- Instagram (Reels/Stories)
- TikTok
- YouTube (Shorts)
- Facebook (Feed/Reels/Stories)
- LinkedIn
- Twitter/X
- Threads
- Bluesky
- Pinterest
- Reddit

**Late API Call**:
```typescript
POST https://getlate.dev/api/v1/posts
{
  content: caption,
  platforms: [
    {
      platform: 'instagram',
      accountId: profile_account_id,
      platformSpecificData: { contentType: 'reel' }  // or 'story'
    },
    ...
  ],
  mediaItems: [{ type: 'video', url: publicVideoUrl }],
  scheduledFor: ISO8601_timestamp,  // Optional, omit for immediate
  timezone: 'America/New_York',
  publishNow: true  // If no scheduledFor
}
```

**Profile IDs** (from environment):
- `LATE_OWNERFI_PROFILE_ID` - OwnerFi brand
- `LATE_CARZ_PROFILE_ID` - Carz brand
- `LATE_PODCAST_PROFILE_ID` - Podcast brand

**Scheduling**:
- Optional `scheduledFor` timestamp in ISO 8601 format
- Uses `getNextAvailableTimeSlot()` to calculate optimal posting time
- Default timezone: Eastern Time

**Response**:
```typescript
{
  success: boolean,
  postId: string,
  scheduledFor?: string,
  platforms: string[],
  error?: string
}
```

### 1.5 Current Post Creation Points

**Files that directly create posts**:

1. **Manual Test Files** (for testing):
   - `/Users/abdullahabunasrah/Desktop/ownerfi/social-media/utils/post_to_social_now.js`
   - `/Users/abdullahabunasrah/Desktop/ownerfi/social-media/utils/complete_workflow_manual.js`

2. **Production Webhook Handler**:
   - `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/webhooks/submagic/route.ts` (lines 155-268)
   - This is where **ACTUAL posts are created** in production

3. **Social Media Utils**:
   - `postToLate()` in `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/late-api.ts`

---

## 2. PODCAST GENERATION WORKFLOW

### 2.1 Entry Point - Cron Trigger

**Location**: `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/podcast/cron/route.ts`

**Trigger Configuration**:
- Runs 5x daily (9 AM, 12 PM, 3 PM, 6 PM, 9 PM CDT)
- Max 3 episodes per day
- Controlled via `PodcastScheduler`

**Cron Authorization**:
- Vercel cron: `user-agent: vercel-cron/1.0`
- API Secret: `Authorization: Bearer ${CRON_SECRET}`
- Dashboard: Same-origin requests

**Process Flow**:
```
1. Verify authorization + check scheduler
2. Create podcast workflow record
3. Generate script (GPT-4) → Select random guest
4. Generate HeyGen video (multi-scene)
5. Record episode number in scheduler
6. Webhook continues: HeyGen → Submagic → Late
```

### 2.2 Podcast Workflow Queue

**Location**: `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/feed-store-firestore.ts` (line 654-702)

**Podcast Workflow Structure**:
```typescript
interface PodcastWorkflowItem {
  id: string;
  episodeNumber: number;
  episodeTitle: string;
  guestName: string;
  topic: string;
  status: 'script_generation' | 'heygen_processing' | 'submagic_processing' | 'publishing' | 'completed' | 'failed';
  heygenVideoId?: string;
  submagicProjectId?: string;
  finalVideoUrl?: string;
  latePostId?: string;  // Late API post ID
  error?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
```

**Firestore Collection**: `podcast_workflow_queue`

**Queue Functions**:
- `addPodcastWorkflow(episodeNumber, episodeTitle)` - Create workflow
- `updatePodcastWorkflow(workflowId, updates)` - Update status
- `getPodcastWorkflows(limit)` - Get active workflows
- `getPodcastWorkflowById(workflowId)` - Get by ID
- `findPodcastBySubmagicId(submagicProjectId)` - Find by Submagic ID

### 2.3 Podcast Script Generation

**Location**: `/Users/abdullahabunasrah/Desktop/ownerfi/podcast/lib/script-generator.ts`

**Features**:
- Uses GPT-4 to generate educational Q&A content
- Randomly selects guest from profile database
- Tracks "recent guests" to avoid repetition (last 4)

**Guest Profiles**:
- File: `/Users/abdullahabunasrah/Desktop/ownerfi/podcast/config/guest-profiles.json`
- Types: Doctors, Real Estate Agents, Car Salesmen, Financial Advisors, Tech Experts, Fitness Trainers

**Scheduler State**:
- Firestore: `podcast_scheduler` collection
- Tracks: Last episode number, recent guests, episode list
- Per-day episode limits (3 episodes max)

### 2.4 Podcast Publishing Strategy

**Location**: `/Users/abdullahabunasrah/Desktop/ownerfi/podcast/lib/podcast-publisher.ts`

**Publishing Options**:
1. **Long-Form Video** (full episode):
   - Platforms: YouTube, Facebook
   - Uses `scheduleVideoPost()`

2. **Short-Form Clips** (if available):
   - Platforms: Instagram Reels, TikTok, YouTube Shorts, LinkedIn, Twitter, Threads, Bluesky
   - Uses `postToLate()` directly

**Caption Template**:
```
🎙️ NEW EPISODE ALERT!

{Guest} drops INSANE knowledge about {Topic}!

You won't believe what we uncovered in this conversation...

#podcast #{topic} #education #viral #mustwatch
```

### 2.5 Scheduling

**Location**: `/Users/abdullahabunasrah/Desktop/ownerfi/podcast/lib/podcast-scheduler.ts`

**Configuration**:
```typescript
const DEFAULT_SCHEDULE = {
  frequency: 'daily',
  episodes_per_day: 3,
  timezone: 'America/Chicago',
  enabled: true
};
```

**Next Time Slot Calculation**:
- Uses `getNextAvailableTimeSlot()` from feed-store-firestore
- Respects daily episode limits
- Timezone-aware scheduling

---

## 3. WEBHOOK FLOW DIAGRAM

### HeyGen Webhook Handler
**File**: `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/webhooks/heygen/route.ts`

```
HeyGen Webhook (POST)
├─ Extract: event_type, event_data (video_id, url, callback_id)
├─ Find workflow by callback_id
│  ├─ Check social media workflows (carz_workflow_queue, ownerfi_workflow_queue)
│  └─ Fallback to podcast workflows (podcast_workflow_queue)
├─ If success (avatar_video.success):
│  ├─ Download video from HeyGen URL
│  ├─ Upload to R2 (get public URL)
│  ├─ Submit to Submagic API with webhook callback
│  └─ Update workflow: status = 'submagic_processing'
└─ If failed (avatar_video.fail):
   └─ Update workflow: status = 'failed'
```

### Submagic Webhook Handler
**File**: `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/webhooks/submagic/route.ts`

```
Submagic Webhook (POST)
├─ Extract: projectId, status, video_url
├─ Find workflow by Submagic project ID
│  ├─ Check social media workflows
│  └─ Fallback to podcast workflows
├─ If completed:
│  ├─ Download video from Submagic (has captions)
│  ├─ Upload to R2 (get public URL)
│  ├─ If PODCAST:
│  │  ├─ Get next scheduling slot
│  │  ├─ POST to Late: [facebook, instagram, tiktok, youtube, linkedin, threads, twitter]
│  │  └─ Update: status = 'completed'
│  └─ If SOCIAL MEDIA:
│     ├─ Get next scheduling slot
│     ├─ Add platform-specific configs
│     ├─ POST to Late: [all platforms for brand]
│     └─ Update: status = 'completed'
└─ If failed:
   └─ Update: status = 'failed'
```

---

## 4. DATA STORAGE LOCATIONS

### Firestore Collections

**Social Media Collections** (by brand):
```
carz_rss_feeds           - RSS feed subscriptions
carz_articles            - Fetched articles
carz_workflow_queue      - Video workflow queue

ownerfi_rss_feeds        - RSS feed subscriptions
ownerfi_articles         - Fetched articles
ownerfi_workflow_queue   - Video workflow queue
```

**Podcast Collections**:
```
podcast_workflow_queue   - Podcast episode workflows
podcast_scheduler        - Scheduler state (episode count, recent guests)
```

**Other Collections**:
```
podcast_profiles         - Host and guest avatar configurations
```

### Video Storage
- **Temporary**: HeyGen direct URLs (short-lived)
- **Processed**: R2 (Cloudflare) public URLs for Submagic
- **Final**: R2 URLs for Late API posting

---

## 5. ENVIRONMENT VARIABLES REQUIRED

### Late API Configuration
```env
LATE_API_KEY=<api_key>
LATE_OWNERFI_PROFILE_ID=<profile_id>
LATE_CARZ_PROFILE_ID=<profile_id>
LATE_PODCAST_PROFILE_ID=<profile_id>
```

### HeyGen Configuration
```env
HEYGEN_API_KEY=<api_key>
```

### Submagic Configuration
```env
SUBMAGIC_API_KEY=<api_key>
```

### Podcast Configuration
```env
OPENAI_API_KEY=<api_key>  # For script generation
CRON_SECRET=<secret>       # For cron authentication
```

### Firebase Configuration
```env
NEXT_PUBLIC_FIREBASE_API_KEY=<key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<domain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<bucket>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<id>
NEXT_PUBLIC_FIREBASE_APP_ID=<id>
```

### Base URL Configuration
```env
NEXT_PUBLIC_BASE_URL=https://ownerfi.ai
# OR
VERCEL_URL=<deployment_url>
```

---

## 6. FILES TO INTEGRATE WITH QUEUE SYSTEM

### Critical Files for Queue Integration

1. **Workflow Management**:
   - `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/feed-store-firestore.ts`
   - Functions: `addWorkflowToQueue()`, `updateWorkflowStatus()`, `getWorkflowById()`

2. **Webhook Handlers** (where posts are actually created):
   - `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/webhooks/submagic/route.ts`
   - Lines 155-268: Actual Late API posting logic

3. **Late API Client**:
   - `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/late-api.ts`
   - Function: `postToLate()` - Entry point for all platform postings

4. **Podcast Scheduler**:
   - `/Users/abdullahabunasrah/Desktop/ownerfi/podcast/lib/podcast-scheduler.ts`
   - Function: `recordEpisode()`, `shouldGenerateEpisode()`

5. **Podcast Publisher**:
   - `/Users/abdullahabunasrah/Desktop/ownerfi/podcast/lib/podcast-publisher.ts`
   - Functions: `publishEpisode()`, `publishClips()`

### Test/Reference Files

1. Manual Testing:
   - `/Users/abdullahabunasrah/Desktop/ownerfi/social-media/utils/post_to_social_now.js`
   - `/Users/abdullahabunasrah/Desktop/ownerfi/social-media/utils/complete_workflow_manual.js`

2. Cron Entry Points:
   - `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/podcast/cron/route.ts`

---

## 7. CURRENT LIMITATIONS & QUEUE OPPORTUNITIES

### Current Approach (Webhook-based)
- **Pros**: Real-time processing, automatic chaining
- **Cons**: 
  - No priority handling
  - No batching capability
  - Limited retry strategies
  - Difficult to test/debug
  - No rate limiting between services

### Queue System Integration Points

1. **Pre-Publishing Queue**:
   - Buffer posts before sending to Late API
   - Implement scheduling rules per platform
   - Rate limit by platform (e.g., max 3 posts/hour to Twitter)

2. **Retry Queue**:
   - Currently uses basic retry in Late API
   - Could use exponential backoff
   - Better failure tracking

3. **Batch Publishing**:
   - Group similar content for efficiency
   - Coordinate cross-platform publishing
   - Stagger posts across platforms

4. **Priority Handling**:
   - Podcast episodes (higher priority)
   - Time-sensitive articles (trending)
   - Regular social media content (lower priority)

---

## Key Observations for Queue Implementation

1. **Status Flow** is already structured for queue processing:
   - `pending → heygen_processing → submagic_processing → posting → completed`
   - Easily maps to queue worker statuses

2. **Workflow ID** is unique per item:
   - `wf_${Date.now()}_${randomString}`
   - `podcast_${Date.now()}_${randomString}`
   - Good for queue tracking

3. **Firestore is the State Store**:
   - All workflow state stored in Firestore
   - Perfect for distributed queue workers
   - No need for separate database

4. **Late API is Final Publisher**:
   - All platforms go through single Late API
   - Perfect bottleneck for queue management
   - Can batch/throttle at this layer

5. **Webhook Handlers Currently Synchronous**:
   - `postToLate()` is awaited in webhook handler
   - Could be moved to queue for async processing

