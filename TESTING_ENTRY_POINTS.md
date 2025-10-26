# OwnerFi Properties System - E2E Testing Entry Points

## Testing Architecture Overview

The OwnerFi properties system has clear separation of concerns that makes E2E testing straightforward:

1. **Data Layer** - Firestore (properties, propertyMatches, propertyActions collections)
2. **Business Logic** - Search, matching, calculations (in `/src/lib/`)
3. **API Layer** - RESTful endpoints (in `/src/app/api/`)
4. **UI Layer** - React components (in `/src/components/`)

---

## 1. Property Ingestion Testing

### Entry Point: Admin Upload API
**Endpoint:** `POST /api/admin/upload-properties-v4`
**Required Auth:** Admin role
**File:** `/src/app/api/admin/upload-properties-v4/route.ts`

**Test Scenarios:**

```typescript
// Test 1: Basic property upload
POST /api/admin/upload-properties-v4
{
  "properties": [
    {
      "address": "123 Main St",
      "city": "Austin",
      "state": "TX",
      "zipCode": "78701",
      "bedrooms": 3,
      "bathrooms": 2,
      "listPrice": 250000,
      "monthlyPayment": 1500,
      "downPaymentAmount": 50000,
      "downPaymentPercent": 20,
      "interestRate": 7.5,
      "termYears": 20,
      "imageUrls": ["https://..."],
      "description": "Beautiful property"
    }
  ]
}
Expected: 200 OK, properties created, nearby cities job queued

// Test 2: Data normalization
POST /api/admin/upload-properties-v4
{
  "properties": [
    {
      "address": "456 Oak St, Memphis, TN 38103",  // City/state/zip in address
      "city": "Memphis",
      "state": "tennessee",  // Full state name
      "zipCode": "38103",
      "bedrooms": 4,
      "bathrooms": 3,
      "listPrice": 300000,
      "monthlyPayment": 2000,
      "downPaymentAmount": 60000,
      "downPaymentPercent": 20,
      "interestRate": 8,
      "termYears": 25,
      "lotSize": "0.5 acres",  // String with unit
      "imageUrls": ["https://zillowstatic.com/path/p_c.jpg"]  // Low-res image
    }
  ]
}
Expected: 
- Address cleaned: "456 Oak St"
- State normalized: "TN"
- Lot size converted: 21780 (square feet)
- Image URL upgraded to highest resolution

// Test 3: Validation errors
POST /api/admin/upload-properties-v4
{
  "properties": [
    {
      "address": "789 Elm St",
      "city": "NewYork",  // Missing space - should be normalized
      "state": "NY",
      "zipCode": "10001-ABC",  // Invalid ZIP format
      "bedrooms": -1,  // Invalid negative
      "bathrooms": 2.5,
      "listPrice": -100000,  // Invalid negative price
      "monthlyPayment": 0,  // Invalid zero payment
      "downPaymentAmount": 50000,
      "downPaymentPercent": 50,
      "interestRate": 25,  // High but valid
      "termYears": 30
    }
  ]
}
Expected: Validation errors returned with specific field messages
```

**Verification Steps:**
1. Check properties saved in Firestore with normalized data
2. Verify background job queued for nearby cities
3. Check image URLs upgraded to highest resolution
4. Verify address cleaned of duplicate city/state/zip
5. Confirm financial calculations correct

---

## 2. Property Search Testing

### Entry Point: Search API
**Endpoint:** `GET /api/properties/search-optimized`
**Required Auth:** Any authenticated user
**File:** `/src/app/api/properties/search-optimized/route.ts`
**Core Logic:** `/src/lib/property-search-optimized.ts`

**Test Scenarios:**

