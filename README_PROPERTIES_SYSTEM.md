# OwnerFi Properties System - Documentation Summary

This directory contains comprehensive documentation for the OwnerFi properties system, designed to help with end-to-end testing and system understanding.

## Documents Included

### 1. PROPERTIES_SYSTEM_OVERVIEW.md (Main Reference)
**A comprehensive 13-section guide covering:**
- Complete data models and schemas (PropertyListing, PropertyMatch, PropertyAction)
- All API endpoints with parameters and responses
- Geocoding and location services
- Search algorithms and filtering
- Display components and UI architecture
- Background jobs and workflows
- Validation and verification systems
- Data flow diagrams
- Testing entry points
- Business logic details
- Configuration files

**Best for:** Understanding the complete system architecture and how all components interact

### 2. PROPERTIES_SYSTEM_FILE_REFERENCE.md (Navigation Guide)
**A quick lookup table with:**
- File-by-file reference of all property-related code
- Quick search patterns for finding functionality
- Development workflow guidance
- Testing guidance by component
- Firestore collection structure

**Best for:** Quickly finding which file contains specific functionality

### 3. TESTING_ENTRY_POINTS.md (Testing Guide)
**Detailed E2E testing scenarios covering:**
- 12 major testing areas (ingestion, search, details, similar, actions, nearby, calculations, matching, geocoding, jobs, components, admin)
- 80+ specific test cases with expected results
- Performance benchmarks
- Happy path and error path testing
- Verification steps for each scenario

**Best for:** Writing and executing end-to-end tests

## Quick Start for Testing

### Step 1: Understand the System
Read **PROPERTIES_SYSTEM_OVERVIEW.md** sections 1-3 for:
- Property data models
- API endpoints
- Data fetching strategy

### Step 2: Locate Key Files
Use **PROPERTIES_SYSTEM_FILE_REFERENCE.md** to find:
- Core logic files
- API route handlers
- Validation and calculation functions

### Step 3: Write Tests
Reference **TESTING_ENTRY_POINTS.md** for:
- Exact test scenarios
- Expected responses
- Verification steps
- Edge cases and error paths

## Core System Architecture

### Data Layer
- **Firestore Collections:** properties, propertyMatches, propertyActions, buyerProfiles
- **Models:** PropertyListing, PropertyMatch, PropertyAction, PropertySearchCriteria
- **Indexes:** 7 compound indexes required for optimal search performance

### Business Logic Layer
- **Search:** `/src/lib/property-search-optimized.ts` - Optimized Firestore queries
- **Matching:** `/src/lib/matching.ts` - Buyer-property compatibility scoring
- **Calculations:** `/src/lib/property-calculations.ts` - Financial formulas
- **Geocoding:** `/src/lib/google-maps-service.ts` - Address parsing and coordinates
- **Locations:** `/src/lib/property-nearby-cities.ts` - 30-mile radius city discovery

### API Layer
- **Search:** GET `/api/properties/search-optimized` - Main search endpoint
- **Details:** GET `/api/properties/details` - Property details (batched)
- **Similar:** GET `/api/properties/similar` - Similar properties within 30 miles
- **Upload:** POST `/api/admin/upload-properties-v4` - Bulk import with normalization
- **Actions:** POST `/api/property-actions` - Like/pass buyer actions

### UI Layer
- **PropertyListingSwiper:** Tinder-like browsing component
- **Dashboard:** Buyer search and property browsing
- **Favorites:** Saved properties view

## Key Concepts

### Property Matching Algorithm
1. Monthly payment within budget (hard limit)
2. Down payment within budget (hard limit)  
3. Location in preferred city (hard limit)
4. Bedrooms and bathrooms (optional, boost score)
- Match score = optional_criteria_met / total_optional_criteria
- Only properties meeting ALL hard limits are returned

### Search Optimization
1. Firestore compound indexes filter at database level
2. Post-query city filtering on smaller result set
3. Nearby cities expansion (30-mile radius)
4. Cursor-based pagination for large result sets
5. Performance target: < 500ms for typical searches

### Data Normalization
1. Address cleaning (remove duplicated city/state/zip)
2. State code normalization (full names to abbreviations)
3. City name fixes (typo corrections)
4. Lot size conversion (acres to square feet)
5. Image URL upgrading (low-res to high-res)

### Background Jobs
- Asynchronous nearby cities population
- Non-blocking property creation
- Multi-strategy approach (local DB → coordinates → geocoding)
- Fallback from 30 to 45 miles if no cities found

