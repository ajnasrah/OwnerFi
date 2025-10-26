# 🎥 Property Auto-Queue System

## Overview

New properties are **automatically added** to the video rotation queue when created or updated. This ensures all eligible properties get video coverage without manual intervention.

---

## ✅ How It Works

### Automatic Triggers

**1. When a property is CREATED** (`/api/admin/properties/create`)
   - ✅ Automatically adds to queue if:
     - `status === 'active'`
     - `isActive === true`
     - Has at least 1 image URL

**2. When a property is UPDATED** (`/api/admin/properties/[id]`)
   - ✅ Automatically adds to queue if it becomes eligible
   - ❌ Automatically removes from queue if it becomes ineligible

**3. Manual Add** (`/api/property/add-to-queue`)
   - POST with `propertyId` or `propertyIds` array
   - Can be called from external webhooks

---

## 🔄 Queue Rotation Logic

### Complete Cycle Guarantee

1. **Get Next Property**
   - Ordered by `position` (ascending)
   - Only properties with `status === 'queued'`

2. **After Video Generation**
   - Property marked as `completed`
   - Stays completed until **all 301 properties** finish

3. **Cycle Reset**
   - When all properties are `completed`
   - All reset to `queued` with fresh positions
   - Cycle count increments

4. **Fair Distribution**
   - 301 properties ÷ 5 videos/day = **61 days per cycle**
   - Every property gets equal exposure

---

## 📋 Eligibility Criteria

A property is eligible for the video queue if:

```typescript
✅ status === 'active'
✅ isActive === true
✅ imageUrls.length > 0
```

**Ineligible properties:**
```typescript
❌ status !== 'active'
❌ isActive === false
❌ No images
```

---

## 🛠️ API Endpoints

### 1. Add to Queue (Auto or Manual)

```bash
POST /api/property/add-to-queue
Authorization: Bearer {WEBHOOK_SECRET}

{
  "propertyId": "prop_123"
}

# OR batch add:
{
  "propertyIds": ["prop_123", "prop_456", "prop_789"]
}
```

**Response:**
```json
{
  "success": true,
  "added": 3,
  "skipped": 0,
  "errors": [],
  "properties": [
    {
      "id": "prop_123",
      "address": "123 Main St",
      "city": "Houston",
      "state": "TX"
    }
  ],
  "queueStats": {
    "total": 304,
    "queued": 303,
    "processing": 1
  }
}
```

### 2. Check Eligibility

```bash
GET /api/property/add-to-queue?propertyId=prop_123
```

**Response:**
```json
{
  "eligible": true,
  "checks": {
    "exists": true,
    "isActive": true,
    "hasImages": true
  },
  "property": {
    "id": "prop_123",
    "address": "123 Main St",
    "status": "active",
    "isActive": true,
    "imageCount": 3
  }
}
```

### 3. Populate Queue (Bulk Add)

```bash
POST /api/property/populate-queue
Authorization: Bearer {ADMIN_SECRET_KEY}
```

Adds ALL eligible properties from Firestore.

---

## 🔧 Implementation Details

### Created Endpoint
`/src/app/api/property/add-to-queue/route.ts`

### Modified Endpoints

**1. Property Creation**
`/src/app/api/admin/properties/create/route.ts` (lines 192-217)
- Auto-calls add-to-queue webhook after creation
- Non-blocking (won't fail property creation)

**2. Property Update**
`/src/app/api/admin/properties/[id]/route.ts` (lines 135-161)
- Auto-adds when property becomes eligible
- Auto-removes when property becomes ineligible

---

## 🎯 Workflow

```
┌─────────────────────────────────────────┐
│  Property Created/Updated in Firestore │
└───────────────┬─────────────────────────┘
                │
                ▼
      ┌─────────────────────┐
      │  Is Eligible?       │
      │  • active           │
      │  • has images       │
      └─────┬───────────────┘
            │
     ┌──────┴──────┐
     │             │
    YES           NO
     │             │
     ▼             ▼
┌────────────┐  ┌─────────────┐
│ Auto-Add   │  │ Skip or     │
│ to Queue   │  │ Remove from │
│            │  │ Queue       │
└────────────┘  └─────────────┘
     │
     ▼
┌───────────────────────────┐
│  Property in Queue        │
│  Status: queued           │
│  Position: 302            │
│  Waits for cron cycle     │
└───────────────────────────┘
     │
     ▼
┌───────────────────────────┐
│  Video Cron Runs          │
│  Generates video          │
│  Status: completed        │
└───────────────────────────┘
     │
     ▼
┌───────────────────────────┐
│  After all 301 complete   │
│  Cycle resets             │
│  Property back to queued  │
└───────────────────────────┘
```

---

## 📊 Monitoring

### Check Queue Stats

```bash
curl https://ownerfi.ai/api/property/populate-queue
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 301,
    "queued": 300,
    "processing": 1,
    "nextProperty": {
      "address": "123 Main St",
      "position": 2
    }
  },
  "rotationDays": 61
}
```

### Queue Cycle Progress

- **Total**: Total properties in queue
- **Queued**: Waiting for video
- **Processing**: Currently generating
- **Completed**: Done this cycle (not shown, calculated as: total - queued - processing)

---

## 🚫 Edge Cases Handled

### 1. Duplicate Prevention
✅ If property already in queue → skipped (not added again)

### 2. Inactive Properties
✅ If property becomes inactive → automatically removed from queue

### 3. Re-activation
✅ If property reactivated → automatically re-added to queue

### 4. Image Addition
✅ If images added to imageless property → automatically added to queue

### 5. Manual Override
✅ Can manually call `/api/property/add-to-queue` anytime

---

## 🔐 Security

**Auto-add calls** use internal webhook secret:
```
WEBHOOK_SECRET or CRON_SECRET
```

External webhooks must include:
```
Authorization: Bearer {WEBHOOK_SECRET}
```

---

## 🧪 Testing

### Test Auto-Add

```bash
# Create a property (will auto-add)
POST /api/admin/properties/create
{
  "address": "Test St",
  "city": "Austin",
  "state": "TX",
  ...
  "status": "active",
  "isActive": true,
  "imageUrls": "https://example.com/image.jpg"
}

# Check if added
GET /api/property/populate-queue
# Should show total + 1
```

### Test Auto-Remove

```bash
# Update property to inactive
PUT /api/admin/properties/{id}
{
  "isActive": false
}

# Check queue
GET /api/property/populate-queue
# Should show total - 1
```

---

## 📈 Performance

**Non-blocking design:**
- Property create/update completes immediately
- Queue add happens in background
- Failures don't affect property operations

**Scalability:**
- Can handle batch adds (array of propertyIds)
- Queue operations optimized with Firestore indexes

---

## ✅ Summary

| Feature | Status |
|---------|--------|
| Auto-add on create | ✅ Implemented |
| Auto-add on update | ✅ Implemented |
| Auto-remove on inactive | ✅ Implemented |
| Manual add endpoint | ✅ Implemented |
| Eligibility checking | ✅ Implemented |
| Complete cycle before repeat | ✅ Implemented |
| Batch operations | ✅ Implemented |

---

**Last Updated**: October 25, 2025
**Status**: ✅ Production Ready
**Automatic**: No manual intervention needed