```typescript
// Test 1: Basic search - center city only
GET /api/properties/search-optimized?city=Austin&state=TX&limit=20
Expected: Properties in Austin, TX sorted by monthly payment

// Test 2: Search with budget filter
GET /api/properties/search-optimized?
  city=Austin&
  state=TX&
  maxMonthlyPayment=1500&
  maxDownPayment=50000&
  limit=20
Expected: Only properties with:
- monthlyPayment <= 1500
- downPaymentAmount <= 50000

// Test 3: Search with property requirements
GET /api/properties/search-optimized?
  city=Austin&
  state=TX&
  minBedrooms=3&
  minBathrooms=2&
  maxMonthlyPayment=2000&
  maxDownPayment=100000&
  limit=20
Expected: Only properties with:
- bedrooms >= 3
- bathrooms >= 2
- monthlyPayment <= 2000
- downPaymentAmount <= 100000

// Test 4: Nearby cities expansion
GET /api/properties/search-optimized?city=Austin&state=TX&limit=100
Expected: Properties in Austin + nearby cities (within 30 miles):
- Round Rock, TX
- Cedar Park, TX
- Pflugerville, TX
- Georgetown, TX
- etc.

// Test 5: Pagination
GET /api/properties/search-optimized?city=Austin&state=TX&limit=10
Expected: Response includes:
{
  "properties": [...10 properties...],
  "hasNextPage": true,
  "lastDoc": {...}  // For cursor-based pagination
}

// Test 6: Edge case - no results
GET /api/properties/search-optimized?
  city=SmallTown&
  state=WY&
  maxMonthlyPayment=500&
  maxDownPayment=10000&
  limit=20
Expected: 
{
  "properties": [],
  "totalFound": 0,
  "hasNextPage": false
}

// Test 7: Performance tracking
GET /api/properties/search-optimized?city=Austin&state=TX&limit=50
Expected: Response includes performance metrics:
{
  "searchTime": 45,  // ms
  "totalTime": 78,   // ms
  "performance": {
    "propertiesPerMs": 0.641  // properties found per millisecond
  }
}
```

**Verification Steps:**
1. Verify only active properties returned (isActive === true)
2. Confirm financial filters applied correctly
3. Check property requirements filter (bedrooms, bathrooms)
4. Validate nearby cities expansion (30-mile radius)
5. Verify results sorted by monthlyPayment ASC
6. Confirm pagination with cursor works
7. Monitor performance (target < 500ms total time)

---

## 3. Property Details Testing

### Entry Point: Details API
**Endpoint:** `GET /api/properties/details`
**File:** `/src/app/api/properties/details/route.ts`

**Test Scenarios:**

```typescript
// Test 1: Single property fetch
GET /api/properties/details?ids=["prop123"]
Expected: Single property object with all fields

// Test 2: Batch property fetch
GET /api/properties/details?ids=["prop1","prop2","prop3","prop4","prop5"]
Expected: Array of 5 property objects

// Test 3: Large batch (exceeds Firestore limit)
GET /api/properties/details?ids=["prop1"..."prop25"]  // 25 properties
Expected: All 25 properties returned (internally batched in 10-doc chunks)

// Test 4: Non-existent properties
GET /api/properties/details?ids=["nonexistent1","nonexistent2"]
Expected: Empty array or filtered results

// Test 5: Mixed valid and invalid IDs
GET /api/properties/details?ids=["validProp123","invalidID"]
Expected: Only valid property returned
```

**Verification Steps:**
1. Confirm all property fields returned correctly
2. Verify batch processing works (handles Firestore 10-doc limit)
3. Check property order matches requested order
4. Validate timestamp conversion (Firestore → ISO 8601)

---

## 4. Similar Properties Testing

### Entry Point: Similar Properties API
**Endpoint:** `GET /api/properties/similar`
**File:** `/src/app/api/properties/similar/route.ts`

**Test Scenarios:**

```typescript
// Test 1: Find similar properties
GET /api/properties/similar?
  city=Austin&
  state=TX&
  listPrice=250000&
  bedrooms=3&
  bathrooms=2&
  limit=10
Expected: Properties similar to reference property:
- Price within ±20% ($200k-$300k)
- Bedrooms within ±1 (2-4 bedrooms)
- Bathrooms within ±0.5 (1.5-2.5 bathrooms)
- Within nearby cities (30-mile radius)

// Test 2: Price range matching
GET /api/properties/similar?
  city=Houston&
  state=TX&
  listPrice=500000&
  limit=10
Expected: Properties between $400k-$600k

// Test 3: Exclude original property
// Setup: Reference property is prop123
GET /api/properties/similar?
  propertyId=prop123&
  city=Houston&
  state=TX&
  listPrice=500000&
  limit=10
Expected: Similar properties but NOT prop123

// Test 4: Edge case - very specific requirements
GET /api/properties/similar?
  city=Austin&
  state=TX&
  listPrice=150000&
  bedrooms=1&
  bathrooms=1&
  limit=5
Expected: Up to 5 similar 1BR/1BA properties
```

