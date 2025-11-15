# RentCast API Comprehensive Catalog

**Last Updated:** November 15, 2025
**API Documentation:** https://developers.rentcast.io/reference/introduction
**API Base URL:** `https://api.rentcast.io/v1`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limits & Billing](#rate-limits--billing)
4. [Property Data Endpoints](#property-data-endpoints)
5. [Property Valuation Endpoints (AVM)](#property-valuation-endpoints-avm)
6. [Property Listings Endpoints](#property-listings-endpoints)
7. [Market Data Endpoints](#market-data-endpoints)
8. [Complete Response Schemas](#complete-response-schemas)
9. [Best Practices for Minimizing API Calls](#best-practices-for-minimizing-api-calls)
10. [Recommendations for Value + Rent Data](#recommendations-for-value--rent-data)

---

## Overview

### What RentCast Offers

RentCast provides access to **140+ million property records** with nationwide US coverage for residential and commercial properties. The platform processes over **500,000 record and listing updates daily**.

**Key Capabilities:**
- Property records with 100+ data points (structure, tax, owner, history)
- Real-time property value estimates (AVM)
- Real-time rent estimates
- Active sale and rental listings
- Market statistics and historical trends
- Owner contact information and transaction history

**Data Coverage:**
- **96%+ coverage** for residential properties (Single Family, Condo, Townhouse, 2-4 units)
- **90%+ coverage** for commercial multi-family (5+ units)
- All 50 US states
- Does NOT include: office, retail, industrial, or farm properties

**Update Frequency:**
- Property records: Weekly
- Listings: Daily (new listings appear within 12-24 hours)
- Market data: Daily for current month; monthly snapshots for historical

---

## Authentication

**Method:** Header-based authentication

**Header:** `X-Api-Key: YOUR_API_KEY`

**Getting API Key:**
1. Create account at https://app.rentcast.io/app/api
2. Generate API key from dashboard
3. Free tier includes 50 requests/month for testing

**Example Request:**
```bash
curl --request GET \
  --url 'https://api.rentcast.io/v1/properties?address=5500+Grand+Lake+Dr,+San+Antonio,+TX+78244' \
  --header 'Accept: application/json' \
  --header 'X-Api-Key: YOUR_API_KEY'
```

---

## Rate Limits & Billing

### Rate Limits

**Hard Limit:** 20 requests per second per API key

**Error Response (HTTP 429):**
```json
{
  "status": 429,
  "error": "auth/rate-limit-exceeded",
  "message": "The rate limit of 20 requests per second has been exceeded"
}
```

**Strategies to Manage:**
- Create separate API keys for different applications/integrations
- Implement client-side throttling
- Use request queuing

### Billing Structure

**Free Tier:**
- 50 API requests per month
- No long-term contracts
- Overage fees apply beyond limit

**Paid Plans:**
- Monthly billing cycle
- Fixed monthly price + per-request overage fees
- Prorated refunds for unused portions
- Enterprise plans available for high-volume users

**Billing Rules:**
- Only successful requests (HTTP 200) count toward quota
- Error responses (4xx, 5xx) are NOT billed
- Request size/data volume doesn't matter - 1 request = 1 credit
- All endpoints cost the same per request

**Important:** Specific per-request pricing not disclosed in documentation. Contact RentCast or visit website for current pricing.

---

## Property Data Endpoints

### 1. Property Records Search

**Endpoint:** `GET /v1/properties`

**Purpose:** Search for property records by address, location, or geographic area. Returns comprehensive public record data.

**Use Cases:**
- Lookup single property details by address
- Find properties sold in an area within date range
- Get property ownership information
- Access tax assessment and sale history
- Find comparable properties

#### Query Parameters

**Location Parameters:**
- `address` (String) - Full property address: "Street, City, State, Zip"
- `city` (String) - City name
- `state` (String) - Two-character state code
- `zipCode` (String) - Five-digit zip code
- `latitude` (Number) - Geographic coordinate (use with longitude + radius)
- `longitude` (Number) - Geographic coordinate (use with latitude + radius)
- `radius` (Number) - Search radius in miles for circular area searches

**Property Attribute Filters:**
- `propertyType` (String|Array) - Filter by type (supports pipe-delimited: `Condo|Townhouse`)
  - Valid values: `Single Family`, `Condo`, `Townhouse`, `Manufactured`, `Multi-Family`, `Apartment`, `Land`
- `bedrooms` (String) - Number or range (e.g., `3` or `2:4` or `*:3` or `2:*`)
- `bathrooms` (String) - Number or range (same format as bedrooms)
- `squareFootage` (String) - Square feet range (e.g., `1000:2000`)
- `lotSize` (String) - Lot size range in square feet
- `yearBuilt` (String) - Year or year range (e.g., `2000:*` for 2000+)

**Sale-Related Filters:**
- `saleDateRange` (Number) - Days lookback for sold properties (e.g., `90` for last 90 days)

**Pagination & Control:**
- `limit` (Number) - Results per request (default: 50, max: 500)
- `offset` (Number) - Starting index for pagination (default: 0)
- `includeTotalCount` (Boolean) - Include X-Total-Count header (slows response)
- `suppressLogging` (Boolean) - Prevent internal logging when true

#### Response Data

Returns array of property records with up to 500 results per request. See [Property Data Schema](#property-data-schema) for complete field list.

**Pagination Headers:**
- `X-Limit` - Limit value used
- `X-Offset` - Offset value used
- `X-Total-Count` - Total matching results (if includeTotalCount=true)

**Example Request:**
```bash
GET /v1/properties?city=Austin&state=TX&propertyType=Single+Family&bedrooms=3:4&saleDateRange=90&limit=100
```

---

### 2. Random Property Records

**Endpoint:** `GET /v1/properties/random`

**Purpose:** Retrieve up to 500 randomly selected property records for testing or random sampling use cases.

**Query Parameters:**
- Same filtering parameters as `/v1/properties`
- `limit` (Number) - Number of random records (max: 500)

**Use Cases:**
- Integration testing with real data
- Random sampling for analysis
- Generating example datasets

---

### 3. Property by ID

**Endpoint:** `GET /v1/properties/{id}`

**Purpose:** Retrieve a specific property record using its RentCast internal ID.

**Path Parameters:**
- `id` (String) - RentCast property identifier (format: "5500-Grand-Lake-Dr,-San-Antonio,-TX-78244")

**Use Cases:**
- Fetch property details when you have the ID from previous queries
- Direct property lookup without address parsing
- Reliable reference to specific property

**Note:** Property IDs can be obtained from other endpoint responses (valuations, listings, property searches).

---

## Property Valuation Endpoints (AVM)

### 1. Value Estimate (Property Value)

**Endpoint:** `GET /v1/avm/value`

**Purpose:** Get current market value or after-repair value (ARV) estimate using RentCast's automated valuation model (AVM).

**Returns:**
- Estimated property value
- Price range (85% confidence interval)
- Subject property attributes
- Comparable sale listings with correlation scores

#### Query Parameters

**Location (Required - Choose One):**
- `address` (String) - Property address: "Street, City, State, Zip"
- `latitude` + `longitude` (Number) - Geographic coordinates

**Subject Property Attributes (Optional but Recommended):**
- `propertyType` (String) - Property classification
- `bedrooms` (Number) - Bedroom count
- `bathrooms` (Number) - Bathroom count
- `squareFootage` (Number) - Living area in sq ft

**AVM Control Parameters:**
- `lookupSubjectAttributes` (Boolean) - Auto-lookup property attributes (default: true)
  - Set to `false` if you always provide your own attributes
- `maxRadius` (Number) - Maximum distance in miles for comparable properties
- `daysOld` (Number) - Maximum age of comparable listings in days
- `compCount` (Number) - Number of comparable properties to use (default: 10)

#### Response Fields

```json
{
  "price": 450000,
  "priceRangeLow": 405000,
  "priceRangeHigh": 495000,
  "subjectProperty": { /* Full property object */ },
  "comparables": [
    {
      /* Property fields plus: */
      "status": "Inactive",
      "price": 455000,
      "listingType": "Standard",
      "listedDate": "2024-06-24T00:00:00.000Z",
      "removedDate": "2024-08-15T00:00:00.000Z",
      "daysOnMarket": 52,
      "distance": 0.3,
      "daysOld": 92,
      "correlation": 0.94
    }
  ]
}
```

#### Important Notes

**Multi-Family Properties:** Returns value for the ENTIRE building, not individual units.

**Accuracy Tips:**
- Provide property attributes for better accuracy
- Adjust `maxRadius` and `daysOld` if you get "not enough comps" errors
- Start with default parameters and adjust as needed
- Comparables are sorted by `correlation` (highest first)

**Use Cases:**
- Property valuation for investment analysis
- After-repair value (ARV) estimation
- Market value estimates for listings
- Portfolio valuation

---

### 2. Rent Estimate (Rental Value)

**Endpoint:** `GET /v1/avm/rent/long-term`

**Purpose:** Get estimated monthly rent for long-term rental properties using RentCast's AVM.

**Returns:**
- Estimated monthly rent
- Rent range (85% confidence interval)
- Subject property attributes
- Comparable rental listings with correlation scores

#### Query Parameters

**Same parameters as Value Estimate endpoint:**
- Location: `address` OR `latitude` + `longitude`
- Property attributes: `propertyType`, `bedrooms`, `bathrooms`, `squareFootage`
- AVM controls: `lookupSubjectAttributes`, `maxRadius`, `daysOld`, `compCount`

#### Response Fields

```json
{
  "rent": 2450,
  "rentRangeLow": 2205,
  "rentRangeHigh": 2695,
  "subjectProperty": { /* Full property object */ },
  "comparables": [
    {
      /* Property fields plus: */
      "status": "Active",
      "price": 2500,
      "listingType": "Standard",
      "listedDate": "2024-10-15T00:00:00.000Z",
      "lastSeenDate": "2024-11-14T00:00:00.000Z",
      "daysOnMarket": 30,
      "distance": 0.5,
      "daysOld": 1,
      "correlation": 0.89
    }
  ]
}
```

#### Important Notes

**Multi-Family Properties:** Returns rent estimate for a SINGLE UNIT, not the entire building (opposite of value endpoint).

**Use Cases:**
- Rental property investment analysis
- Setting rental rates for listings
- Market rent comparisons
- Cash flow projections

---

## Property Listings Endpoints

### 1. Sale Listings Search

**Endpoint:** `GET /v1/listings/sale`

**Purpose:** Search for active and inactive properties listed for sale.

**Returns:** Property listings with MLS data, agent/office contacts, listing history, and status.

#### Query Parameters

**Location Parameters:** (Same as Property Records)
- `address`, `city`, `state`, `zipCode`
- `latitude`, `longitude`, `radius`

**Property Filters:** (Same as Property Records)
- `propertyType`, `bedrooms`, `bathrooms`, `squareFootage`, `lotSize`, `yearBuilt`

**Listing-Specific Filters:**
- `price` (String) - Price range (e.g., `300000:500000`)
- `daysListed` (String) - Days on market range

**Pagination:**
- `limit` (Number) - Max 500
- `offset` (Number) - Pagination offset

#### Response Data

Returns array of sale listings sorted by `lastSeenDate` (descending). See [Property Listings Schema](#property-listings-schema).

**Key Fields:**
- Listing status (Active/Inactive)
- Listed price
- Listing type (Standard, New Construction, Foreclosure, Short Sale)
- MLS name and number
- Agent, office, and builder contact info
- Days on market
- Listing history with price changes

---

### 2. Sale Listing by ID

**Endpoint:** `GET /v1/listings/sale/{id}`

**Purpose:** Retrieve specific sale listing by RentCast ID.

**Path Parameters:**
- `id` (String) - RentCast listing identifier

---

### 3. Rental Listings Search

**Endpoint:** `GET /v1/listings/rental/long-term`

**Purpose:** Search for active and inactive long-term rental listings.

**Query Parameters:** Same as Sale Listings endpoint

**Note:** The `price` field represents monthly rent amount for rental listings.

---

### 4. Rental Listing by ID

**Endpoint:** `GET /v1/listings/rental/long-term/{id}`

**Purpose:** Retrieve specific rental listing by RentCast ID.

**Path Parameters:**
- `id` (String) - RentCast listing identifier

---

## Market Data Endpoints

### Market Statistics

**Endpoint:** `GET /v1/markets`

**Purpose:** Retrieve aggregate market statistics and historical trends by zip code.

#### Query Parameters

**Required:**
- `zipCode` (String) - Five-digit zip code

#### Response Data

Returns comprehensive market statistics for both sale and rental markets:

**Top-Level Structure:**
```json
{
  "id": "78244",
  "zipCode": "78244",
  "saleData": { /* Sale market statistics */ },
  "rentalData": { /* Rental market statistics */ }
}
```

**Each market (sale/rental) includes:**

1. **Overall Statistics:**
   - Average, median, min, max prices (or rents)
   - Average, median, min, max price per square foot
   - Average, median, min, max square footage
   - Average, median, min, max days on market
   - New listings count
   - Total listings count

2. **By Property Type:** `dataByPropertyType[]`
   - Same statistics segmented by: Single Family, Condo, Townhouse, Manufactured, Multi-Family, Apartment, Land

3. **By Bedroom Count:** `dataByBedrooms[]`
   - Same statistics segmented by bedroom count (0 = studio, 1-6+)

4. **Historical Data:** `history` object
   - Monthly snapshots keyed by YYYY-MM format
   - Each month includes all statistics above
   - Sale data: Available from January 2024 onward
   - Rental data: Available from April 2020 onward

**Last Updated:**
- `saleData.lastUpdatedDate` - ISO 8601 timestamp
- `rentalData.lastUpdatedDate` - ISO 8601 timestamp

**Use Cases:**
- Market trend analysis
- Comparative market analysis (CMA)
- Investment area research
- Historical price tracking
- Rental rate trends
- Market heat mapping

**Note:** Some months may have gaps if insufficient listing data was available.

---

## Complete Response Schemas

### Property Data Schema

**Endpoint:** All `/v1/properties` endpoints

```json
{
  // Identifiers
  "id": "5500-Grand-Lake-Dr,-San-Antonio,-TX-78244",
  "formattedAddress": "5500 Grand Lake Dr, San Antonio, TX 78244",
  "addressLine1": "5500 Grand Lake Dr",
  "addressLine2": "Apt 12",

  // Location
  "city": "San Antonio",
  "state": "TX",
  "stateFips": "48",
  "zipCode": "78244",
  "county": "Bexar",
  "countyFips": "029",
  "latitude": 29.475962,
  "longitude": -98.351442,

  // Property Characteristics
  "propertyType": "Single Family",
  "bedrooms": 3,
  "bathrooms": 2,
  "squareFootage": 1878,
  "lotSize": 8850,
  "yearBuilt": 1973,

  // Property Records
  "assessorID": "05076-103-0500",
  "legalDescription": "CB 5076A BLK 3 LOT 50",
  "subdivision": "WOODLAKE",
  "zoning": "RH",

  // Sales Data
  "lastSaleDate": "2024-11-18T00:00:00.000Z",
  "lastSalePrice": 270000,

  // HOA
  "hoa": {
    "fee": 175
  },

  // Features Object
  "features": {
    // Structural
    "architectureType": "Ranch",
    "floorCount": 1,
    "roomCount": 7,
    "unitCount": 1,
    "foundationType": "Slab",
    "roofType": "Composition Shingle",

    // Climate Control
    "cooling": true,
    "coolingType": "Central",
    "heating": true,
    "heatingType": "Forced Air",

    // Exterior
    "exteriorType": "Brick/Wood",
    "fireplace": true,
    "fireplaceType": "Masonry",

    // Parking
    "garage": true,
    "garageType": "Attached",
    "garageSpaces": 2,

    // Amenities
    "pool": false,
    "poolType": null,
    "viewType": null
  },

  // Tax Assessments (keyed by year)
  "taxAssessments": {
    "2024": {
      "year": 2024,
      "value": 285000,
      "land": 45000,
      "improvements": 240000
    },
    "2023": { /* ... */ }
  },

  // Property Taxes (keyed by year)
  "propertyTaxes": {
    "2024": {
      "year": 2024,
      "total": 6745
    },
    "2023": { /* ... */ }
  },

  // Ownership
  "owner": {
    "names": ["Rolando Villarreal"],
    "type": "Individual",
    "mailingAddress": {
      "id": "5500-Grand-Lake-Dr,-San-Antonio,-TX-78244",
      "formattedAddress": "5500 Grand Lake Dr, San Antonio, TX 78244",
      "addressLine1": "5500 Grand Lake Dr",
      "addressLine2": null,
      "city": "San Antonio",
      "state": "TX",
      "zipCode": "78244"
    }
  },
  "ownerOccupied": true,

  // Sale History (keyed by date YYYY-MM-DD)
  "history": {
    "2024-11-18": {
      "event": "Sale",
      "date": "2024-11-18T00:00:00.000Z",
      "price": 270000
    },
    "2018-05-10": { /* ... */ }
  }
}
```

**Property Type Enum:**
- `Single Family` - Detached single-family home
- `Condo` - Condominium unit in HOA
- `Townhouse` - Single-family with shared walls
- `Manufactured` - Pre-fabricated/mobile home
- `Multi-Family` - Residential building (2-4 units)
- `Apartment` - Commercial multi-family (5+ units)
- `Land` - Vacant undeveloped parcel

**Owner Type Enum:**
- `Individual`
- `Organization`

**Feature Value Enumerations:**
- Architecture: Ranch, Colonial, Townhouse, Contemporary, etc.
- Cooling/Heating: Central, Wall Unit, Heat Pump, Forced Air, etc.
- Exterior: Brick, Wood, Vinyl Siding, Stucco, etc.
- Foundation: Slab, Crawl Space, Basement, etc.
- Garage: Attached, Detached, Carport, etc.
- Roof: Composition Shingle, Tile, Metal, etc.

**Data Availability:** Fields vary by county/state. API returns all available data for each property.

---

### Property Listings Schema

**Endpoints:** `/v1/listings/sale` and `/v1/listings/rental/long-term`

```json
{
  // All Property Data fields PLUS:

  // Listing Status
  "status": "Active",  // or "Inactive"
  "price": 899000,  // Listed price for sales, monthly rent for rentals
  "listingType": "Standard",  // Standard, New Construction, Foreclosure, Short Sale

  // Listing Timeline
  "listedDate": "2024-06-24T00:00:00.000Z",
  "removedDate": "2024-08-15T00:00:00.000Z",  // null if still active
  "createdDate": "2024-06-24T00:00:00.000Z",
  "lastSeenDate": "2024-11-14T00:00:00.000Z",
  "daysOnMarket": 99,

  // MLS Information
  "mlsName": "UnlockMLS",
  "mlsNumber": "5519228",

  // Agent Contact
  "listingAgent": {
    "name": "Jennifer Welch",
    "phone": "5124313110",
    "email": "jennifer@example.com",
    "website": "https://jenniferrealestate.com"
  },

  // Office Contact
  "listingOffice": {
    "name": "Gottesman Residential RE",
    "phone": "5124512422",
    "email": "office@gottesmanre.com",
    "website": "https://gottesmanre.com"
  },

  // Builder (New Construction only)
  "builder": {
    "name": "Pulte Homes",
    "development": "Hampton Lakes at River Hall",
    "phone": "2392300326",
    "website": "https://www.pulte.com"
  },

  // Listing History (keyed by date YYYY-MM-DD)
  "history": {
    "2024-08-15": {
      "event": "Removed",  // or "Listed", "PriceChange"
      "price": 899000,
      "listingType": "Standard",
      "listedDate": "2024-06-24T00:00:00.000Z",
      "removedDate": "2024-08-15T00:00:00.000Z",
      "daysOnMarket": 52
    },
    "2024-07-01": { /* ... */ }
  }
}
```

**Listing Type Enum:**
- `Standard` - Regular listing
- `New Construction` - New build
- `Foreclosure` - Bank-owned
- `Short Sale` - Pre-foreclosure

**Status Enum:**
- `Active` - Currently listed
- `Inactive` - Removed/sold/rented

---

### Property Valuation Schema

**Endpoints:** `/v1/avm/value` and `/v1/avm/rent/long-term`

**Value Estimate Response:**
```json
{
  "price": 450000,
  "priceRangeLow": 405000,
  "priceRangeHigh": 495000,
  "subjectProperty": {
    /* Full property object with all property data fields */
  },
  "comparables": [
    {
      /* Full property object PLUS: */
      "status": "Inactive",
      "price": 455000,
      "listingType": "Standard",
      "listedDate": "2024-06-24T00:00:00.000Z",
      "removedDate": "2024-08-15T00:00:00.000Z",
      "lastSeenDate": "2024-08-15T00:00:00.000Z",
      "daysOnMarket": 52,
      "distance": 0.3,  // Miles from subject property
      "daysOld": 92,  // Days since last activity
      "correlation": 0.94  // Similarity score (0-1, higher is more similar)
    }
  ]
}
```

**Rent Estimate Response:**
```json
{
  "rent": 2450,
  "rentRangeLow": 2205,
  "rentRangeHigh": 2695,
  "subjectProperty": {
    /* Full property object */
  },
  "comparables": [
    {
      /* Same structure as value comparables */
      "status": "Active",
      "price": 2500,  // Monthly rent
      "correlation": 0.89
    }
  ]
}
```

**Price/Rent Ranges:** Represent 85% confidence intervals.

**Comparables:** Sorted by `correlation` in descending order (most similar first).

---

### Market Data Schema

**Endpoint:** `/v1/markets`

```json
{
  "id": "78244",
  "zipCode": "78244",

  // SALE DATA
  "saleData": {
    "lastUpdatedDate": "2024-11-15T00:00:00.000Z",

    // Overall Statistics
    "averagePrice": 425000,
    "medianPrice": 395000,
    "minPrice": 185000,
    "maxPrice": 1250000,
    "averagePricePerSquareFoot": 225,
    "medianPricePerSquareFoot": 215,
    "minPricePerSquareFoot": 125,
    "maxPricePerSquareFoot": 425,
    "averageSquareFootage": 1889,
    "medianSquareFootage": 1750,
    "minSquareFootage": 850,
    "maxSquareFootage": 4200,
    "averageDaysOnMarket": 45,
    "medianDaysOnMarket": 38,
    "minDaysOnMarket": 1,
    "maxDaysOnMarket": 180,
    "newListings": 23,
    "totalListings": 156,

    // By Property Type
    "dataByPropertyType": [
      {
        "propertyType": "Single Family",
        // Same statistics as above
        "averagePrice": 445000,
        "medianPrice": 410000,
        // ... all other fields
      },
      {
        "propertyType": "Condo",
        // ... statistics
      }
      // ... other property types
    ],

    // By Bedrooms
    "dataByBedrooms": [
      {
        "bedrooms": 0,  // Studio
        // Same statistics as above
        "averageRent": 1200,
        // ... all other fields
      },
      {
        "bedrooms": 3,
        // ... statistics
      }
      // ... 1-6+ bedrooms
    ],

    // Historical Data
    "history": {
      "2024-10": {
        "date": "2024-10-01T00:00:00.000Z",
        // Same structure: overall stats, by type, by bedrooms
        "averagePrice": 420000,
        "medianPrice": 390000,
        // ... all fields
        "dataByPropertyType": [ /* ... */ ],
        "dataByBedrooms": [ /* ... */ ]
      },
      "2024-09": { /* ... */ },
      "2024-08": { /* ... */ }
      // Back to January 2024
    }
  },

  // RENTAL DATA (same structure as saleData)
  "rentalData": {
    "lastUpdatedDate": "2024-11-15T00:00:00.000Z",

    // Overall Statistics
    "averageRent": 1850,
    "medianRent": 1750,
    "minRent": 950,
    "maxRent": 4500,
    "averageRentPerSquareFoot": 1.25,
    "medianRentPerSquareFoot": 1.15,
    "minRentPerSquareFoot": 0.75,
    "maxRentPerSquareFoot": 2.50,
    "averageSquareFootage": 1480,
    "medianSquareFootage": 1350,
    "minSquareFootage": 600,
    "maxSquareFootage": 3200,
    "averageDaysOnMarket": 28,
    "medianDaysOnMarket": 21,
    "minDaysOnMarket": 1,
    "maxDaysOnMarket": 120,
    "newListings": 45,
    "totalListings": 234,

    "dataByPropertyType": [ /* ... */ ],
    "dataByBedrooms": [ /* ... */ ],

    // Historical back to April 2020
    "history": {
      "2024-10": { /* ... */ },
      "2024-09": { /* ... */ }
      // ... back to 2020-04
    }
  }
}
```

---

## Best Practices for Minimizing API Calls

### 1. Use Address-Based Lookups Instead of Searches

**Instead of:**
```
GET /v1/properties?city=Austin&state=TX&address=123+Main+St
```

**Do:**
```
GET /v1/properties?address=123+Main+St,+Austin,+TX,78701
```

When you know the specific address, use ONLY the `address` parameter to get a single property result instead of a search result set.

### 2. Maximize Limit Parameter for Bulk Operations

Always use `limit=500` when retrieving multiple properties to minimize the number of paginated requests.

```
GET /v1/properties?city=Austin&state=TX&propertyType=Single+Family&limit=500
```

### 3. Use Property IDs for Repeated Lookups

When you need to access the same property multiple times:
1. Get the property once and save the `id` field
2. Use `/v1/properties/{id}` for subsequent lookups (potentially faster)

### 4. Leverage lookupSubjectAttributes for AVM Endpoints

When you DON'T have property attributes:
```
GET /v1/avm/value?address=123+Main+St,+Austin,+TX
```

This makes 1 API call and automatically looks up attributes.

When you ALREADY have property attributes (e.g., from previous property data call):
```
GET /v1/avm/value?address=123+Main+St,+Austin,+TX&propertyType=Single+Family&bedrooms=3&bathrooms=2&squareFootage=1800&lookupSubjectAttributes=false
```

Use `lookupSubjectAttributes=false` if you're providing all attributes yourself (may improve response time).

### 5. Don't Use includeTotalCount Unless Necessary

```
GET /v1/properties?city=Austin&state=TX&limit=500&includeTotalCount=true
```

The `includeTotalCount` parameter significantly slows responses. Only use when you need the exact total count for pagination planning.

### 6. Implement Request Mocking for Development

Set up API request mocking in your integration code to avoid making live API calls during development and testing. Use saved responses or the `/v1/properties/random` endpoint for test data.

### 7. Use Broader Filters First, Then Narrow

Instead of making multiple specific queries, start with broader filters and process results client-side:

**Less Efficient:**
```
GET /v1/properties?city=Austin&state=TX&bedrooms=3&bathrooms=2&squareFootage=1500:1800
GET /v1/properties?city=Austin&state=TX&bedrooms=3&bathrooms=2&squareFootage=1800:2100
GET /v1/properties?city=Austin&state=TX&bedrooms=3&bathrooms=2&squareFootage=2100:2400
```

**More Efficient:**
```
GET /v1/properties?city=Austin&state=TX&bedrooms=3&bathrooms=2&squareFootage=1500:2400&limit=500
```

Then filter the results client-side if needed.

### 8. Batch Property Lookups Using Geographic Search

If you need data for multiple properties in the same area, use geographic radius search to get them all at once:

```
GET /v1/properties?latitude=30.2672&longitude=-97.7431&radius=0.5&limit=500
```

### 9. Cache Market Data

Market data updates daily. Cache market statistics responses for 24 hours to avoid repeated calls for the same zip code.

### 10. Use Rate Limiting Strategically

Implement a request queue with 20 requests/second limit to maximize throughput while staying under rate limits:

```javascript
// Example: Queue that processes 20 requests per second
const rateLimiter = new RateLimiter(20, 'per second');
```

### 11. Separate API Keys for Different Applications

Create separate API keys for:
- Production application
- Development/staging
- Batch processing jobs
- Different services/microservices

This prevents one application from hitting rate limits that affect others.

### 12. Request Only What You Need

Use specific queries instead of broad searches. For example, if you only need properties sold in the last 30 days:

```
GET /v1/properties?city=Austin&state=TX&saleDateRange=30
```

Instead of getting all properties and filtering by sale date client-side.

### 13. Error Handling Strategy

Don't count errors against your mental quota - they're not billed:
- 404s from specific address lookups don't cost credits
- 400s from malformed requests don't cost credits
- 429s from rate limiting don't cost credits

Use this to validate addresses or test parameters without worrying about costs.

---

## Recommendations for Value + Rent Data

### Key Finding: NO Combined Endpoint

**Important:** RentCast does NOT offer a single endpoint that returns both value and rent estimates in one API call. You MUST make separate calls to:
- `/v1/avm/value` for property value estimate
- `/v1/avm/rent/long-term` for rent estimate

Each call counts as 1 API request.

### Optimal Workflow for Value + Rent Data

#### Option 1: When You DON'T Have Property Attributes

**Scenario:** You only have an address and need both value and rent.

**Calls Required:** 2 API calls

```bash
# Call 1: Get value estimate (includes property attributes in response)
GET /v1/avm/value?address=5500+Grand+Lake+Dr,+San+Antonio,+TX+78244

# Call 2: Get rent estimate (can reuse attributes from Call 1 if desired)
GET /v1/avm/rent/long-term?address=5500+Grand+Lake+Dr,+San+Antonio,+TX+78244
```

**Total Cost:** 2 API requests

**Benefits:**
- Automatic property attribute lookup for both
- Simplest implementation
- Both calls can run in parallel

---

#### Option 2: When You HAVE Property Attributes

**Scenario:** You previously fetched property data and have attributes cached.

**Calls Required:** 2 API calls (but potentially faster)

```bash
# Call 1: Get value estimate with explicit attributes
GET /v1/avm/value?address=5500+Grand+Lake+Dr,+San+Antonio,+TX+78244&propertyType=Single+Family&bedrooms=3&bathrooms=2&squareFootage=1878&lookupSubjectAttributes=false

# Call 2: Get rent estimate with same attributes
GET /v1/avm/rent/long-term?address=5500+Grand+Lake+Dr,+San+Antonio,+TX+78244&propertyType=Single+Family&bedrooms=3&bathrooms=2&squareFootage=1878&lookupSubjectAttributes=false
```

**Total Cost:** 2 API requests

**Benefits:**
- May be faster (no attribute lookup needed)
- More control over attribute values
- Can update attributes from previous data

---

#### Option 3: Most Efficient - Get Property Data First

**Scenario:** You need property records AND valuations for new properties.

**Calls Required:** 3 API calls

```bash
# Call 1: Get complete property record
GET /v1/properties?address=5500+Grand+Lake+Dr,+San+Antonio,+TX+78244

# Extract attributes from response, then:

# Call 2: Get value estimate with attributes
GET /v1/avm/value?address=5500+Grand+Lake+Dr,+San+Antonio,+TX+78244&propertyType=Single+Family&bedrooms=3&bathrooms=2&squareFootage=1878&lookupSubjectAttributes=false

# Call 3: Get rent estimate with same attributes
GET /v1/avm/rent/long-term?address=5500+Grand+Lake+Dr,+San+Antonio,+TX+78244&propertyType=Single+Family&bedrooms=3&bathrooms=2&squareFootage=1878&lookupSubjectAttributes=false
```

**Total Cost:** 3 API requests

**Benefits:**
- Get complete property data (owner, tax, sale history, features)
- Potentially more accurate valuations with confirmed attributes
- Cache property data for future use

**When to Use:**
- You need owner information, tax data, or sale history
- You're analyzing properties and need full details
- You want to cache comprehensive property data

---

#### Option 4: Bulk Processing Multiple Properties

**Scenario:** You need value + rent for many properties in an area.

**Optimized Workflow:**

```bash
# Step 1: Get all properties in area (1 API call per 500 properties)
GET /v1/properties?city=Austin&state=TX&propertyType=Single+Family&bedrooms=3:4&limit=500

# Step 2: For each property, make parallel requests:
# - 1 call to /v1/avm/value
# - 1 call to /v1/avm/rent/long-term
# Use attributes from Step 1 with lookupSubjectAttributes=false
```

**Example: 100 properties**
- 1 call for property data (gets 100 properties)
- 100 calls for value estimates (parallel)
- 100 calls for rent estimates (parallel)
- **Total: 201 API calls for 100 complete property analyses**

**Optimization Tips:**
- Process in batches respecting 20 req/sec rate limit
- Run value + rent calls in parallel for each property
- Cache property attributes to avoid repeated lookups
- Use request queuing to maximize throughput

---

### Cost Comparison Table

| Scenario | Property Data | Value Estimate | Rent Estimate | Total Calls |
|----------|--------------|----------------|---------------|-------------|
| Single property (address only) | - | 1 | 1 | 2 |
| Single property (with attributes) | 1 | 1 | 1 | 3 |
| Single property (full analysis) | 1 | 1 | 1 | 3 |
| 10 properties (bulk) | 1 | 10 | 10 | 21 |
| 100 properties (bulk) | 1 | 100 | 100 | 201 |
| 500 properties (bulk) | 1 | 500 | 500 | 1,001 |

---

### Parallel Request Strategy

Since value and rent estimates are independent, ALWAYS run them in parallel:

**Sequential (SLOW):**
```javascript
const value = await getValueEstimate(address);  // Wait for response
const rent = await getRentEstimate(address);    // Then wait again
// Total time: ~2-4 seconds
```

**Parallel (FAST):**
```javascript
const [value, rent] = await Promise.all([
  getValueEstimate(address),
  getRentEstimate(address)
]);
// Total time: ~1-2 seconds
```

---

### Property Type Considerations

**Multi-Family Properties (2-4 units):**
- Value estimate = entire building value
- Rent estimate = single unit rent
- **Use case:** Calculate value, then multiply rent by unit count for total income

**Apartment Buildings (5+ units):**
- Value estimate = entire building value
- Rent estimate = single unit rent
- **Use case:** Same as multi-family

---

### When to Skip Rent Estimates

Skip rent estimate calls when:
- Property is vacant land (no rentable structure)
- Owner-occupied with no rental intent
- Commercial property (office, retail, industrial)
- You only need sale value for analysis

This saves 1 API call per property.

---

### Caching Strategy

Implement caching to minimize repeat API calls:

**Property Records:** Cache for 7 days (weekly updates)
```javascript
if (cachedProperty && cachedProperty.age < 7 * 24 * 60 * 60 * 1000) {
  return cachedProperty;
}
```

**Value/Rent Estimates:** Cache for 30 days or based on market volatility
```javascript
if (cachedEstimate && cachedEstimate.age < 30 * 24 * 60 * 60 * 1000) {
  return cachedEstimate;
}
```

**Market Data:** Cache for 24 hours (daily updates)
```javascript
if (cachedMarketData && cachedMarketData.age < 24 * 60 * 60 * 1000) {
  return cachedMarketData;
}
```

---

### Recommended Implementation Pattern

```javascript
async function getCompletePropertyAnalysis(address) {
  // Step 1: Check cache
  const cached = await getFromCache(address);
  if (cached && !isStale(cached)) {
    return cached;
  }

  // Step 2: Get property data (if needed)
  const property = await fetch(`/v1/properties?address=${address}`);

  // Step 3: Parallel valuation requests
  const [value, rent] = await Promise.all([
    fetch(`/v1/avm/value?address=${address}&propertyType=${property.propertyType}&bedrooms=${property.bedrooms}&bathrooms=${property.bathrooms}&squareFootage=${property.squareFootage}&lookupSubjectAttributes=false`),
    fetch(`/v1/avm/rent/long-term?address=${address}&propertyType=${property.propertyType}&bedrooms=${property.bedrooms}&bathrooms=${property.bathrooms}&squareFootage=${property.squareFootage}&lookupSubjectAttributes=false`)
  ]);

  // Step 4: Combine results
  const analysis = {
    property,
    value,
    rent,
    timestamp: Date.now()
  };

  // Step 5: Cache for future use
  await saveToCache(address, analysis);

  return analysis;
}
```

**API Calls:** 3 per property
**Response Time:** ~1-2 seconds (parallel requests)
**Cache Hit Rate:** High for repeat queries

---

## Summary of Key Insights

### What's Available

1. **140+ million property records** with owner info, tax data, sale history
2. **Separate value and rent AVM endpoints** - NO combined endpoint
3. **Active listings** for sale and rental properties
4. **Market statistics** by zip code with historical data
5. **Comparable properties** included with valuations

### What's NOT Available

1. **No combined value+rent endpoint** - must make 2 calls
2. **No bulk valuation endpoint** - must call per property
3. **No batch request endpoint** - must make individual calls
4. **Exact pricing not in docs** - must contact RentCast
5. **No office/retail/industrial properties** - residential only

### Cost Optimization Keys

1. **All endpoints cost the same** - 1 request = 1 credit
2. **Errors don't count** - failed requests not billed
3. **Data volume doesn't matter** - 1 property or 500, same cost per request
4. **Attribute lookup is "free"** - included in valuation calls
5. **Parallel requests recommended** - faster without extra cost

### Best Value for Money

**For comprehensive property analysis:**
- 3 API calls gets you: property record + value + rent
- Add property attributes to AVM calls for better accuracy
- Run value + rent in parallel to save time
- Cache results to avoid repeat calls

**For bulk processing:**
- 1 call for property search (up to 500 results)
- 2N calls for valuations (N properties × 2 estimates)
- Total: 1 + (2 × N) calls for N complete property analyses

---

## Response Codes Reference

| Code | Meaning | Action Required |
|------|---------|-----------------|
| 200 | Success | Process response data |
| 400 | Bad Request | Fix malformed parameters |
| 401 | Unauthorized | Check API key, subscription, billing |
| 404 | Not Found | No data matches query - adjust filters |
| 405 | Method Not Allowed | Use GET only |
| 429 | Rate Limit | Implement throttling, use separate keys |
| 500 | Server Error | Retry request or contact support |
| 504 | Timeout | Try different parameters or contact support |

**Error Response Format:**
```json
{
  "status": 400,
  "error": "resource/bad-request",
  "message": "Specific error explanation"
}
```

---

## Property Type Reference

| Type | Definition | Units |
|------|------------|-------|
| Single Family | Detached single-family property | 1 |
| Condo | Unit in condominium with HOA | 1 |
| Townhouse | Single-family with shared walls | 1 |
| Manufactured | Pre-fabricated/mobile home | 1 |
| Multi-Family | Residential building | 2-4 |
| Apartment | Commercial multi-family | 5+ |
| Land | Vacant undeveloped parcel | 0 |

**Studio Units:** Bedrooms = 0

---

## Additional Resources

- **API Documentation:** https://developers.rentcast.io/reference/introduction
- **API Dashboard:** https://app.rentcast.io/app/api
- **Postman Collection:** https://www.postman.com/rentcast/rentcast-api
- **Zapier Integration:** Connect to 6,000+ apps
- **Support:** Live chat available 7 days/week

---

## Integration Examples

### Zapier
- 10+ custom actions
- Connect to Excel, Google Sheets, Salesforce, HubSpot
- No-code automation

### Make.com / n8n
- HTTP app integration
- 2,500+ service connections
- Workflow automation

### CRM
- HighLevel (via Zapier or webhooks)
- Follow Up Boss (via Zapier)

### Application Builders
- Bubble (API connectors)
- Replit (Python/JavaScript)
- Lovable (AI-powered)
- Airtable (JavaScript scripting)

### Developer Tools
- Postman workspace
- OpenAPI specification
- Model Context Protocol (MCP) for AI code editors
- Swagger/Stoplight support

---

## Changelog & Updates

RentCast maintains release notes at: https://developers.rentcast.io/changelog

**Notable Recent Updates:**
- Property listings endpoints (2023-03)
- Query parameter improvements (2023-01)
- Weekly property record updates
- Daily listing updates

---

## Contact & Support

- **Website:** https://www.rentcast.io
- **API Portal:** https://app.rentcast.io/app/api
- **Documentation:** https://developers.rentcast.io
- **Support:** Live chat (7 days/week)
- **Enterprise Sales:** Contact via website for high-volume plans

---

*This catalog was compiled through comprehensive exploration of RentCast API documentation on November 15, 2025. For the most current information, always refer to the official documentation at developers.rentcast.io.*
