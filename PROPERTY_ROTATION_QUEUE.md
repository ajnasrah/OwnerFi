# Property Rotation Queue System

## Concept: Infinite Loop Showcase

**Simple Logic:**
1. Add ALL active properties to queue (one time)
2. Cron picks next property from front of queue
3. Generate video and post
4. Re-add same property to BACK of queue
5. Repeat forever

**Result:** Every property gets showcased regularly in rotation!

---

## Queue Schema

```typescript
interface PropertyRotationQueue {
  id: string;                    // Same as propertyId
  propertyId: string;

  // Quick display info
  address: string;
  city: string;
  downPayment: number;

  // Queue position
  position: number;              // Lower = processes sooner
  lastVideoGenerated?: number;   // Timestamp of last video
  videoCount: number;            // How many times showcased

  // Status
  status: 'queued' | 'processing';
  updatedAt: number;
}
```

---

## How It Works

### Initial Setup (Run Once):
```typescript
// Add all active properties < $15k to queue
const properties = await getAllActiveProperties();

for (const property of properties) {
  await addToRotationQueue(property.id);
}

// Result: 50 properties in queue, ready to rotate
```

### Every Cron Run:
```typescript
1. Get property with lowest position number
2. Generate video for that property
3. After successful post:
   - Update position to MAX + 1 (sends to back of queue)
   - Increment videoCount
   - Update lastVideoGenerated timestamp
4. Next cron picks property with next lowest position
```

### Example Flow:
```
Initial Queue:
Position 1: Property A (123 Main St)
Position 2: Property B (456 Oak Ave)
Position 3: Property C (789 Elm St)
...
Position 50: Property Z

Cron Run 1: Generate video for Property A
→ Property A moves to position 51

Queue Now:
Position 2: Property B
Position 3: Property C
...
Position 50: Property Z
Position 51: Property A ← back in rotation

Cron Run 2: Generate video for Property B
→ Property B moves to position 52

And so on...
```

---

## Code Implementation

### Add to Queue:
```typescript
export async function addToPropertyRotationQueue(propertyId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  // Check if already in queue
  const existing = await getDoc(doc(db, 'property_rotation_queue', propertyId));
  if (existing.exists()) {
    console.log(`Property ${propertyId} already in rotation queue`);
    return;
  }

  // Get property data
  const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
  if (!propertyDoc.exists()) {
    throw new Error('Property not found');
  }

  const property = propertyDoc.data() as PropertyListing;

  // Get current max position
  const maxQuery = query(
    collection(db, 'property_rotation_queue'),
    orderBy('position', 'desc'),
    firestoreLimit(1)
  );
  const maxSnapshot = await getDocs(maxQuery);
  const maxPosition = maxSnapshot.empty ? 0 : maxSnapshot.docs[0].data().position;

  // Add to queue
  const queueItem = {
    id: propertyId,
    propertyId,
    address: property.address,
    city: property.city,
    downPayment: property.downPaymentAmount,
    position: maxPosition + 1,
    videoCount: 0,
    status: 'queued',
    updatedAt: Date.now()
  };

  await setDoc(doc(db, 'property_rotation_queue', propertyId), queueItem);
}
```

### Get Next Property:
```typescript
export async function getNextPropertyFromRotation(): Promise<PropertyRotationQueue | null> {
  if (!db) return null;

  const q = query(
    collection(db, 'property_rotation_queue'),
    where('status', '==', 'queued'),
    orderBy('position', 'asc'),
    firestoreLimit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const queueItem = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

  // Mark as processing
  await updateDoc(doc(db, 'property_rotation_queue', queueItem.id), {
    status: 'processing'
  });

  return queueItem;
}
```

### Send to Back of Queue:
```typescript
export async function sendPropertyToBackOfQueue(propertyId: string): Promise<void> {
  if (!db) return;

  // Get current max position
  const maxQuery = query(
    collection(db, 'property_rotation_queue'),
    orderBy('position', 'desc'),
    firestoreLimit(1)
  );
  const maxSnapshot = await getDocs(maxQuery);
  const maxPosition = maxSnapshot.empty ? 0 : maxSnapshot.docs[0].data().position;

  // Update this property to back of queue
  await updateDoc(doc(db, 'property_rotation_queue', propertyId), {
    position: maxPosition + 1,
    status: 'queued',
    lastVideoGenerated: Date.now(),
    videoCount: (existing.data()?.videoCount || 0) + 1,
    updatedAt: Date.now()
  });

  console.log(`✅ Property ${propertyId} moved to back of queue (position ${maxPosition + 1})`);
}
```

---

## Updated Cron Flow

```typescript
export async function GET(request: NextRequest) {
  // 1. Get next property from rotation
  const queueItem = await getNextPropertyFromRotation();

  if (!queueItem) {
    console.log('⚠️  Queue is empty!');
    return NextResponse.json({
      success: true,
      message: 'Queue empty - run populate script'
    });
  }

  // 2. Generate video for this property
  const response = await fetch(`${baseUrl}/api/property/generate-video`, {
    method: 'POST',
    body: JSON.stringify({ propertyId: queueItem.propertyId, variant: '15' })
  });

  const result = await response.json();

  if (result.success) {
    // 3. Send property to back of queue
    await sendPropertyToBackOfQueue(queueItem.propertyId);

    console.log(`✅ Property video generated and re-queued`);
    console.log(`   Video count for this property: ${queueItem.videoCount + 1}`);
  } else {
    // On error, also send to back (don't block queue)
    await sendPropertyToBackOfQueue(queueItem.propertyId);
    console.error(`❌ Failed but re-queued for next cycle`);
  }
}
```

---

## Population Script

```bash
# scripts/populate-property-rotation-queue.ts

# Finds all active properties < $15k and adds to rotation queue
# Run once to initialize, then queue manages itself

npx tsx scripts/populate-property-rotation-queue.ts
```

---

## Benefits

✅ **Every property gets showcased** - No property left behind
✅ **Continuous rotation** - Keeps showcasing same inventory
✅ **Simple logic** - Easy to understand and maintain
✅ **Self-sustaining** - No manual queue management needed
✅ **Track performance** - See how many times each property was shown
✅ **Add/remove anytime** - Just add new properties to queue when listed

---

## Example: 50 Properties

With 5 videos/day and 50 properties in rotation:
- Each property gets a video every **10 days**
- Continuous showcase of your entire inventory
- Fresh content every day
- Same properties = brand consistency

Want me to implement this now?