**Verification Steps:**
1. Confirm price range filtering (±20%)
2. Check bedroom flexibility (±1)
3. Verify bathroom flexibility (±0.5)
4. Validate nearby cities search (30-mile radius)
5. Confirm sorting by monthly payment
6. Verify pagination limit respected

---

## 5. Buyer Like/Pass Actions Testing

### Entry Point: Property Actions API
**Endpoint:** `POST /api/property-actions`
**File:** `/src/app/api/property-actions/route.ts`

**Test Scenarios:**

```typescript
// Test 1: Like property
POST /api/property-actions
{
  "buyerId": "buyer123",
  "propertyId": "prop456",
  "action": "like"
}
Expected: 200 OK
{
  "success": true,
  "newStatus": "liked"
}
Backend: PropertyMatch status updated to "liked"

// Test 2: Pass property
POST /api/property-actions
{
  "buyerId": "buyer123",
  "propertyId": "prop456",
  "action": "pass"
}
Expected: 200 OK
{
  "success": true,
  "newStatus": "disliked"
}
Backend: PropertyMatch status updated to "disliked"

// Test 3: Undo like
POST /api/property-actions
{
  "buyerId": "buyer123",
  "propertyId": "prop456",
  "action": "undo_like"
}
Expected: 200 OK
{
  "success": true,
  "newStatus": "pending"
}
Backend: PropertyMatch status reset to "pending"

// Test 4: Undo pass
POST /api/property-actions
{
  "buyerId": "buyer123",
  "propertyId": "prop456",
  "action": "undo_pass"
}
Expected: 200 OK
{
  "success": true,
  "newStatus": "pending"
}

// Test 5: Invalid action
POST /api/property-actions
{
  "buyerId": "buyer123",
  "propertyId": "prop456",
  "action": "invalid_action"
}
Expected: 400 Bad Request
{
  "error": "Invalid action"
}
```

**Verification Steps:**
1. Confirm PropertyMatch document updated with new status
2. Verify PropertyAction immutable record created
3. Check timestamps updated (lastActionAt, updatedAt)
4. Validate state transitions (pending → liked/disliked → pending)
5. Confirm error handling for invalid actions

---

## 6. Nearby Cities Discovery Testing

### Entry Point: Nearby Properties API
**Endpoint:** `GET /api/buyer/properties-nearby`
**File:** `/src/app/api/buyer/properties-nearby/route.ts`
**Required Auth:** Buyer role

**Test Scenarios:**

```typescript
// Test 1: Discover nearby cities with properties
GET /api/buyer/properties-nearby?
  city=Austin&
  state=TX&
  maxMonthlyPayment=1500&
  maxDownPayment=50000&
  radius=30&
  minProperties=3
Expected: 
{
  "searchCenter": { "city": "Austin", "state": "TX", "radius": 30 },
  "citiesWithSufficientProperties": {
    "count": 5,
    "cities": [
      {
        "cityName": "Austin",
        "state": "TX",
        "propertyCount": 15,
        "avgMonthlyPayment": 1400,
        "avgDownPayment": 48000
      },
      ...
    ]
  },
  "citiesWithFewProperties": {
    "count": 3,
    "cities": [...]  // 1-2 properties per city
  }
}

// Test 2: Expand budget search
GET /api/buyer/properties-nearby?
  city=Dallas&
  state=TX&
  maxMonthlyPayment=2500&
  maxDownPayment=100000&
  radius=45&
  minProperties=2
Expected: Cities sorted by property count (highest first)

// Test 3: Edge case - small city with no nearby matches
GET /api/buyer/properties-nearby?
  city=SmallTown&
  state=MT&
  maxMonthlyPayment=1000&
  maxDownPayment=30000&
  radius=30&
  minProperties=3
Expected: Empty citiesWithSufficientProperties, possibly some in citiesWithFewProperties
```

**Verification Steps:**
1. Confirm all nearby cities within radius found
2. Check property count filtering (minProperties threshold)
3. Verify budget filters applied (monthly/down payment)
4. Confirm affordability metrics calculated correctly
5. Validate city sorting (by property count, descending)

---

## 7. Property Financial Calculations Testing

### Entry Point: Calculation Functions
**File:** `/src/lib/property-calculations.ts`
**Used By:** Property upload, validation, display

**Test Scenarios:**

