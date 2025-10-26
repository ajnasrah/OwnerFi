# OwnerFi Properties System - Comprehensive End-to-End Overview

## Executive Summary

The OwnerFi properties system is a full-stack owner financing property marketplace that connects buyers with properties and enables realtors to manage leads. The system emphasizes performance optimization, clean data architecture, and real-time property discovery. It uses Firestore for persistence, Next.js for the API layer, and React components for the frontend.

---

## 1. Property Data Models & Schemas

### 1.1 Primary Data Models

#### PropertyListing (Core Property Schema)
**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/property-schema.ts`

```typescript
interface PropertyListing {
  // Core Identification
  id: string;                          // Unique property ID
  mlsNumber?: string;                  // MLS listing number
  [key: string]: unknown;              // Index signature for flexibility

  // Address & Location
  address: string;                     // Street address (cleaned, no city/state/zip)
  city: string;                        // City name
  state: string;                       // State abbreviation (TX, FL, GA)
  zipCode: string;                     // ZIP code
  latitude?: number;                   // GPS coordinates
  longitude?: number;                  // GPS coordinates
  county?: string;                     // County name
  neighborhood?: string;               // Subdivision name
  nearbyCities?: string[];             // Cities within 30-mile radius
  nearbyCitiesSource?: string;         // Source: 'comprehensive-database', 'api', etc
  nearbyCitiesUpdatedAt?: string | number | Date;  // Timestamp of last update

  // Property Details
  propertyType: 'single-family' | 'condo' | 'townhouse' | 'mobile-home' | 'multi-family' | 'land';
  bedrooms: number;
  bathrooms: number;
  squareFeet?: number;
  lotSize?: number;
  yearBuilt?: number;
  stories?: number;
  garage?: number;

  // Financial Information (Owner Financing Focus)
  listPrice: number;                   // Total property price
  downPaymentAmount: number;           // Required down payment ($)
  downPaymentPercent: number;          // Down payment as percentage
  monthlyPayment: number;              // Monthly payment amount
  interestRate: number;                // Owner financing interest rate
  termYears: number;                   // Financing term in years
  balloonPayment?: number;             // Balloon payment amount
  balloonYears?: number;               // Years until balloon payment due

  // Property Features
  features?: string[];                 // Array of features
  appliances?: string[];               // Included appliances
  heating?: string;                    // Heating type
  cooling?: string;                    // AC type
  parking?: string;                    // Parking description

  // Media
  imageUrls: string[];                 // Array of property photo URLs
  virtualTourUrl?: string;             // 360° tour or video link
  floorPlanUrl?: string;              // Floor plan image URL

  // Description & Marketing
  title?: string;                      // Marketing title/headline
  description: string;                 // Property description
  highlights?: string[];               // Key selling points

  // Owner/Contact Information
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;

  // Listing Management
  status: 'active' | 'pending' | 'sold' | 'withdrawn' | 'expired';
  isActive: boolean;
  dateAdded: string;                   // ISO date when added to platform
  lastUpdated: string;                 // ISO date of last update
  expirationDate?: string;
  priority: number;                    // Display priority (1-10)
  featured: boolean;                   // Highlight in searches

  // Location Analytics
  distanceToCenter?: number;           // Miles from search center (calculated)
  walkScore?: number;
  schoolRating?: number;

  // Market Data
  estimatedValue?: number;
  pricePerSqFt?: number;
  daysOnMarket?: number;
  viewCount?: number;
  favoriteCount?: number;

  // Compliance & Legal
  disclosures?: string[];
  hoa?: { hasHOA: boolean; monthlyFee?: number; restrictions?: string[] };
  taxes?: { annualAmount: number; assessedValue?: number };

  // Image Quality Analysis
  imageQuality?: {
    overallScore: number;
    imageQuality: number;
    professional: number;
    presentation: number;
    relevance: number;
    issues: string[];
    recommendation: 'KEEP' | 'REPLACE';
    reasoning: string;
    analyzedAt: string;
    isStreetView: boolean;
  };

  // Integration Data
  source: 'manual' | 'import' | 'scraper';
  sourceId?: string;
}
```

#### PropertySearchCriteria (Buyer Search Preferences)
```typescript
interface PropertySearchCriteria {
  // Location
  centerCity: string;
  centerState: string;
  searchRadius: number;                // Miles

