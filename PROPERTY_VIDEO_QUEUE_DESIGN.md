# Property Video Queue System Design

## Problem with Current System

**Current Logic:**
```typescript
// Every cron run:
1. Query ALL properties < $15k down
2. For each, check if video exists
3. Pick lowest down payment + newest
4. Generate video
```

**Issues:**
- ❌ No manual control over which properties get videos
- ❌ Expensive queries (N+1 problem)
- ❌ Can't prioritize featured properties
- ❌ Can't schedule videos in advance
- ❌ No way to skip bad properties
- ❌ Uses Admin SDK in cron (inconsistent)

---

## Proposed Solution: Property Video Queue

### Architecture (Same as Articles):

```
Properties Collection
  ↓ (Manual/Automatic)
Add to Queue
  ↓
property_video_queue Collection
  ↓ (Cron picks from queue)
Generate Video
  ↓
property_videos Collection (Workflow tracking)
  ↓
HeyGen → Submagic → Late → Posted
```

---

## Database Schema

### Collection: `property_video_queue`

```typescript
interface PropertyVideoQueueItem {
  id: string;                       // queue_{timestamp}_{random}
  propertyId: string;              // Reference to property

  // Property snapshot (for display)
  address: string;
  city: string;
  state: string;
  downPayment: number;
  monthlyPayment: number;
  imageUrl: string;                // First image

  // Queue metadata
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  priority: number;                // 1-10 (10 = highest)
  addedBy: 'auto' | 'manual';      // How it was added
  addedAt: number;
  processedAt?: number;

  // Workflow tracking
  workflowId?: string;             // Links to property_videos doc
  videoUrl?: string;               // Final video after posted
  latePostId?: string;
  error?: string;

  // Admin controls
  notes?: string;                  // Admin notes
  featured: boolean;               // Bump to front of queue
}
```

---

## Queue Functions

### Add to Queue:

```typescript
export async function addPropertyToVideoQueue(
  propertyId: string,
  priority: number = 5,
  addedBy: 'auto' | 'manual' = 'auto'
): Promise<PropertyVideoQueueItem> {
  if (!db) throw new Error('Firebase not initialized');

  // Get property data
  const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
  if (!propertyDoc.exists()) {
    throw new Error('Property not found');
  }

  const property = propertyDoc.data() as PropertyListing;

  // Check if already in queue
  const existing = await getDocs(query(
    collection(db, 'property_video_queue'),
    where('propertyId', '==', propertyId),
    where('status', 'in', ['queued', 'processing'])
  ));

  if (!existing.empty) {
    throw new Error('Property already in video queue');
  }

  // Create queue item
  const queueItem: PropertyVideoQueueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    propertyId,
    address: property.address,
    city: property.city,
    state: property.state,
    downPayment: property.downPaymentAmount,
    monthlyPayment: property.monthlyPayment,
    imageUrl: property.imageUrls[0] || '',
    status: 'queued',
    priority,
    addedBy,
    addedAt: Date.now(),
    featured: false
  };

  await setDoc(doc(db, 'property_video_queue', queueItem.id), queueItem);
  console.log(`✅ Added property to video queue: ${property.address}`);

  return queueItem;
}
```

### Get Next Property from Queue:

```typescript
export async function getNextPropertyFromQueue(): Promise<PropertyVideoQueueItem | null> {
  if (!db) return null;

  // Get highest priority queued properties
  const q = query(
    collection(db, 'property_video_queue'),
    where('status', '==', 'queued'),
    orderBy('featured', 'desc'),  // Featured first
    orderBy('priority', 'desc'),   // Then by priority
    orderBy('addedAt', 'asc'),    // Then FIFO
    firestoreLimit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const queueItem = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PropertyVideoQueueItem;

  // Mark as processing
  await updateDoc(doc(db, 'property_video_queue', queueItem.id), {
    status: 'processing',
    processingStartedAt: Date.now()
  });

  return queueItem;
}
```

### Auto-Add Eligible Properties:

```typescript
export async function autoAddEligibleProperties(limit: number = 10): Promise<number> {
  if (!db) return 0;

  // Find properties that should be in queue but aren't
  const propertiesQuery = query(
    collection(db, 'properties'),
    where('status', '==', 'active'),
    where('isActive', '==', true),
    where('downPaymentAmount', '<', 15000),
    orderBy('downPaymentAmount', 'asc'),
    orderBy('dateAdded', 'desc'),
    firestoreLimit(limit * 2) // Get extras to filter
  );

  const snapshot = await getDocs(propertiesQuery);
  let added = 0;

  for (const docSnap of snapshot.docs) {
    if (added >= limit) break;

    const property = docSnap.data() as PropertyListing;

    // Check if property is eligible
    if (!isEligibleForVideo(property)) continue;

    // Check if already in queue
    const inQueue = await getDocs(query(
      collection(db, 'property_video_queue'),
      where('propertyId', '==', docSnap.id),
      firestoreLimit(1)
    ));

    if (!inQueue.empty) continue;

    // Check if video already exists
    const hasVideo = await getDocs(query(
      collection(db, 'property_videos'),
      where('propertyId', '==', docSnap.id),
      where('status', '==', 'completed'),
      firestoreLimit(1)
    ));

    if (!hasVideo.empty) continue;

    // Add to queue
    await addPropertyToVideoQueue(docSnap.id, 5, 'auto');
    added++;
  }

  console.log(`✅ Auto-added ${added} properties to video queue`);
  return added;
}
```

---

## Updated Cron Logic

### Old (Direct Query):
```typescript
// Query properties directly
const propertiesSnapshot = await admin.firestore()
  .collection('properties')
  .where('downPaymentAmount', '<', 15000)
  .get();

// Filter and pick
// Generate video
```

### New (Queue-Based):
```typescript
// Get next property from queue
const queueItem = await getNextPropertyFromQueue();

if (!queueItem) {
  console.log('Queue empty - auto-adding properties...');
  await autoAddEligibleProperties(10);

  // Try again
  queueItem = await getNextPropertyFromQueue();
}

if (queueItem) {
  // Generate video for this property
  // Update queue item status
}
```

---

## Benefits of Queue System

### Manual Control:
✅ Admins can add specific properties to queue
✅ Priority system (1-10)
✅ Featured flag for urgent properties
✅ Can skip/remove bad properties
✅ Notes field for tracking

### Better Performance:
✅ Single query to get next property (not N+1)
✅ No duplicate video checks every cron
✅ Pre-filtered and ready to process

### Automation:
✅ Auto-fills queue when empty
✅ Maintains steady video flow
✅ Handles edge cases gracefully

### Visibility:
✅ See what's coming up in dashboard
✅ Track queue depth
✅ Monitor processing status

---

## Admin UI (Dashboard)

### Property Video Queue Tab:

```
┌─────────────────────────────────────────────────────────┐
│ Property Video Queue (15 properties)                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ [ Add Property to Queue ]  [ Auto-Fill Queue (10) ]     │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔥 123 Main St, Houston TX | $9,500 down            │ │
│ │    Priority: 10 | Featured | Added: Manual          │ │
│ │    [Skip] [Edit Priority] [Remove]                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 456 Oak Ave, Dallas TX | $12,000 down               │ │
│ │    Priority: 7 | Added: Auto | Processing...        │ │
│ │    [Skip] [Edit Priority] [Remove]                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 789 Elm St, Austin TX | $14,500 down                │ │
│ │    Priority: 5 | Added: Auto                        │ │
│ │    [Skip] [Edit Priority] [Remove]                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Queue Functions (30 min)
1. Add PropertyVideoQueueItem interface to feed-store-firestore.ts
2. Add addPropertyToVideoQueue()
3. Add getNextPropertyFromQueue()
4. Add autoAddEligibleProperties()
5. Add updatePropertyQueueStatus()

### Phase 2: Update Cron (15 min)
1. Replace direct property query with queue logic
2. Auto-fill queue when empty
3. Update queue item status after processing

### Phase 3: Admin UI (1 hour)
1. Add Property Video Queue tab to dashboard
2. Manual add property form
3. Auto-fill button
4. Priority editing
5. Skip/remove controls

---

## Migration Strategy

### Initial Queue Population:

```bash
# Run once to populate queue with existing eligible properties
curl -X POST https://ownerfi.ai/api/admin/property-queue/populate \
  -H "Authorization: Bearer ${ADMIN_SECRET}" \
  -d '{"limit": 50}'
```

This finds all eligible properties and adds them to queue with priority based on:
- Down payment (lower = higher priority)
- Date added (newer = higher priority)
- Featured status

---

## Want Me to Implement This?

I can:
1. Add all queue functions to feed-store-firestore.ts
2. Update property cron to use queue
3. Create admin endpoint to populate queue
4. Add manual queue management functions

This will give you full control over which properties get videos and when!

Should I proceed?