```typescript
// Test 1: Calculate monthly payment
calculateMonthlyPayment(
  loanAmount: 200000,
  annualRate: 7.5,
  termYears: 20
)
Expected: 1,663.28 (verified with standard mortgage formula)

// Test 2: Validate complete financials
validatePropertyFinancials({
  listPrice: 250000,
  downPaymentAmount: 50000,
  downPaymentPercent: 20,
  monthlyPayment: 1500,
  interestRate: 7.5,
  termYears: 20,
  loanAmount: 200000
})
Expected: {
  valid: true,
  errors: [],
  warnings: []  // If everything checks out
}

// Test 3: Detect financial errors
validatePropertyFinancials({
  listPrice: 250000,
  downPaymentAmount: 300000,  // > list price!
  downPaymentPercent: 120,
  monthlyPayment: 500,
  interestRate: 75,  // > 50%
  termYears: 100  // > 50 years
})
Expected: {
  valid: false,
  errors: [
    "Down payment cannot be greater than list price",
    "Interest rate must be between 0% and 50%",
    "Loan term must be between 1 and 50 years"
  ],
  warnings: []
}

// Test 4: Calculate LTV (Loan-to-Value)
calculateLTV({
  listPrice: 250000,
  downPaymentAmount: 50000,
  loanAmount: 200000,
  ...
})
Expected: 80 (200000 / 250000 * 100)

// Test 5: Calculate total interest
calculateTotalInterest({
  monthlyPayment: 1500,
  termYears: 20,
  loanAmount: 200000,
  ...
})
Expected: 160000 (1500 * 20 * 12 - 200000)

// Test 6: Edge case - zero interest
calculateMonthlyPayment(
  loanAmount: 200000,
  annualRate: 0,
  termYears: 20
)
Expected: 833.33 (200000 / 240 months)

// Test 7: Very short term
calculateMonthlyPayment(
  loanAmount: 100000,
  annualRate: 8,
  termYears: 5
)
Expected: 2028.63
```

**Verification Steps:**
1. Confirm monthly payment calculation accurate (standard mortgage formula)
2. Verify financial validation catches errors
3. Check LTV calculation correct
4. Validate interest calculation
5. Test edge cases (zero rate, short terms)

---

## 8. Buyer Property Matching Testing

### Entry Point: Matching Logic
**File:** `/src/lib/matching.ts`

**Test Scenarios:**

```typescript
// Test 1: Property matches buyer criteria
const property = {
  id: "prop1",
  monthlyPayment: 1500,
  downPaymentAmount: 50000,
  city: "Austin",
  state: "TX",
  bedrooms: 3,
  bathrooms: 2
};

const buyer = {
  id: "buyer1",
  maxMonthlyPayment: 2000,
  maxDownPayment: 100000,
  preferredCity: "Austin",
  preferredState: "TX",
  minBedrooms: 3,
  minBathrooms: 2
};

isPropertyMatch(property, buyer)
Expected: {
  matches: true,
  score: 1.0,  // All criteria met
  matchedOn: {
    monthly_payment: true,
    down_payment: true,
    location: true,
    bedrooms: true,
    bathrooms: true
  }
}

// Test 2: Property fails on budget
const expensiveProperty = {
  ...property,
  monthlyPayment: 3000  // Exceeds buyer max
};

isPropertyMatch(expensiveProperty, buyer)
Expected: {
  matches: false,
  score: 0,
  matchedOn: {
    monthly_payment: false,  // Critical criterion fails
    ...others: false
  }
}

// Test 3: Property fails on location
const farProperty = {
  ...property,
  city: "Dallas",
  state: "TX"
};

isPropertyMatch(farProperty, buyer)
Expected: {
  matches: false,
  score: 0,
  matchedOn: {
    location: false,  // Critical criterion fails
    ...others: false
  }
}

// Test 4: Partial match (missing optional criteria)
const smallProperty = {
  ...property,
  bedrooms: 2,  // Less than buyer minimum
  bathrooms: 1
};

isPropertyMatch(smallProperty, buyer)
Expected: {
  matches: true,  // Critical criteria met
  score: 0.6,  // (3/5 criteria met)
  matchedOn: {
    monthly_payment: true,
    down_payment: true,
    location: true,
    bedrooms: false,
    bathrooms: false
  }
}
```

**Verification Steps:**
1. Confirm critical criteria enforced (budget, location)
2. Check score calculation correct (met / total)
3. Verify optional criteria boost score
4. Validate no matches on critical criterion failure
5. Test all combinations of criteria

---

## 9. Address Parsing & Geocoding Testing

### Entry Point: Google Maps Service
**File:** `/src/lib/google-maps-service.ts`