  // Budget constraints
  maxMonthlyPayment: number;
  maxDownPayment: number;
  minPrice?: number;
  maxPrice?: number;

  // Property requirements
  minBedrooms?: number;
  minBathrooms?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  minLotSize?: number;

  // Property type preferences
  propertyTypes: string[];
  maxYearBuilt?: number;
  minYearBuilt?: number;

  // Features
  requiredFeatures?: string[];
  preferredFeatures?: string[];
  excludeFeatures?: string[];

  // Special requirements
  petsAllowed?: boolean;
  noHOA?: boolean;
  maxHOAFee?: number;
}
```

### 1.2 Related Models (Buyer/Realtor Interactions)

#### PropertyMatch (Calculated Match Records)
```typescript
interface PropertyMatch {
  id: string;
  propertyId: string;
  buyerId: string;
  matchScore: number;          // 0-100 compatibility percentage
  withinBudget: boolean;
  withinRadius: boolean;
  meetsRequirements: boolean;
  distanceMiles?: number;
  createdAt: Timestamp;
}
```

#### PropertyAction (Immutable Event Log)
```typescript
interface PropertyAction {
  id: string;
  buyerId: string;
  propertyId: string;
  action: 'like' | 'pass' | 'undo_like' | 'undo_pass';
  timestamp: string;
  source: 'dashboard' | 'realtor_shared' | 'email_link';
  createdAt: string;
}
```

### 1.3 Firestore Collections

**Main Collections:**
- **properties** - PropertyListing documents
- **propertyMatches** - Buyer-property matches
- **propertyActions** - Immutable action history
- **buyerProfiles** - Buyer preferences and metadata
- **realtors** - Realtor profiles
- **buyerLeadPurchases** - Transaction records for lead purchases
- **leadDisputes** - Dispute/complaint records

**Collection Structure:**
```
firestore/
├── properties/
│   ├── [propertyId] → PropertyListing
├── propertyMatches/
│   ├── [matchId] → { buyerId, propertyId, matchScore, status... }
├── propertyActions/
│   ├── [actionId] → { buyerId, propertyId, action, timestamp... }
├── buyerProfiles/
│   ├── [buyerId] → { userId, searchCriteria, likedPropertyIds... }
└── [other collections]
```

---

## 2. Property Data Fetching & API Endpoints

### 2.1 Core API Endpoints

#### Search Endpoints

**GET /api/properties/search-optimized**
- **Purpose:** Main property search with nearby cities
- **Parameters:**
  - `city` (required) - Search center city
  - `state` (required) - Search state (2-letter code)
  - `maxMonthlyPayment` - Filter by monthly payment
  - `maxDownPayment` - Filter by down payment
  - `minBedrooms` - Minimum bedrooms filter
  - `minBathrooms` - Minimum bathrooms filter
  - `limit` - Max results (default 20, max 100)
- **Returns:** 
  ```json
  {
    "success": true,
    "searchCriteria": {...},
    "totalFound": number,
    "properties": PropertyListing[],
    "hasNextPage": boolean,
    "searchTime": number,
    "totalTime": number
  }
  ```
- **Implementation:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/properties/search-optimized/route.ts`

**GET /api/properties/details**
- **Purpose:** Fetch property details by IDs
- **Parameters:**
  - `ids` - JSON array of property IDs
- **Features:** Batches queries (Firestore has 10-document limit)
- **Returns:** Array of PropertyListing objects

**GET /api/properties/similar**
- **Purpose:** Find similar properties within 30-mile radius
- **Parameters:**
  - `city`, `state` - Location of reference property
  - `listPrice`, `bedrooms`, `bathrooms` - Property characteristics
  - `limit` - Number of similar properties to return
- **Filtering:** Price ±20%, bedrooms ±1, bathrooms ±0.5

#### Buyer-Specific Endpoints

**GET /api/buyer/properties-nearby**
- **Purpose:** Discover nearby cities with available properties
- **Returns:** Cities grouped by property count, with affordability metrics
- **Useful for:** Expanding buyer search beyond preferred city

**GET /api/buyer/liked-properties**
- **Purpose:** Fetch buyer's saved/liked properties
- **Authentication:** Requires buyer session

