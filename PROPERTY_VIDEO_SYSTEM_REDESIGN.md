# Property Video System Redesign

## Problem Analysis

The current system uses THREE different collections that are out of sync:

1. **`property_rotation_queue`** - Queue management (388 entries)
2. **`property_videos`** - Workflow tracking (817 entries, 776 PENDING!)
3. **`propertyShowcaseWorkflows`** - Empty (0 entries)

This causes:
- Properties added to queue but never processed
- 776 pending workflows stuck forever
- No actual videos being generated
- Confusion about which collection to use

## New Simplified Design

### ONE COLLECTION: `propertyShowcaseWorkflows`

All property video workflows will use a single collection that handles:
- Queue management (which property is next)
- Workflow tracking (HeyGen → Submagic → Post)
- History (how many times shown)
- Rotation logic (continuous cycling)

### Collection Schema

```typescript
interface PropertyShowcaseWorkflow {
  // Identity
  id: string;                    // Auto-generated workflow ID
  propertyId: string;            // Reference to properties collection

  // Queue Management
  queueStatus: 'queued' | 'processing' | 'completed_cycle';
  queuePosition: number;         // Position in queue (1 = next)
  queueAddedAt: number;          // When added to queue

  // Rotation Tracking
  totalVideosGenerated: number;  // Lifetime count
  currentCycleCount: number;     // Count for current cycle (resets each cycle)
  lastVideoGeneratedAt?: number; // Last time video was made

  // Workflow Status
  status: 'pending' | 'heygen_processing' | 'submagic_processing' | 'posting' | 'completed' | 'failed';

  // Property Data (cached for display)
  address: string;
  city: string;
  state: string;
  downPayment: number;
  monthlyPayment: number;

  // Video Details
  variant: '15sec' | '30sec';
  language: 'en' | 'es';
  script?: string;
  caption?: string;
  title?: string;

  // HeyGen
  heygenVideoId?: string;
  heygenVideoUrl?: string;
  heygenCompletedAt?: number;

  // Submagic
  submagicVideoId?: string;
  submagicDownloadUrl?: string;
  submagicCompletedAt?: number;

  // Final Video
  finalVideoUrl?: string;        // R2 URL

  // Posting
  latePostId?: string;
  platforms?: string[];
  scheduledFor?: number;
  postedAt?: number;

  // Error Tracking
  error?: string;
  retryCount?: number;
  lastRetryAt?: number;
  failedAt?: number;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
```

## Workflow Flow

1. **Property Added to Queue**
   - Create document in `propertyShowcaseWorkflows`
   - Set `queueStatus: 'queued'`, `status: 'pending'`
   - Assign `queuePosition` based on current queue

2. **Cron Picks Property**
   - Query for `queueStatus: 'queued'`, ordered by `queuePosition`
   - Update to `queueStatus: 'processing'`, `status: 'heygen_processing'`
   - Generate script, call HeyGen API
   - Save `heygenVideoId`

3. **HeyGen Webhook**
   - Receives video completion
   - Updates `heygenVideoUrl`, `status: 'submagic_processing'`
   - Triggers Submagic

4. **Submagic Webhook**
   - Receives edited video
   - Downloads to R2, updates `finalVideoUrl`
   - Updates `status: 'posting'`
   - Posts to social media

5. **Post Complete**
   - Updates `status: 'completed'`, `queueStatus: 'completed_cycle'`
   - Increments `totalVideosGenerated`, `currentCycleCount`

6. **Cycle Reset (when all queued properties completed)**
   - Query for `queueStatus: 'completed_cycle'`
   - Reset to `queueStatus: 'queued'`, `currentCycleCount: 0`
   - Reassign queue positions

## Migration Plan

1. **Cleanup Old Data**
   - Delete all from `property_videos`
   - Delete all from `property_rotation_queue`
   - Keep `properties` collection (source of truth)

2. **Populate New Queue**
   - Query active properties with images
   - Create `propertyShowcaseWorkflows` entries with `queueStatus: 'queued'`

3. **Update Code**
   - Simplify `feed-store-firestore.ts` functions
   - Update `property-video-service.ts` to use new collection
   - Update cron job
   - Webhooks already work (use `property_videos` which we'll repurpose)

4. **Testing**
   - Run single property through full workflow
   - Verify HeyGen → Submagic → Post flow
   - Test queue rotation
