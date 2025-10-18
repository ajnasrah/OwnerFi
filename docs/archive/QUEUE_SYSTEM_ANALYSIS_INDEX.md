# Queue System Analysis - Complete Documentation Index

## Overview

This directory contains comprehensive analysis of the OwnerFi social media and podcast generation system, specifically documenting where posts are created and how to integrate a queue system for better publishing control.

## Documentation Files

### 1. FINDINGS_SUMMARY.md
**Start here** - High-level overview of the entire system

Content:
- Key findings and current architecture
- Two parallel workflows (social media + podcast)
- Where posts are actually created
- Critical files for queue integration
- Supported platforms and formats
- Current limitations and opportunities
- Next steps for implementation

**Best for**: Getting a quick understanding of the system

---

### 2. SOCIAL_MEDIA_PODCAST_ARCHITECTURE.md
**Complete technical reference** - Detailed architecture documentation

Content:
- Full pipeline structure with diagrams
- Social media workflow breakdown (entry → queue → publishing)
- Podcast workflow breakdown (cron → script → publishing)
- HeyGen, Submagic, and Late API integration details
- Firestore data structures and collections
- Webhook flow diagrams
- Environment variables required
- Data storage architecture
- Queue opportunities and limitations

**Best for**: Understanding the complete system architecture and data flow

---

### 3. QUEUE_INTEGRATION_QUICK_REFERENCE.md
**Developer reference** - Quick lookup guide for implementation

Content:
- Directory structure of key files
- Most critical files with line numbers
- Data model interfaces (TypeScript)
- Firestore collection mappings
- Environment variables checklist
- Queue job types to implement
- Webhook integration points (exact locations)
- Current bottlenecks
- Testing procedures

**Best for**: Implementation work and developer reference

---

## Key Findings Summary

### Current System Architecture
```
Two Workflows:
├── Social Media: RSS Articles → HeyGen → Submagic → Late API → Social Platforms
└── Podcast: Cron → Script Gen → HeyGen → Submagic → Late API → Social Platforms

All posts created through: Late API (10+ platforms supported)
State stored in: Firestore (firebase)
Video processing: HeyGen (video), Submagic (captions), R2 (storage)
```

### Where Posts Are Created
**File**: `/src/app/api/webhooks/submagic/route.ts`
**Lines**: 155-268
**Function**: Submagic webhook handler calls `postToLate()`

### Critical Implementation Files
1. `src/lib/feed-store-firestore.ts` - Workflow queue management
2. `src/lib/late-api.ts` - Social media publishing API
3. `src/app/api/webhooks/submagic/route.ts` - Post creation webhook
4. `podcast/lib/podcast-scheduler.ts` - Podcast scheduling
5. `podcast/lib/podcast-publisher.ts` - Podcast publishing

---

## Quick Start for Queue Integration

### Phase 1: Understanding
1. Read: `FINDINGS_SUMMARY.md` (5 min)
2. Read: Section 1-3 of `SOCIAL_MEDIA_PODCAST_ARCHITECTURE.md` (15 min)
3. Reference: `QUEUE_INTEGRATION_QUICK_REFERENCE.md` as needed

### Phase 2: Analysis
1. Open: `/src/app/api/webhooks/submagic/route.ts` (lines 155-268)
2. Study: `postToLate()` function in `/src/lib/late-api.ts`
3. Check: Firestore workflow structures in `/src/lib/feed-store-firestore.ts`

### Phase 3: Implementation
1. Create: Publishing queue worker
2. Modify: Submagic webhook to enqueue instead of publish
3. Implement: Retry logic and dead letter queue
4. Test: Sample workflows end-to-end

---

## Firestore Collections Structure

### Social Media Workflows
- `carz_workflow_queue` - All Carz brand video workflows
- `ownerfi_workflow_queue` - All OwnerFi brand video workflows

**Status Flow**: pending → heygen_processing → submagic_processing → posting → completed

### Podcast Workflows
- `podcast_workflow_queue` - All podcast episode workflows
- `podcast_scheduler` - Global scheduler state

**Status Flow**: script_generation → heygen_processing → submagic_processing → publishing → completed

---

## Supported Platforms

Through Late API:
- Instagram (Reels/Stories/Feed)
- TikTok
- YouTube (Shorts/Videos)
- Facebook (Reels/Stories/Feed)
- LinkedIn
- Twitter/X
- Threads
- Bluesky
- Pinterest
- Reddit