**POST /api/buyer/like-property**
- **Purpose:** Save or unsave property for buyer
- **Parameters:** `propertyId`, `action` ('like' or 'unlike')

#### Admin Endpoints

**GET /api/admin/properties**
- **Purpose:** Admin property management
- **Parameters:**
  - `limit` - Pagination limit (max 1000)
  - `status` - Filter by status ('active', 'pending', 'sold', etc.)
- **Access:** Admin only

**POST /api/admin/upload-properties-v4**
- **Purpose:** Bulk property import with data normalization
- **Features:**
  - Normalizes lot sizes (acres → sq ft)
  - Cleans up state codes
  - Fixes common city name typos
  - Auto-upgrades image URLs to highest resolution
  - Queues background jobs for nearby cities

### 2.2 Data Fetching Strategy

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/property-search-optimized.ts`

The search uses a **multi-stage optimization approach:**

1. **Firestore Compound Indexes** - No in-memory filtering
   - Filters applied at query level: `state`, `isActive`, `monthlyPayment`, `downPaymentAmount`, `bedrooms`, `bathrooms`
   - Result limit with pagination support

2. **City Filtering** (Post-Query) - Smaller dataset filtering
   - City names extracted and matched against search cities
   - Filters expensive city comparison on already-reduced result set

3. **Nearby Cities Expansion**
   - Gets all nearby cities within 30 miles using `getNearbyCitiesDirect()`
   - Searches in all cities (center + nearby) in single query

**Performance Features:**
- Pagination with `lastDoc` for cursor-based navigation
- Performance metrics tracking (search time, properties/ms)
- Rate limiting for external API calls
- Batch operations with retries

---

## 3. Property Geocoding & Location Services

### 3.1 Google Maps Integration

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/google-maps-service.ts`

**Key Functions:**

```typescript
// Parse full address into components
parseAddress(fullAddress: string): Promise<AddressParsingResult>
  → Returns: { success, address: ParsedAddress }
  → Extracts: Street, City, State, ZIP, County, Lat/Lng, Formatted Address

// Generate Street View images
getStreetViewImage(latitude, longitude, options): string
  → Returns: Google Maps Street View API URL
  → Options: size, fov, heading, pitch

// Enhanced property processing
enhancePropertyWithGoogleMaps(property): Promise<{
  parsedAddress?: ParsedAddress;
  streetViewImageUrl?: string;
  enhancedImageUrl?: string;
}>

// Batch processing with rate limiting
batchParseAddresses(addresses, delayMs): Promise<AddressParsingResult[]>
```

**Configuration:**
- Uses `GOOGLE_MAPS_API_KEY` environment variable
- Rate limiting: 100ms delay between requests (configurable)

### 3.2 Nearby Cities System

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/property-nearby-cities.ts`

**Multi-Strategy Approach:**

```typescript
populateNearbyCitiesForProperty(property, radiusMiles = 30)
  Strategy 1: City name lookup (fastest, no API calls)
    → Uses local city database
  
  Strategy 2: Existing coordinates (if available)
    → Avoids geocoding API call
  
  Strategy 3: Geocode address (fallback)
    → Calls Google Maps API
  
  Returns: { nearbyCities, coordinates?, source }
```

**City Sources:**
1. **Comprehensive Database** - `/lib/comprehensive-cities.ts` (all US cities)
2. **Cities Service V2** - `/lib/cities-service-v2.ts` (ultra-fast lookup)
3. **Limited Database** - `/lib/cities.ts` (fallback)

**Background Job:**
- Nearby cities population queued during property creation
- Non-blocking: doesn't delay property listing
- Runs asynchronously in background

---

## 4. Property Search & Filtering Mechanisms

### 4.1 Search Algorithm

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/property-search-optimized.ts`

```typescript
searchPropertiesOptimized(criteria: PropertySearchCriteria): PropertySearchResult
```

**Constraints Applied (in Firestore):**
1. `state == criteria.state` (indexed)
2. `isActive == true` (indexed)
3. `monthlyPayment <= criteria.maxMonthlyPayment` (indexed)
4. `downPaymentAmount <= criteria.maxDownPayment` (indexed)
5. `bedrooms >= criteria.minBedrooms` (indexed, if specified)
6. `bathrooms >= criteria.minBathrooms` (indexed, if specified)
7. Order by `monthlyPayment ASC` (for consistent pagination)

