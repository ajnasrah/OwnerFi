# Brand Coverage Verification - Workflow Fixes

## Date: 2025-01-08

## ✅ CONFIRMED: All 7 Brands Are Covered

### Complete List of Brands
1. **carz** - Carz Inc (automotive content)
2. **ownerfi** - OwnerFi (owner finance viral content)
3. **podcast** - Podcast episodes
4. **benefit** - Owner Finance Benefits (educational)
5. **property** - Property Showcase (15-sec property videos)
6. **vassdistro** - Vass Distro (vape wholesale B2B)
7. **abdullah** - Abdullah Personal Brand (daily content)

---

## Verification Checklist

### ✅ 1. Submagic Webhook Handler (`src/app/api/webhooks/submagic/[brand]/route.ts`)

**Function Signatures Include All 7 Brands:**
```typescript
brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit' | 'property' | 'vassdistro' | 'abdullah'
```

**Functions Verified:**
- `getWorkflowBySubmagicId()` - Line 258 ✅
- `updateWorkflowForBrand()` - Line 311 ✅
- `processVideoAndPost()` - Line 375 ✅
- `sendFailureAlert()` - Line 512 ✅

**Field Name Fallback Logic (Lines 242-258):**
```typescript
// Try BOTH field names to handle legacy workflows
// First try submagicProjectId (standardized field)
let snapshot = await adminDb
  .collection(collectionName)
  .where('submagicProjectId', '==', submagicProjectId)
  .limit(1)
  .get();

// If not found, try legacy field name submagicVideoId
if (snapshot.empty) {
  console.log(`   Trying legacy field submagicVideoId for brand ${brand}...`);
  snapshot = await adminDb
    .collection(collectionName)
    .where('submagicVideoId', '==', submagicProjectId)
    .limit(1)
    .get();
}
```

**Retry Logic (Lines 96-162):**
- Retries export trigger 3 times for ALL brands
- Exponential backoff: 2s, 4s, 8s
- Marks as `export_failed` only after all retries exhausted

---

### ✅ 2. HeyGen Webhook Handler (`src/app/api/webhooks/heygen/[brand]/route.ts`)

**Function Signatures Include All 7 Brands:**
```typescript
brand: 'carz' | 'ownerfi' | 'podcast' | 'benefit' | 'property' | 'vassdistro' | 'abdullah'
```

**Functions Verified:**
- `getWorkflowForBrand()` - Line 231 ✅
- `updateWorkflowForBrand()` - Line 261 ✅
- `triggerSubmagicProcessing()` - Line 282 ✅
- `sendFailureAlert()` - Line 475 ✅

