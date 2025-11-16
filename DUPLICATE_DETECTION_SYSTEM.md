# Duplicate Detection System - Complete Analysis

## Overview
The system uses **3 different data points** to detect duplicates at **different stages** of the pipeline.

---

## 🎯 Stage 1: Queue Entry (URL-Based)

### When Adding to Queue (Bookmarklet/Manual)

**Data Point**: `url` (Zillow property URL)

**Location**: `/api/scraper/add-to-queue` (Owner Finance) & `/api/scraper/add-to-cash-queue` (Cash Deals)

**Logic**:
```typescript
// Check 1: Is URL already in the queue?
const existingInQueue = await db
  .collection('scraper_queue')
  .where('url', '==', url)
  .limit(1)
  .get();

if (!existingInQueue.empty) {
  return 'URL already in queue';
}

// Check 2: Was URL already scraped?
const existingInImports = await db
  .collection('zillow_imports')
  .where('url', '==', url)
  .limit(1)
  .get();

if (!existingInImports.empty) {
  return 'URL already scraped and imported';
}
```

**Purpose**: Prevent same URL from being queued multiple times

**Collections Checked**:
- `scraper_queue` - Pending URLs
- `zillow_imports` - Already scraped properties
- `cash_deals_queue` - Cash deals queue (for cash system)
- `cash_houses` - Already scraped cash properties

---

## 🎯 Stage 2: Apify Search Results (URL-Based)

### When Search Scraper Runs

**Data Point**: `url` (detailUrl from Apify search scraper)

**Location**: `/api/cron/run-search-scraper` (line 75-96)

**Logic**:
```typescript
for (const item of items) {
  const detailUrl = property.detailUrl; // From Apify search results

  // Check 1: Already in queue?
  const existingInQueue = await db
    .collection('scraper_queue')
    .where('url', '==', detailUrl)
    .limit(1)
    .get();

  if (!existingInQueue.empty) {
    alreadyInQueue++;
    continue;
  }

  // Check 2: Already scraped?
  const existingInImports = await db
    .collection('zillow_imports')
    .where('url', '==', detailUrl)
    .limit(1)
    .get();

  if (!existingInImports.empty) {
    alreadyScraped++;
    continue;
  }

  // Add to queue
  await db.collection('scraper_queue').add({ url: detailUrl, ... });
}
```

**Purpose**: Prevent search scraper from re-queuing already processed URLs

---

## 🎯 Stage 3: Property Processing (ZPID-Based)

### When Queue Processor Runs

**Data Point**: `zpid` (Zillow Property ID - numeric)

**Location**: `/api/cron/process-scraper-queue` (lines 160-228)

**Logic**:
```typescript
// Step 1: Extract all ZPIDs from Apify results
const zpids = items.map((item: any) => item.zpid).filter(Boolean);
// Example: [2056118632, 2067891234, 2078945612]

// Step 2: Batch check existing ZPIDs (Firestore 'in' limit = 10)
const existingZillowZpids = new Set<number>();
const existingCashHousesZpids = new Set<number>();

for (let i = 0; i < zpids.length; i += 10) {
  const batchZpids = zpids.slice(i, i + 10);

  // Check zillow_imports
  const zillowSnap = await db
    .collection('zillow_imports')
    .where('zpid', 'in', batchZpids)
    .get();

  zillowSnap.docs.forEach(doc => {
    existingZillowZpids.add(doc.data().zpid);
  });

  // Check cash_houses (cross-scraper duplicate check)
  const cashHousesSnap = await db
    .collection('cash_houses')
    .where('zpid', 'in', batchZpids)
    .get();

  cashHousesSnap.docs.forEach(doc => {
    existingCashHousesZpids.add(doc.data().zpid);
  });
}

// Step 3: Skip duplicates when saving
for (const item of items) {
  const propertyData = transformApifyProperty(item);

  if (existingZillowZpids.has(propertyData.zpid)) {
    metrics.duplicatesSkipped++;
    console.log(`⏭️ Skipping duplicate ZPID ${propertyData.zpid}`);
    continue;
  }

  // Save property...
}
```

**Purpose**: Prevent same property from being saved multiple times (even if URL changes)

**Why ZPID instead of URL?**
- URLs can change (Zillow sometimes updates URLs)
- ZPID is Zillow's permanent property identifier
- More reliable for deduplication

**Collections Checked**:
- `zillow_imports` - Owner finance properties
- `cash_houses` - Cash deals + needs work properties

---

## 🎯 Stage 4: Manual CSV Uploads (Address-Based)

### When Admin Uploads Properties

**Data Point**: `address + city + state` (combined string)

