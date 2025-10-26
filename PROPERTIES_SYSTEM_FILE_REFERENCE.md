# OwnerFi Properties System - File Reference Guide

## Quick Navigation to Key Files

### Core Data Models & Schemas

| File | Purpose | Key Exports |
|------|---------|------------|
| `/src/lib/property-schema.ts` | PropertyListing schema definition | `PropertyListing`, `PropertySearchCriteria`, `PropertyWorkflow`, `PropertyAnalytics` |
| `/src/lib/firebase-models.ts` | All Firestore models + collection names | `COLLECTIONS`, `User`, `BuyerProfile`, `PropertyMatch`, `LeadPurchase` |
| `/src/lib/property-system.ts` | Clean property system architecture | `BuyerProfile`, `PropertyMatch`, `PropertyAction`, `PropertySystemService` |

### API Layer (Search & Retrieval)

| File | Endpoint | Purpose |
|------|----------|---------|
| `/src/app/api/properties/search-optimized/route.ts` | GET `/api/properties/search-optimized` | Main optimized search with nearby cities |
| `/src/app/api/properties/details/route.ts` | GET `/api/properties/details` | Fetch property details by IDs (batched) |
| `/src/app/api/properties/similar/route.ts` | GET `/api/properties/similar` | Find similar properties within 30-mile radius |
| `/src/app/api/buyer/properties-nearby/route.ts` | GET `/api/buyer/properties-nearby` | Discover nearby cities with available properties |
| `/src/app/api/buyer/liked-properties/route.ts` | GET `/api/buyer/liked-properties` | Fetch buyer's saved properties |
| `/src/app/api/buyer/like-property/route.ts` | POST `/api/buyer/like-property` | Save/unsave property |
| `/src/app/api/property-actions/route.ts` | POST `/api/property-actions` | Like/pass/undo property actions |

### Admin Operations

| File | Endpoint | Purpose |
|------|----------|---------|
| `/src/app/api/admin/properties/route.ts` | GET/PUT `/api/admin/properties` | List and update properties (admin only) |
| `/src/app/api/admin/upload-properties-v4/route.ts` | POST `/api/admin/upload-properties-v4` | Bulk property import with normalization |
| `/src/app/api/admin/properties/create/route.ts` | POST `/api/admin/properties/create` | Create single property |
| `/src/app/api/admin/properties/deduplicate/route.ts` | POST `/api/admin/properties/deduplicate` | Remove duplicate properties |
| `/src/app/api/admin/properties/export/route.ts` | GET `/api/admin/properties/export` | Export properties to CSV/JSON |

### Geocoding & Location Services

| File | Purpose | Key Functions |
|------|---------|---|
| `/src/lib/google-maps-service.ts` | Google Maps API integration | `parseAddress()`, `getStreetViewImage()`, `enhancePropertyWithGoogleMaps()`, `batchParseAddresses()` |
| `/src/lib/property-nearby-cities.ts` | Nearby cities population | `populateNearbyCitiesForProperty()`, `getNearbyCitiesUpdate()` |
| `/src/lib/property-enhancement.ts` | Property enhancement utility | `queueNearbyCitiesForProperty()`, `populateNearbyCitiesForPropertyFast()`, `enhancePropertiesWithNearbyCities()` |
| `/src/lib/cities.ts` | Basic cities database | `getCitiesWithinRadius()`, `calculateDistance()` |
| `/src/lib/cities-service.ts` | Enhanced cities service | `getNearbyCitiesDirect()` |
| `/src/lib/cities-service-v2.ts` | Ultra-fast cities lookup | `getNearbyCitiesUltraFast()` |
| `/src/lib/comprehensive-cities.ts` | Comprehensive US cities database | `getCitiesWithinRadiusComprehensive()`, `getCitiesWithinRadiusByCoordinates()` |
| `/src/lib/comprehensive-us-cities.ts` | US cities data | `getCitiesNearProperty()` |

### Search & Filtering