**City Filtering (Post-Query):**
- Extract city names from filtered properties
- Match against search cities (center + nearby)

### 4.2 Required Firestore Indexes

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/property-search-optimized.ts`

```typescript
getRequiredFirestoreIndexes(): string[] {
  return [
    'properties: isActive ASC, state ASC, monthlyPayment ASC',
    'properties: isActive ASC, state ASC, downPaymentAmount ASC, monthlyPayment ASC',
    'properties: isActive ASC, state ASC, bedrooms ASC, monthlyPayment ASC',
    'properties: isActive ASC, state ASC, bathrooms ASC, monthlyPayment ASC',
    'properties: isActive ASC, monthlyPayment ASC, downPaymentAmount ASC',
    'properties: state ASC, city ASC, monthlyPayment ASC',
    'properties: nearbyCitiesUpdatedAt ASC'
  ];
}
```

### 4.3 Buyer Matching Logic

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/matching.ts`

```typescript
isPropertyMatch(property: PropertyForMatching, buyer: BuyerForMatching): MatchResult
```

**Critical Criteria (property fails match if any fail):**
1. Monthly Payment: `property.monthlyPayment <= buyer.maxMonthlyPayment`
2. Down Payment: `property.downPaymentAmount <= buyer.maxDownPayment`
3. Location: `property.city == buyer.preferredCity && property.state == buyer.preferredState`

**Optional Criteria (boost match score):**
4. Bedrooms: `property.bedrooms >= buyer.minBedrooms` (if specified)
5. Bathrooms: `property.bathrooms >= buyer.minBathrooms` (if specified)

**Match Score Calculation:**
- Score = (criteria_met / total_criteria) × 100
- Only properties meeting ALL critical criteria are returned

---

## 5. Property Display Components & UI

### 5.1 Main Components

**PropertyListingSwiper** (`/src/components/ui/PropertySwiper.tsx`)
- **Purpose:** Tinder-like property browsing interface
- **Props:**
  - `properties: PropertyListing[]`
  - `onLike: (property) => void`
  - `onPass: (property) => void`
  - `favorites: string[]` (IDs of liked properties)
  - `passedIds?: string[]` (IDs of passed properties)
  - `isLoading?: boolean`

- **Features:**
  - Image carousel with next/prev navigation
  - Loading states and error handling
  - Toast notifications (saved/deleted)
  - Filters out already-passed properties
  - Image lazy loading and error fallbacks

**Property Schema Component** (`/src/components/SEO/PropertySchema.tsx`)
- JSON-LD structured data for SEO
- Implements Schema.org Property schema
- Improves search engine visibility

### 5.2 Dashboard Pages

**Buyer Dashboard** (`/src/app/dashboard/page.tsx`)
- Shows matched properties for buyer
- Displays buyer search preferences
- Integration with PropertyListingSwiper
- Like/pass functionality
- Liked properties section

**Favorites** (`/src/app/dashboard/favorites/page.tsx`)
- Shows buyer's liked properties
- Allows bulk actions

### 5.3 Related Properties Display

Used to show similar properties within 30-mile radius
- Same price range (±20%)
- Similar bedroom count (±1)
- Similar bathroom count (±0.5)

---

## 6. Property-Related Workflows & Background Jobs

### 6.1 Background Job System

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/background-jobs.ts`

```typescript
interface BackgroundJob {
  id: string;
  type: 'populate_nearby_cities';
  propertyId: string;
  propertyData: { address, city, state, zipCode?, latitude?, longitude? };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}
```

**Job Queue:**
- In-memory queue (development)
- Ready for Redis/Cloud Tasks migration
- Non-blocking property creation
- Automatic retry on failure

**Processing Flow:**
1. Job added to queue when property created/updated
2. `processJobQueue()` starts automatically if not running
3. For each job:
   - Get nearby cities (3 strategies)
   - Update property with nearby cities array
   - Mark as completed/failed

### 6.2 Property Data Normalization

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/app/api/admin/upload-properties-v4/route.ts`

**Normalization Steps:**