---

## Environment Variables Required

```env
# For Late API publishing (REQUIRED)
LATE_API_KEY=...
LATE_OWNERFI_PROFILE_ID=...
LATE_CARZ_PROFILE_ID=...
LATE_PODCAST_PROFILE_ID=...

# For Firestore access (REQUIRED)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
FIREBASE_ADMIN_SDK_KEY=...

# For video processing (REQUIRED)
HEYGEN_API_KEY=...
SUBMAGIC_API_KEY=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
```

---

## Integration Point (Most Important)

**Current Code** (synchronous):
```typescript
// In /src/app/api/webhooks/submagic/route.ts, line 159
const postResult = await postToLate({
  videoUrl: publicVideoUrl,
  caption: workflow.caption,
  platforms: allPlatforms,
  scheduleTime: scheduledTime
});
```

**Queue Solution**:
```typescript
// Instead of awaiting, enqueue the job:
await updateWorkflowStatus(workflowId, brand, { 
  status: 'posting'  // Queue worker polls for this
});

// Separate worker process:
async function publishingWorker() {
  const jobs = await getWorkflowsByStatus('posting');
  for (const job of jobs) {
    try {
      const result = await postToLate(...);
      await updateWorkflowStatus(job.id, job.brand, {
        status: 'completed',
        latePostId: result.postId
      });
    } catch (error) {
      // Retry logic
    }
  }
}
```

---

## Queue Implementation Roadmap

### Week 1: Setup & Analysis
- [ ] Read all documentation
- [ ] Map current workflow in detail
- [ ] Set up queue infrastructure choice
- [ ] Design worker implementation

### Week 2: Core Implementation
- [ ] Create publishing queue worker
- [ ] Implement retry logic
- [ ] Add dead letter queue
- [ ] Update webhook handlers

### Week 3: Enhancement & Testing
- [ ] Add priority levels
- [ ] Implement rate limiting
- [ ] Add platform-specific scheduling
- [ ] End-to-end testing

### Week 4: Optimization & Monitoring
- [ ] Monitor Late API performance
- [ ] Optimize batch sizes
- [ ] Add alerting
- [ ] Performance tuning

---

## References & Related Files

### API Routes
- `/src/app/api/webhooks/heygen/route.ts` - HeyGen completion handler
- `/src/app/api/webhooks/submagic/route.ts` - Submagic completion handler
- `/src/app/api/podcast/cron/route.ts` - Podcast generation cron

### Libraries
- `/src/lib/late-api.ts` - Late API client
- `/src/lib/feed-store-firestore.ts` - Firestore operations
- `/podcast/lib/podcast-scheduler.ts` - Podcast scheduling
- `/podcast/lib/podcast-publisher.ts` - Podcast publishing

### Testing Utilities
- `/social-media/utils/post_to_social_now.js` - Direct posting test
- `/social-media/utils/complete_workflow_manual.js` - Full workflow test

---

## Questions & Answers

**Q: Where do posts get sent to social media?**
A: In `/src/app/api/webhooks/submagic/route.ts` when calling `postToLate()`

**Q: What's the current bottleneck for a queue system?**
A: Synchronous `await postToLate()` in webhook handler blocks function completion

**Q: Which database should the queue use?**
A: Use Firestore workflow items - already storing all state there

**Q: How many platforms does the system support?**
A: 10+ platforms through Late API: Instagram, TikTok, YouTube, Facebook, LinkedIn, Twitter, Threads, Bluesky, Pinterest, Reddit

**Q: What's the workflow state structure?**
A: Status field indicates stage: pending → heygen_processing → submagic_processing → posting → completed

**Q: Can I batch multiple posts?**
A: Yes, Late API supports it, but currently each post is sent individually

---

## Contact & Support

For questions about specific implementation details, refer to:
- `SOCIAL_MEDIA_PODCAST_ARCHITECTURE.md` - Detailed architecture
- `QUEUE_INTEGRATION_QUICK_REFERENCE.md` - Specific code locations
- Source code files with included comments

---

**Documentation Generated**: October 18, 2024
**Files Analyzed**: 26 production and test files
**Lines of Code Reviewed**: 3000+
**Platforms Supported**: 10+ social media channels