## Critical Test Paths

### Happy Path: Full Lifecycle
```
Admin uploads property
  → Data normalized
  → Validation passes
  → Saved to Firestore
  → Background job queues

Buyer searches
  → Gets nearby cities
  → Filters by budget/requirements
  → Receives matched properties

Buyer browses properties
  → Views images
  → Likes property
  → Action recorded in PropertyMatch and PropertyAction

Realtor views lead
  → Sees buyer's liked properties
  → Can contact buyer
```

### Error Paths
- Property upload with invalid data → Validation errors
- Search with no results → Empty array
- Missing required parameters → 400 Bad Request
- Unauthorized access → 401/403 errors
- Database errors → 500 errors with logging

## Performance Targets

| Operation | Target | File |
|-----------|--------|------|
| Search | < 500ms | `/src/lib/property-search-optimized.ts` |
| Similar Properties | < 400ms | `/src/lib/property-search-optimized.ts` |
| Property Details | < 200ms | `/src/app/api/properties/details/route.ts` |
| Address Parsing | < 1s | `/src/lib/google-maps-service.ts` |
| Background Jobs | < 5s | `/src/lib/background-jobs.ts` |
| Financial Calculation | < 10ms | `/src/lib/property-calculations.ts` |

## Testing Checklist

### Property Data Models
- [ ] PropertyListing schema accepts all fields
- [ ] Missing optional fields handled correctly
- [ ] Financial calculations accurate
- [ ] Date formats ISO 8601 compliant
- [ ] Nearby cities array populated

### Search Operations
- [ ] Search by city + state returns properties
- [ ] Budget filters work correctly
- [ ] Bedroom/bathroom filters work
- [ ] Nearby cities expansion increases results
- [ ] Pagination with cursor works
- [ ] Performance < 500ms

### Location Services
- [ ] Address parsing returns coordinates
- [ ] Street View URLs generate
- [ ] Nearby cities lookup correct radius
- [ ] Fallback geocoding works

### Buyer Interactions
- [ ] Like/unlike properties work
- [ ] Liked properties persist
- [ ] Property matches calculated correctly
- [ ] Match scores reflect criteria

### Admin Operations
- [ ] Bulk uploads normalized correctly
- [ ] Image URLs upgraded
- [ ] Addresses deduplicated
- [ ] City names fixed
- [ ] Financial values validated

## Firestore Setup

### Required Collections
```
properties/
propertyMatches/
propertyActions/
buyerProfiles/
realtors/
buyerLeadPurchases/
leadDisputes/
```

### Required Indexes
See `firestore.indexes.json` or `getRequiredFirestoreIndexes()` in:
`/src/lib/property-search-optimized.ts`

Includes compound indexes for:
- State + monthly payment
- State + down payment
- State + bedrooms
- State + bathrooms
- And more...

## Common Tasks

### To Add Property Upload Support
1. Use `/src/app/api/admin/upload-properties-v4/route.ts` as template
2. Implement data normalization (see `/src/lib/property-auto-cleanup.ts`)
3. Add validation (see `/src/lib/validation.ts`)
4. Queue background jobs for nearby cities

### To Optimize Search Performance
1. Check Firestore indexes in `firestore.indexes.json`
2. Review constraints in `/src/lib/property-search-optimized.ts`
3. Profile query time vs post-query filtering
4. Test against performance targets

### To Add Property Filters
1. Define in `PropertySearchCriteria` interface
2. Add Firestore constraint in `searchPropertiesOptimized()`
3. Update validation schema
4. Add API parameter
5. Test with various values

### To Add Financial Calculations
1. Add formula to `/src/lib/property-calculations.ts`
2. Add validation rules to `validatePropertyFinancials()`
3. Export function for use in APIs
4. Add unit tests

## Environment Variables Required

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
GOOGLE_MAPS_API_KEY=...
```

## Support & Questions

For questions about specific components, refer to:
1. **Architecture Questions** → PROPERTIES_SYSTEM_OVERVIEW.md
2. **File Location Questions** → PROPERTIES_SYSTEM_FILE_REFERENCE.md
3. **Testing Questions** → TESTING_ENTRY_POINTS.md

---

**Last Updated:** October 25, 2025
**System Version:** Optimized Property Marketplace v4
**Documentation Completeness:** Comprehensive end-to-end coverage