```typescript
// 1. Address Cleaning
cleanAddress(address, city, state, zipCode): string
  - Removes duplicate city, state, zip from address field
  - Uses regex patterns for accurate matching

// 2. Image URL Optimization
upgradeZillowImageUrl(url): string
  - Detects low-resolution Zillow images
  - Replaces with highest-resolution versions
  - Supports: cc_ft_1536.webp (best), uncropped_scaled_within_1536_1152.webp

// 3. State Code Normalization
normalizeState(state): string
  - Converts full state names to 2-letter codes
  - Supports variations: 'tennessee' → 'TN'

// 4. Lot Size Conversion
normalizeLotSize(lotSizeStr): number
  - Converts acres to square feet (×43560)
  - Extracts numbers from strings: "10019", "1 acre", "0.5 acres"

// 5. City Name Fixing
normalizeCity(city): string
  - Fixes common typos: 'bartlettt' → 'Bartlett'
  - Title-cases city names
```

### 6.3 Property Validation

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/validation.ts`

```typescript
propertySchema = z.object({
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().length(2),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  price: z.number().min(1),
  bedrooms: z.number().min(0).max(20),
  bathrooms: z.number().min(0).max(20),
  squareFeet: z.number().min(1).optional(),
  lotSize: z.number().min(0).optional(),
  yearBuilt: z.number().min(1800).max(currentYear + 2).optional(),
  propertyType: z.enum(['house', 'condo', 'townhouse', 'mobile', 'multi-family', 'land']),
  listingUrl: z.string().url().optional()
})
```

---

## 7. Property Validation & Verification Systems

### 7.1 Financial Validation

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/property-calculations.ts`

**Validation Function:**
```typescript
validatePropertyFinancials(financials: PropertyFinancials): {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

**Critical Validations:**
- List price > $0
- Down payment >= $0 and < list price
- Monthly payment > $0
- Interest rate 0-50%
- Term 1-50 years

**Warnings Triggered:**
- List price > $10M
- Down payment > 95%
- Interest rate > 15%
- Calculated payment differs >5% from provided

**Financial Calculations:**
```typescript
// Calculate monthly payment from loan amount
calculateMonthlyPayment(loanAmount, annualRate, termYears): number
  Formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
  Where: r = monthly rate, n = number of months

// Calculate loan amount from payment (reverse)
calculateLoanAmount(monthlyPayment, annualRate, termYears): number

// Calculate total interest over life
calculateTotalInterest(financials): number

// Calculate loan-to-value ratio
calculateLTV(financials): number
```

### 7.2 Image Quality Analysis

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/image-quality-analyzer.ts`

**Image Quality Scoring:**
```typescript
imageQuality: {
  overallScore: number;        // 1-10
  imageQuality: number;        // Resolution, clarity, lighting
  professional: number;        // Composition, angles
  presentation: number;        // Clean, staged, appealing
  relevance: number;           // Shows actual property
  issues: string[];            // Specific problems
  recommendation: 'KEEP' | 'REPLACE';
  reasoning: string;
  analyzedAt: string;
  isStreetView: boolean;
}
```

### 7.3 Data Quality Checks

**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/property-auto-cleanup.ts`

**Cleanup Utilities:**
- Address deduplication (removes city, state, zip from street address)
- Image URL resolution upgrades
- Automatic Street View fallback for missing images
- Consistency checks across fields

---

## 8. Data Flow Diagrams

### 8.1 Property Creation Flow

```
1. Upload (Admin)
   └─→ POST /api/admin/upload-properties-v4
       ├─ Normalize data (cities, states, lot sizes)
       ├─ Validate fields (address, financials, images)
       ├─ Clean address (remove duplicated city/state/zip)
       ├─ Upgrade image URLs to highest resolution
       ├─ Save to Firestore (properties collection)
       └─ Queue background job: populate_nearby_cities
         └─→ [Background] Get nearby cities (30-mile radius)
             └─ Update properties[id].nearbyCities
```

### 8.2 Property Search Flow

```
1. Buyer searches
   └─→ GET /api/properties/search-optimized?city=...&state=...
       ├─ Get nearby cities for search center
       ├─ Build Firestore query with compound indexes
       │  ├─ Filter: state = searchState
       │  ├─ Filter: isActive = true
       │  ├─ Filter: monthlyPayment <= maxMonthlyPayment
       │  ├─ Filter: downPaymentAmount <= maxDownPayment
       │  ├─ Filter: bedrooms >= minBedrooms (if specified)
       │  ├─ Filter: bathrooms >= minBathrooms (if specified)
       │  └─ Order by: monthlyPayment ASC
       ├─ Filter results by city (post-query, smaller dataset)
       ├─ Enhance with nearby cities data
       └─ Return PropertyListing[]