**Test Scenarios:**

```typescript
// Test 1: Parse valid address
parseAddress("123 Main St, Austin, TX 78701")
Expected: {
  success: true,
  address: {
    streetNumber: "123",
    streetName: "Main St",
    fullStreetAddress: "123 Main St",
    city: "Austin",
    state: "TX",
    zipCode: "78701",
    county: "Travis",
    latitude: 30.2672,
    longitude: -97.7431,
    formattedAddress: "123 Main Street, Austin, TX 78701, USA"
  }
}

// Test 2: Address with typo
parseAddress("123 Main Str, Austin, TX 78701")
Expected: Either:
- Corrected address parsed successfully, OR
- Error returned if correction fails

// Test 3: International address (should fail)
parseAddress("123 High St, London, UK")
Expected: {
  success: false,
  error: "Could not extract city and state from address"
}

// Test 4: Batch address parsing
batchParseAddresses([
  "123 Main St, Austin, TX 78701",
  "456 Oak Ave, Dallas, TX 75201",
  "789 Elm Blvd, Houston, TX 77001"
], 100)
Expected: Array of 3 ParsedAddress results with 100ms delay between

// Test 5: Street View URL generation
getStreetViewImage(30.2672, -97.7431, {
  size: "640x400",
  fov: 90,
  heading: 0,
  pitch: 10
})
Expected: String URL like:
"https://maps.googleapis.com/maps/api/streetview?size=640x400&location=30.2672,-97.7431&heading=0&fov=90&pitch=10&key=[API_KEY]"
```

**Verification Steps:**
1. Confirm address components parsed correctly
2. Verify coordinates accurate (within 0.01 degree)
3. Check batch processing respects delay
4. Validate Street View URLs functional
5. Verify API key requirement enforced

---

## 10. Background Jobs Testing

### Entry Point: Job Queue System
**File:** `/src/lib/background-jobs.ts`

**Test Scenarios:**

```typescript
// Test 1: Queue nearby cities job
queueNearbyCitiesJob("prop123", {
  address: "123 Main St",
  city: "Austin",
  state: "TX",
  zipCode: "78701"
})
Expected: Job added to queue, processing starts

// Processing should:
1. Try city name lookup (fast, no API)
2. If fails, try existing coordinates
3. If fails, geocode address via Google Maps
4. Get nearby cities (30-mile radius)
5. Update property document with nearbyCities array

// Test 2: Job completion tracking
// After job processes, verify:
- properties[prop123].nearbyCities populated
- properties[prop123].nearbyCitiesUpdatedAt timestamp set
- properties[prop123].nearbyCitiesSource populated ('city-name' | 'existing-coords' | 'geocoded')

// Test 3: Job failure handling
// Setup: Property with bad address that can't be geocoded
queueNearbyCitiesJob("prop456", {
  address: "Invalid Address That Doesn't Exist",
  city: "FakeCity",
  state: "XX",
  zipCode: "00000"
})
Expected:
- Job status = "failed"
- Job error message captured
- Property gets nearbyCities = [] (fallback)
- nearbyCitiesSource = "failed"

// Test 4: Fallback to 45-mile radius
// If no cities found within 30 miles, system should try 45 miles
Expected: nearbyCities populated from 45-mile search if 30-mile was empty
```

**Verification Steps:**
1. Confirm jobs processed asynchronously
2. Verify nearby cities array populated
3. Check nearbyCitiesSource indicates lookup method
4. Validate error handling and fallbacks
5. Confirm no blocking of property creation

---

## 11. Property Display Components Testing

### Entry Point: React Components
**File:** `/src/components/ui/PropertySwiper.tsx`
**Used By:** `/src/app/dashboard/page.tsx`

**Test Scenarios:**