**Location**: `/api/admin/properties/deduplicate` (lines 100-131)

**Logic**:
```typescript
// Create unique key from address components
const propertyMap = new Map<string, Property[]>();

for (const property of properties) {
  const key = `${property.address}_${property.city}_${property.state}`.toLowerCase();

  if (!propertyMap.has(key)) {
    propertyMap.set(key, []);
  }

  propertyMap.get(key)!.push(property);
}

// Find duplicates (groups with more than 1 property)
const duplicateGroups: DuplicateGroup[] = [];

for (const [key, properties] of propertyMap) {
  if (properties.length > 1) {
    // Found duplicates! Keep newest, delete rest
    const sorted = properties.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    duplicateGroups.push({
      key,
      keepId: sorted[0].id,  // Newest property
      deleteIds: sorted.slice(1).map(p => p.id)  // Older duplicates
    });
  }
}
```

**Purpose**: Find and remove duplicate properties in the `properties` collection

---

## 📊 Complete Duplicate Detection Matrix

| Stage | Data Point | Collections Checked | When It Runs | System |
|-------|-----------|-------------------|--------------|--------|
| **Queue Entry** | `url` | `scraper_queue`, `zillow_imports` | Bookmarklet add | Owner Finance |
| **Queue Entry** | `url` | `cash_deals_queue`, `cash_houses` | Chrome extension | Cash Deals |
| **Search Results** | `url` | `scraper_queue`, `zillow_imports` | Search scraper (Mon/Thu 9am) | Owner Finance |
| **Property Processing** | `zpid` | `zillow_imports`, `cash_houses` | Queue processor (7x/day) | Both |
| **Property Processing** | `zpid` | `cash_houses` | Cash processor (on-demand) | Cash Deals |
| **Manual Upload** | `address+city+state` | `properties` | Admin CSV upload | Properties |

---

## 🔍 Why Multiple Data Points?

### URL Detection (Stages 1-2)
- **Fast**: Single field lookup
- **Early**: Prevents unnecessary Apify scraping
- **Cheap**: No API costs if duplicate caught here

### ZPID Detection (Stage 3)
- **Reliable**: Zillow's permanent ID (doesn't change)
- **Cross-scraper**: Checks both owner finance AND cash deals
- **Handles URL changes**: Same property, different URL

### Address Detection (Stage 4)
- **Manual uploads**: CSVs may not have URL or ZPID
- **Flexible**: Works with incomplete data
- **Cleanup**: Finds duplicates after import

---

## 🎯 Example: Complete Flow

### Scenario: Property Gets Added Twice

**First Time (Bookmarklet)**:
```
1. URL: https://zillow.com/homedetails/123-main-st/2056118632_zpid/
   ├─ Check scraper_queue: ❌ Not found
   ├─ Check zillow_imports: ❌ Not found
   └─ ✅ ADD to scraper_queue

2. Queue Processor runs:
   ├─ Apify scrapes property
   ├─ ZPID: 2056118632
   ├─ Check zillow_imports by ZPID: ❌ Not found
   ├─ Check cash_houses by ZPID: ❌ Not found
   └─ ✅ SAVE to zillow_imports with Firestore ID: "a7B3xK9mQ2pL5nR8cY1D"
```

**Second Time (Same URL)**:
```
1. URL: https://zillow.com/homedetails/123-main-st/2056118632_zpid/
   ├─ Check scraper_queue: ❌ Not found (completed items removed)
   ├─ Check zillow_imports: ✅ FOUND!
   └─ ⏭️ SKIP - "URL already scraped and imported"
```

**Third Time (URL Changed, Same Property)**:
```
1. URL: https://zillow.com/homes/123-main-st-dallas-tx_rb/ (different URL format)
   ├─ Check scraper_queue: ❌ Not found
   ├─ Check zillow_imports: ❌ Not found (URL is different)
   └─ ✅ ADD to scraper_queue

2. Queue Processor runs:
   ├─ Apify scrapes property
   ├─ ZPID: 2056118632 (SAME as before!)
   ├─ Check zillow_imports by ZPID: ✅ FOUND!
   └─ ⏭️ SKIP - "Skipping duplicate ZPID 2056118632"
```

---

## ✅ Summary

**3 Data Points Used**:

1. **URL** - Fast, early detection in queue stage
2. **ZPID** - Reliable, handles URL changes, cross-scraper
3. **Address+City+State** - Fallback for manual uploads

**Multi-Layer Defense**:
- Layer 1 (URL): Prevents re-queueing
- Layer 2 (ZPID): Prevents re-saving same property
- Layer 3 (Address): Cleanup for manual imports

**Result**: Nearly impossible to get duplicate properties in the database!