| File | Purpose | Key Functions |
|------|---------|---|
| `/src/lib/property-search-optimized.ts` | Optimized search implementation | `searchPropertiesOptimized()`, `searchPropertiesWithNearby()`, `getSimilarProperties()`, `getRequiredFirestoreIndexes()` |
| `/src/lib/matching.ts` | Buyer-property matching algorithm | `isPropertyMatch()`, `matchBuyerToProperties()` |

### Data Validation & Processing

| File | Purpose | Key Functions |
|------|---------|---|
| `/src/lib/property-calculations.ts` | Financial calculations | `calculatePropertyFinancials()`, `calculateMonthlyPayment()`, `validatePropertyFinancials()`, `calculateTotalInterest()`, `calculateLTV()` |
| `/src/lib/property-auto-cleanup.ts` | Automatic data cleanup | `cleanAddress()`, `upgradeZillowImageUrl()` |
| `/src/lib/validation.ts` | Zod validation schemas | `propertySchema`, `validateRequest()` |
| `/src/lib/image-quality-analyzer.ts` | Image quality analysis | (Scoring system for property images) |

### Background Jobs & Workflows

| File | Purpose | Key Functions |
|------|---------|---|
| `/src/lib/background-jobs.ts` | Background job queue | `queueNearbyCitiesJob()`, `processJobQueue()` |

### UI Components

| File | Purpose | Props |
|------|---------|-------|
| `/src/components/ui/PropertySwiper.tsx` | Tinder-like property browsing | `PropertyListingSwiperProps` (properties, onLike, onPass, favorites, passedIds, isLoading) |
| `/src/components/SEO/PropertySchema.tsx` | JSON-LD structured data | SEO schema generation |
| `/src/components/SEO/JsonLd.tsx` | JSON-LD helper component | (SEO helpers) |

### Dashboard Pages

| File | Purpose | Features |
|------|---------|----------|
| `/src/app/dashboard/page.tsx` | Buyer dashboard | Show matched properties, apply filters, like/pass |
| `/src/app/dashboard/favorites/page.tsx` | Liked properties view | Show buyer's saved properties |
| `/src/app/dashboard/liked/page.tsx` | Liked properties view (alternate) | (Alternative implementation) |

### Realtor Operations

| File | Endpoint | Purpose |
|------|----------|---------|
| `/src/app/api/realtor/purchase-lead/route.ts` | POST `/api/realtor/purchase-lead` | Realtor purchases buyer lead (deducts 1 credit) |
| `/src/app/api/realtor/buyer-liked-properties/route.ts` | GET `/api/realtor/buyer-liked-properties` | View properties liked by purchased lead |

### Firebase & Database

| File | Purpose | Exports |
|------|---------|---------|
| `/src/lib/firebase.ts` | Firebase initialization | `db`, `auth`, `storage` |
| `/src/lib/firebase-admin.ts` | Firebase Admin SDK setup | (Admin operations) |
| `/src/lib/firebase-db.ts` | Firestore database helpers | (Database utilities) |
| `/src/lib/firebase-safe.ts` | Safe database access | `getSafeDb()` |
| `/src/lib/firestore.ts` | Firestore helpers | `firestoreHelpers` |
| `/src/lib/unified-db.ts` | Unified database interface | (Abstraction layer) |

### Configuration & Types

| File | Purpose |
|------|---------|
| `/firestore.rules` | Firestore security rules |
| `/firestore.indexes.json` | Firestore compound index definitions |
| `/firebase.json` | Firebase project configuration |
| `/src/types/session.ts` | Extended session types |

### Utilities

| File | Purpose |
|------|---------|
| `/src/lib/logger.ts` | Logging utilities |
| `/src/lib/auth.ts` | Authentication helpers |
| `/src/lib/auth-utils.ts` | Auth utilities |
| `/src/lib/error-monitoring.ts` | Error tracking |

---

## Quick Search Patterns

### Finding Files by Functionality

**Property Upload & Normalization:**
- `/src/app/api/admin/upload-properties-v4/route.ts` - Main upload endpoint
- `/src/lib/property-auto-cleanup.ts` - Cleanup utilities