```

### 8.3 Buyer Lead Purchase Flow

```
1. Realtor purchases lead
   └─→ POST /api/realtor/purchase-lead
       ├─ Check realtor credits >= 1
       ├─ Verify buyer is available for purchase
       ├─ Create LeadPurchase record
       ├─ Deduct 1 credit from realtor
       ├─ Mark buyer as purchased
       └─ Return buyer contact details
```

### 8.4 Property Action Flow (Like/Pass)

```
1. Buyer likes/passes property
   └─→ POST /api/property-actions
       ├─ Find PropertyMatch record for buyer+property
       ├─ Update match status ('liked', 'disliked', 'pending')
       ├─ Update lastActionAt timestamp
       ├─ Create PropertyAction record (immutable event log)
       └─ Return updated status

Note: PropertyAction is append-only event log
      PropertyMatch holds current status
```

---

## 9. Key Entry Points for E2E Testing

### 9.1 API Layer Entry Points

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/properties/search-optimized` | GET | Main search | Required |
| `/api/properties/details` | GET | Property details | - |
| `/api/properties/similar` | GET | Similar properties | - |
| `/api/buyer/properties-nearby` | GET | Nearby cities | Required (buyer) |
| `/api/buyer/liked-properties` | GET | Saved properties | Required (buyer) |
| `/api/buyer/like-property` | POST | Save/unsave | Required (buyer) |
| `/api/admin/properties` | GET | Admin list | Required (admin) |
| `/api/admin/upload-properties-v4` | POST | Bulk import | Required (admin) |
| `/api/property-actions` | POST | Like/pass action | Required (buyer) |
| `/api/realtor/purchase-lead` | POST | Buy lead | Required (realtor) |

### 9.2 Data Model Validation Points

1. **PropertyListing Validation**
   - Address parsing (Google Maps)
   - Financial calculations (loan, payment, interest)
   - Image quality analysis
   - Nearby cities population

2. **PropertyMatch Validation**
   - Buyer criteria matching algorithm
   - Budget compatibility checks
   - Location radius verification
   - Score calculation

3. **Search Criteria Validation**
   - Required fields (city, state)
   - Numeric ranges (bedrooms, bathrooms, payment)
   - Enum values (property types)
   - Coordinate bounds

### 9.3 Search Path Testing

```
Test Scenarios:
1. Basic Search
   - Center city with exact properties
   - Filter by budget
   - Filter by bedrooms/bathrooms
   
2. Nearby Cities Search
   - Center city with no direct matches
   - Expand to nearby cities
   - Verify radius and count

3. Similar Properties
   - Reference property characteristics
   - Price range matching (±20%)
   - Bedroom/bathroom flexibility

4. Edge Cases
   - City with no properties
   - Budget below minimum available
   - Large radius searches
   - Special characters in addresses
```

### 9.4 Performance Metrics to Track

```
Tracked Metrics:
- Search time (database query only)
- Total time (including processing)
- Properties per millisecond
- Nearby cities lookup time
- Pagination cursor validity
- API response time (target < 500ms)
```

---

## 10. Critical Business Logic

### 10.1 Property Matching Algorithm

**Critical Success Criteria:**
1. Monthly payment within budget (hard limit)
2. Down payment within budget (hard limit)
3. Location in preferred city/state (hard limit)
4. Additional criteria boost score if met

**Match Score:**
- All critical criteria met: score = (optional_met / optional_total)
- Any critical criterion fails: No match (score = 0)

### 10.2 Lead Purchase System

**Lead Purchase Requirements:**
- Realtor must have >= 1 credit
- Buyer must be marked as `isAvailableForPurchase: true`
- Only one purchase per buyer per realtor allowed

**After Purchase:**
- Buyer marked as `purchasedBy: realtorId`
- Buyer no longer available for other realtors
- Purchase recorded in LeadPurchase collection

### 10.3 Property Status Lifecycle