```typescript
// Setup: Render PropertyListingSwiper with test properties
const properties = [
  { id: "p1", address: "123 Main", city: "Austin", imageUrls: ["img1.jpg", "img2.jpg"], ... },
  { id: "p2", address: "456 Oak", city: "Austin", imageUrls: ["img3.jpg"], ... },
  { id: "p3", address: "789 Elm", city: "Austin", imageUrls: [], ... }  // No images
];

// Test 1: Render first property
Expected: 
- First property displayed
- Image carousel showing first image
- Next/prev image buttons visible
- Like/pass buttons visible

// Test 2: Navigate properties
User clicks "Pass" button
Expected:
- onPass callback called with property
- Property removed from visible list
- Next property displayed

// Test 3: Like property
User clicks "Like" button
Expected:
- onLike callback called with property
- Toast notification shown: "Property saved"
- Property remains visible

// Test 4: Image carousel
User clicks next image button
Expected: 
- Next image in imageUrls array displayed
- Image counter shows current/total

// Test 5: Fallback for missing images
Property has no images
Expected:
- Placeholder image displayed (/placeholder-house.jpg)
- No image navigation buttons shown

// Test 6: Loading state
PropertyListingSwiper rendered with isLoading={true}
Expected:
- Loading spinner displayed
- No properties visible
- Buttons disabled

// Test 7: Filtered passed properties
passedIds={["p1", "p2"]} provided
Expected:
- Only p3 shown
- p1, p2 not visible
- Index adjusted automatically
```

**Verification Steps:**
1. Confirm all properties render correctly
2. Verify image carousel works (next/prev)
3. Check like/pass callbacks triggered
4. Validate fallback images displayed
5. Confirm loading and error states
6. Test responsive design on mobile

---

## 12. Admin Operations Testing

### Entry Point: Admin Properties API
**Endpoint:** `GET /api/admin/properties`
**File:** `/src/app/api/admin/properties/route.ts`
**Required Auth:** Admin role

**Test Scenarios:**

```typescript
// Test 1: List all properties
GET /api/admin/properties?limit=100
Expected: Up to 100 properties with metadata:
{
  "properties": [...100 properties...],
  "count": 100,
  "total": "1000+",  // Capped at 1000 for efficiency
  "showing": "100 of 1000+ properties"
}

// Test 2: Filter by status
GET /api/admin/properties?status=active&limit=50
Expected: Only properties with status === "active"

// Test 3: Filter by status - other statuses
GET /api/admin/properties?status=sold&limit=50
GET /api/admin/properties?status=pending&limit=50
GET /api/admin/properties?status=withdrawn&limit=50
Expected: Only properties with specified status

// Test 4: Pagination
GET /api/admin/properties?limit=10
Expected: First 10 properties
Then:
GET /api/admin/properties?limit=10&startAt=[10th_doc_cursor]
Expected: Next 10 properties

// Test 5: Update property
PUT /api/admin/properties
{
  "propertyId": "prop123",
  "updates": {
    "status": "sold",
    "lastUpdated": "2025-10-25T12:00:00Z"
  }
}
Expected: Property updated in Firestore

// Test 6: Delete property
DELETE /api/admin/properties?propertyId=prop123
Expected: Property removed from properties collection
```

**Verification Steps:**
1. Confirm admin-only access enforced
2. Check status filtering works
3. Verify pagination with cursors
4. Validate update and delete operations
5. Check audit logging of changes

---

## Summary: Critical Test Paths

### Happy Path (Full Property Lifecycle)

1. **Admin uploads property** → `/api/admin/upload-properties-v4`
   - Data normalized
   - Validation passed
   - Background job queued for nearby cities
   
2. **Property indexed** → Firestore compound indexes
   - Properties searchable by state + payment filters
   
3. **Buyer searches** → `/api/properties/search-optimized`
   - Gets nearby cities
   - Filters by budget and requirements
   - Gets matched properties
   
4. **Buyer views property** → PropertyListingSwiper component
   - Images display
   - Can navigate images
   - Can like/pass
   
5. **Buyer likes property** → `/api/property-actions`
   - PropertyMatch status updated
   - PropertyAction record created
   - Property added to favorites
   
6. **Realtor views property** → `/api/realtor/buyer-liked-properties`
   - Sees properties liked by purchased lead
   - Can contact buyer

### Error Handling Paths

1. Property upload with invalid data → Validation error
2. Search with no results → Empty array
3. Missing required parameters → 400 Bad Request
4. Unauthorized access → 401/403 errors
5. Database errors → 500 errors with logging

---

## Performance Benchmarks

| Operation | Target | File |
|-----------|--------|------|
| Search (typical) | < 500ms | `/src/lib/property-search-optimized.ts` |
| Similar properties | < 400ms | `/src/lib/property-search-optimized.ts` |
| Property details fetch | < 200ms | `/src/app/api/properties/details/route.ts` |
| Address parsing | < 1s | `/src/lib/google-maps-service.ts` |
| Background job (nearby cities) | < 5s | `/src/lib/background-jobs.ts` |
| Financial calculation | < 10ms | `/src/lib/property-calculations.ts` |