**Timeout Protection (Lines 121-160):**
```typescript
// Wait up to 25 seconds for Submagic API call to complete
try {
  await Promise.race([
    triggerSubmagicProcessing(brand, workflowId, event_data.url, workflow),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Submagic trigger timeout after 25s')), 25000)
    )
  ]);
  console.log(`✅ [${brandConfig.displayName}] Submagic processing triggered successfully`);
} catch (err) {
  // Mark workflow as failed for ALL brands
  await updateWorkflowForBrand(brand, workflowId, {
    status: 'failed',
    error: `Submagic trigger failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    failedAt: Date.now()
  });
  return NextResponse.json({ success: false, error: ... }, { status: 500 });
}
```

**Sets Both Field Names (Lines 422-423):**
```typescript
submagicVideoId: projectId,
submagicProjectId: projectId, // For podcast compatibility
```

---

### ✅ 3. Brand Configurations (`src/config/brand-configs.ts`)

All 7 brands have complete configs with webhook URLs:

| Brand | Webhook URLs | Collection |
|-------|--------------|------------|
| **carz** | `/api/webhooks/heygen/carz`<br>`/api/webhooks/submagic/carz` | `carz_workflow_queue` |
| **ownerfi** | `/api/webhooks/heygen/ownerfi`<br>`/api/webhooks/submagic/ownerfi` | `ownerfi_workflow_queue` |
| **podcast** | `/api/webhooks/heygen/podcast`<br>`/api/webhooks/submagic/podcast` | `podcast_workflow_queue` |
| **benefit** | `/api/webhooks/heygen/benefit`<br>`/api/webhooks/submagic/benefit` | `benefit_workflow_queue` |
| **property** | `/api/webhooks/heygen/property`<br>`/api/webhooks/submagic/property` | `property_videos` |
| **vassdistro** | `/api/webhooks/heygen/vassdistro`<br>`/api/webhooks/submagic/vassdistro` | `vassdistro_workflow_queue` |
| **abdullah** | `/api/webhooks/heygen/abdullah`<br>`/api/webhooks/submagic/abdullah` | `abdullah_workflow_queue` |

---

### ✅ 4. GHL Webhook Handler (`src/app/api/gohighlevel/webhook/save-property/route.ts`)

**Undefined Value Stripping (Lines 654-657):**
```typescript
// Strip undefined values to prevent Firestore errors
const cleanPropertyData = Object.fromEntries(
  Object.entries(propertyData).filter(([_, value]) => value !== undefined)
);
```

**Applies to Property Creation:**
- Only affects `property` brand (properties saved via GHL webhook)
- Prevents Firebase errors for ALL properties

---

## Brand-Specific Workflow Collections

Each brand has its own isolated Firestore collection:

```typescript
CARZ:       carz_workflow_queue
OWNERFI:    ownerfi_workflow_queue
VASSDISTRO: vassdistro_workflow_queue
PODCAST:    podcast_workflow_queue
BENEFIT:    benefit_workflow_queue
PROPERTY:   property_videos        // Different collection name!
ABDULLAH:   abdullah_workflow_queue
```

**Collection Handling in getWorkflowBySubmagicId() (Lines 229-240):**
```typescript
let collectionName: string;
if (brand === 'podcast') {
  collectionName = 'podcast_workflow_queue';
} else if (brand === 'benefit') {
  collectionName = 'benefit_workflow_queue';
} else if (brand === 'property') {
  collectionName = 'property_videos';  // Special case!
} else if (brand === 'abdullah') {
  collectionName = 'abdullah_workflow_queue';
} else {
  collectionName = `${brand}_workflow_queue`;  // carz, ownerfi, vassdistro
}
```

---

## Fix Coverage Summary

### ✅ Field Name Inconsistency
- **Applies to:** ALL 7 brands
- **Solution:** Fallback logic tries both `submagicProjectId` and `submagicVideoId`
- **Location:** `src/app/api/webhooks/submagic/[brand]/route.ts` lines 242-258

### ✅ HeyGen Webhook Timeout Protection
- **Applies to:** ALL 7 brands
- **Solution:** 25-second timeout with proper error handling
- **Location:** `src/app/api/webhooks/heygen/[brand]/route.ts` lines 121-160

### ✅ Submagic Export Retry Logic
- **Applies to:** ALL 7 brands
- **Solution:** 3 retries with exponential backoff
- **Location:** `src/app/api/webhooks/submagic/[brand]/route.ts` lines 96-162

### ✅ Firestore Undefined Value Stripping
- **Applies to:** `property` brand (via GHL webhook)
- **Solution:** Filter out undefined values before writing
- **Location:** `src/app/api/gohighlevel/webhook/save-property/route.ts` lines 654-657

### ✅ Standardized Field Names Going Forward
- **Applies to:** ALL 7 brands
- **Solution:** HeyGen webhook sets BOTH field names
- **Location:** `src/app/api/webhooks/heygen/[brand]/route.ts` lines 422-423

---

## Test Each Brand

To verify fixes are working for each brand:

```bash
# Test carz workflow
curl -X POST https://ownerfi.ai/api/webhooks/heygen/carz

# Test ownerfi workflow
curl -X POST https://ownerfi.ai/api/webhooks/heygen/ownerfi

# Test podcast workflow
curl -X POST https://ownerfi.ai/api/webhooks/heygen/podcast

# Test benefit workflow
curl -X POST https://ownerfi.ai/api/webhooks/heygen/benefit

# Test property workflow
curl -X POST https://ownerfi.ai/api/webhooks/heygen/property

# Test vassdistro workflow
curl -X POST https://ownerfi.ai/api/webhooks/heygen/vassdistro

# Test abdullah workflow
curl -X POST https://ownerfi.ai/api/webhooks/heygen/abdullah
```

---

## Conclusion

✅ **ALL 7 BRANDS ARE FULLY COVERED** by the workflow fixes:

1. **carz** ✅
2. **ownerfi** ✅
3. **podcast** ✅
4. **benefit** ✅
5. **property** ✅
6. **vassdistro** ✅
7. **abdullah** ✅

All fixes apply universally across brands through type-safe TypeScript union types and conditional logic that handles each brand's specific collection and field requirements.