```
active → pending → sold / withdrawn / expired

- active: Actively listed, available for buyers
- pending: Under contract
- sold: Closed
- withdrawn: Delisted by owner
- expired: Listing period ended
```

---

## 11. Important Configuration Files

### 11.1 Firestore Security Rules
**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/firestore.rules`

Key Rules:
- Properties collection: read by all authenticated users
- BuyerProfiles: users can only read/update their own
- RealtorProfiles: users can only read/update their own
- Admin-only collections: restricted to admin role

### 11.2 Firestore Indexes
**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/firestore.indexes.json`

Contains compound index definitions for:
- Property search with budget filters
- Property search with bedroom/bathroom filters
- State + city + monthly payment ordering
- Nearby cities update timestamps

### 11.3 Firebase Configuration
**File:** `/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/firebase.ts`

Initializes:
- Firestore database (db)
- Firebase Authentication (auth)
- Cloud Storage (storage)
- Handles initialization failures gracefully

---

## 12. Summary: Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    OWNERFI PROPERTIES SYSTEM                     │
└─────────────────────────────────────────────────────────────────┘

DATA INGESTION:
  Admin uploads CSV/JSON
    ↓
  Data normalization (cities, states, lot sizes, addresses)
    ↓
  Validation (addresses, financials, images)
    ↓
  Image URL upgrading
    ↓
  Save to Firestore (properties collection)
    ↓
  Queue background job: populate nearby cities
    ↓
  Get nearby cities (30-mile radius) via Google Maps or local DB
    ↓
  Update properties with nearbyCities array

PROPERTY SEARCH:
  Buyer searches city/state
    ↓
  Get nearby cities for expansion
    ↓
  Firestore query with compound indexes
    ├─ Filter by state
    ├─ Filter by active status
    ├─ Filter by monthly payment
    ├─ Filter by down payment
    ├─ Filter by bedrooms (optional)
    └─ Filter by bathrooms (optional)
    ↓
  Post-query city filtering
    ↓
  Return sorted properties
    ↓
  Display in PropertyListingSwiper component

BUYER INTERACTIONS:
  Buyer likes property
    ↓
  POST /api/property-actions
    ├─ Update PropertyMatch status
    └─ Create PropertyAction record (immutable log)

REALTOR LEAD PURCHASE:
  Realtor finds buyer lead
    ↓
  POST /api/realtor/purchase-lead
    ├─ Check credits
    ├─ Verify buyer availability
    ├─ Create LeadPurchase record
    ├─ Deduct 1 credit
    └─ Return buyer contact info

ANALYTICS:
  View counts, favorite counts tracked
  Match scores calculated
  Performance metrics tracked
```

---

## 13. Testing Checklist for E2E Test Suite

### Property Data Models
- [ ] PropertyListing schema accepts all required fields
- [ ] PropertyListing with missing optional fields validates
- [ ] Financial calculations (monthly payment, LTV) correct
- [ ] Date formats (ISO 8601) handled correctly
- [ ] Nearby cities array populated correctly

### Property Search
- [ ] Search by city + state returns properties
- [ ] Budget filters (monthly/down payment) work correctly
- [ ] Bedroom/bathroom filters work correctly
- [ ] Nearby cities expansion increases results
- [ ] Pagination works with cursor-based offset
- [ ] Performance < 500ms for typical searches

### Location Services
- [ ] Address parsing returns correct coordinates
- [ ] Street View URLs generate correctly
- [ ] Nearby cities lookup returns expected radius
- [ ] Fallback to geocoding when local DB fails

### Buyer Interactions
- [ ] Buyer can like/unlike properties
- [ ] Liked properties persist
- [ ] Property matches calculated correctly
- [ ] Match score reflects criteria fulfillment

### Admin Operations
- [ ] Bulk property upload normalizes data
- [ ] Image URLs upgraded to highest resolution
- [ ] Address duplicates removed
- [ ] City names normalized correctly
- [ ] Background jobs process nearby cities

### Financial Validation
- [ ] Invalid financial data rejected
- [ ] Warnings generated for unusual values
- [ ] Monthly payment calculations verified
- [ ] Loan-to-value ratio calculated correctly

### Realtor Lead Purchase
- [ ] Credit deduction works atomically
- [ ] Buyer marked as purchased
- [ ] Lead can't be purchased twice
- [ ] Contact info returned to realtor