**Property Search:**
- `/src/lib/property-search-optimized.ts` - Core search logic
- `/src/app/api/properties/search-optimized/route.ts` - API endpoint

**Buyer Interactions:**
- `/src/app/api/buyer/like-property/route.ts` - Save property
- `/src/app/api/property-actions/route.ts` - Like/pass actions
- `/src/app/dashboard/page.tsx` - Dashboard UI

**Location/Geocoding:**
- `/src/lib/google-maps-service.ts` - Google Maps API
- `/src/lib/property-nearby-cities.ts` - Nearby cities logic
- `/src/lib/background-jobs.ts` - Background job queue

**Financial Validation:**
- `/src/lib/property-calculations.ts` - Payment calculations
- `/src/lib/validation.ts` - Zod schemas

**Database:**
- `/src/lib/firebase-models.ts` - Data models & collection names
- `/firestore.indexes.json` - Required indexes

---

## Development Workflow

### To Add a New Property Feature:

1. **Define Schema**: Update `/src/lib/property-schema.ts`
2. **Create API Route**: Add new file in `/src/app/api/properties/` or `/src/app/api/admin/`
3. **Add Validation**: Update schemas in `/src/lib/validation.ts` if needed
4. **Create Component**: Add UI in `/src/components/` if needed
5. **Update Tests**: Reference this guide for E2E test points

### To Optimize Search:

1. Check current indexes in `/firestore.indexes.json`
2. Review `/src/lib/property-search-optimized.ts` for constraints
3. Update Firestore indexes as needed (defined in `getRequiredFirestoreIndexes()`)
4. Test performance against target (< 500ms)

### To Add Property Calculations:

1. Add formula to `/src/lib/property-calculations.ts`
2. Add validation rules to the `validatePropertyFinancials()` function
3. Export function for use in API routes and components

---

## Key Firestore Collections

```
Firestore Database Structure:

properties/
  ├─ [propertyId]
  │   ├─ address, city, state, zipCode
  │   ├─ bedrooms, bathrooms, squareFeet
  │   ├─ listPrice, monthlyPayment, downPaymentAmount
  │   ├─ interestRate, termYears, balloonPayment
  │   ├─ imageUrls[], nearbyCities[]
  │   ├─ status (active/pending/sold/withdrawn/expired)
  │   └─ ... [other fields]
  │
propertyMatches/
  ├─ [matchId]
  │   ├─ propertyId, buyerId
  │   ├─ matchScore, status (pending/liked/disliked)
  │   └─ withinBudget, withinRadius, meetsRequirements
  │
propertyActions/
  ├─ [actionId]
  │   ├─ buyerId, propertyId
  │   ├─ action (like/pass/undo_like/undo_pass)
  │   └─ timestamp, source
  │
buyerProfiles/
  ├─ [buyerId]
  │   ├─ userId, firstName, lastName, email, phone
  │   ├─ preferredCity, preferredState, searchRadius
  │   ├─ maxMonthlyPayment, maxDownPayment
  │   ├─ minBedrooms?, minBathrooms?
  │   └─ likedPropertyIds[]
```

---

## Testing Guidance by Component

### Search Tests → `/src/lib/property-search-optimized.ts`
- Test `searchPropertiesOptimized()` with various criteria
- Test `searchPropertiesWithNearby()` with nearby city expansion
- Test pagination with `lastDoc` cursor

### Matching Tests → `/src/lib/matching.ts`
- Test `isPropertyMatch()` with properties at budget boundaries
- Test match score calculation
- Test critical vs optional criteria

### Financial Tests → `/src/lib/property-calculations.ts`
- Test `calculateMonthlyPayment()` with standard mortgage formula
- Test `validatePropertyFinancials()` with invalid data
- Test edge cases (0 interest rate, short terms, etc.)

### API Tests → `/src/app/api/properties/*.ts`
- Test authentication/authorization
- Test query parameter validation
- Test error handling and edge cases
- Test pagination

