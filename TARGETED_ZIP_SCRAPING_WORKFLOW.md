# Targeted Zip Code Scraping Workflow

## Overview
This document explains how to add new target cities for property scraping with full owner finance and cash deal detection that automatically flows into the agent outreach system.

## 🎯 Complete Workflow: New Cities → Properties → Filters → Agent Outreach → Website

### Step 1: Select Target Cities (60+ Markets Nationwide)
All cities are pre-configured in `/src/app/api/add-zip-codes/route.ts` across 6 tiers:

#### **🏆 TIER 1: TOP CASH FLOW MARKETS (9%+ rental yields)**
**Midwest Powerhouses:**
- `cleveland`, `toledo`, `indianapolis`, `kansas-city`, `milwaukee`, `cincinnati`, `columbus`, `detroit`

**Southern High-Yield:**  
- `memphis` (11% rent-to-price), `birmingham`, `little-rock`, `jackson`, `shreveport`

#### **🎯 TIER 2: BALANCED GROWTH + CASH FLOW**
**Tennessee (No State Income Tax):**
- `nashville`, `knoxville`, `chattanooga`

**Kentucky & North Carolina:**
- `louisville`, `lexington`, `charlotte`, `greensboro`, `winston-salem`

#### **📈 TIER 3: EMERGING MARKETS**  
**Florida Growth:**
- `tampa`, `orlando`, `jacksonville`

**Georgia Business Hub:**
- `atlanta`, `augusta`, `savannah`, `athens`

**Texas Powerhouses:**
- `dallas`, `houston`, `austin`, `san-antonio`, `fort-worth`

#### **🔧 TIER 4: RUST BELT REVIVAL**
**Ohio Valley:**
- `pittsburgh`, `youngstown`, `akron`, `dayton`

**Great Lakes:**
- `buffalo`, `milwaukee`, `grand-rapids`, `rockford`

#### **🌵 TIER 5: SOUTHWEST/MOUNTAIN WEST**
- `phoenix`, `tucson`, `albuquerque`, `fayetteville`, `colorado-springs`

#### **🌾 TIER 6: PLAINS STATES**
- `des-moines`, `omaha`, `oklahoma-city`, `tulsa`

**All 60+ cities are ready to use - just specify the city name in your API calls.**

### Step 2: Run Targeted Zip Code Scraping

#### Option A: Quick Add (Recommended for New Cities)
```bash
curl -X POST "http://localhost:3000/api/add-zip-codes" \
  -H "Content-Type: application/json" \
  -d '{
    "zipCodes": ["75201", "75202", "75203", "75204", "75205"],
    "city": "dallas",
    "includeAgentOutreach": true
  }'
```

#### Option B: Full Details Scraping (Recommended for Complete Data)
```bash
curl -X POST "http://localhost:3000/api/rescrape-with-details" \
  -H "Content-Type: application/json" \
  -d '{
    "testMode": false,
    "customUrls": [
      "https://www.zillow.com/dallas-tx-75201/...",
      "https://www.zillow.com/dallas-tx-75202/..."
    ]
  }'
```

### Step 3: Automatic Processing Pipeline

Once scraped, properties automatically flow through:

#### 1. **Unified Filter Processing** (`/src/lib/scraper-v2/unified-filter.ts`)
- **Owner Finance Detection**: Strict keyword matching (`runUnifiedFilter()`)
  - Patterns: "owner financing", "seller financing", "owner carry", "rent to own", etc.
  - **Zero false positives** - only explicit mentions qualify
- **Cash Deal Detection**: Price < 80% of Zestimate
  - Excludes land properties (unreliable Zestimates)
  - Flags suspicious discounts (< 50% of Zestimate)

#### 2. **Data Classification**
Each property gets:
```typescript
{
  isOwnerfinance: boolean,     // Has explicit owner finance keywords
  isCashDeal: boolean,         // Price < 80% Zestimate  
  dealTypes: ['owner_finance', 'cash_deal'], // Array supporting both
  isActive: true,              // Visible on website
  addedToAgentOutreach: false  // Ready for outreach queue
}
```

#### 3. **Storage in Main Collection**
Properties are saved to `properties` collection with:
- Full property descriptions for keyword detection
- Agent contact information for outreach
- All necessary fields for website display
- Unified filter results for classification

### Step 4: Agent Outreach Integration

#### Automatic Queue Processing
Properties with agent contact info automatically flow to:
1. **Agent Outreach Queue** (`agent_outreach_queue` collection)
2. **GoHighLevel Webhook** (for qualified deals)
3. **SMS Alerts** (for regional cash deals)

#### Manual Queue Addition
For properties without agent info:
```bash
curl -X POST "http://localhost:3000/api/queue-properties-for-outreach"
```

### Step 5: Website Display

Properties automatically appear on:
- **Buyer Dashboard** (`/dashboard`) - Owner finance and cash deals
- **Property Search** - Filtered by user preferences  
- **Deal Badges** - Color-coded by deal type:
  - 🟢 **Owner Finance**: Green "💰 Owner Finance" badge
  - 🟡 **Cash Deal Only**: Yellow "💵 Cash Deal" badge

## 🔧 Configuration Files

### Primary Endpoints
- `/src/app/api/add-zip-codes/route.ts` - Quick zip code scraping
- `/src/app/api/rescrape-with-details/route.ts` - Full detail scraping  
- `/src/app/api/process-migrated-properties/route.ts` - Process existing data

### Filter Configuration
- `/src/lib/scraper-v2/unified-filter.ts` - Main filtering logic
- `/src/lib/owner-financing-filter-strict.ts` - Owner finance keywords
- `/src/lib/negative-keywords.ts` - Exclusion patterns

### Agent Outreach
- `/src/lib/agent-outreach/queue-to-property.ts` - Queue processing
- `/src/lib/scraper-v2/ghl-webhook.ts` - GoHighLevel integration

## 📊 Expected Results by City Type

### High-Volume Markets (Dallas, Houston, Atlanta)
- **Total Properties**: 2,000-5,000 per city
- **Owner Finance**: 10-30 properties (0.5-1.5%)
- **Cash Deals**: 50-200 properties (2-5%)
- **Agent Contact Info**: 80-90% of properties

### Mid-Tier Markets (Memphis, Columbus, Birmingham)  
- **Total Properties**: 500-2,000 per city
- **Owner Finance**: 5-15 properties (1-2%)
- **Cash Deals**: 20-100 properties (3-8%)
- **Agent Contact Info**: 70-80% of properties

### Smaller Markets (Huntsville, Little Rock)
- **Total Properties**: 200-800 per city
- **Owner Finance**: 2-8 properties (1-3%)  
- **Cash Deals**: 10-50 properties (5-12%)
- **Agent Contact Info**: 60-70% of properties

## 🚀 Quick Start Examples

### Adding Cleveland Market (Top Cash Flow)
```bash
curl -X POST "http://localhost:3000/api/add-zip-codes" \
  -H "Content-Type: application/json" \
  -d '{
    "zipCodes": ["44101", "44102", "44103", "44104", "44105", "44106"],
    "city": "cleveland"
  }'
```

### Adding Memphis Market (11% Rent-to-Price)
```bash
curl -X POST "http://localhost:3000/api/add-zip-codes" \
  -H "Content-Type: application/json" \
  -d '{
    "zipCodes": ["38101", "38103", "38104", "38105", "38106", "38107"],
    "city": "memphis"
  }'
```

### Adding Indianapolis Market (Balanced Growth)
```bash
curl -X POST "http://localhost:3000/api/add-zip-codes" \
  -H "Content-Type: application/json" \
  -d '{
    "zipCodes": ["46201", "46202", "46203", "46204", "46205"],
    "city": "indianapolis"
  }'
```

### Adding Phoenix Market (Southwest Growth)
```bash
curl -X POST "http://localhost:3000/api/add-zip-codes" \
  -H "Content-Type: application/json" \
  -d '{
    "zipCodes": ["85001", "85002", "85003", "85004", "85006"],
    "city": "phoenix"
  }'
```

**Verification Steps:**
1. Check main `properties` collection in Firestore
2. Verify properties appear on website dashboard  
3. Confirm agent outreach queue has new entries

## 🔍 Troubleshooting

### No Properties Qualified
- **Normal for some zip codes** - not all areas have deals
- Check if descriptions are populated (use all-in-one scraper)
- Verify Zestimate data is available for cash deal detection

### Missing Agent Contact Info
- Use detail scraper: `/api/rescrape-with-details`
- Some properties may not have agent listings
- Focus on newer listings (higher agent info rate)

### Properties Not Showing on Website
- Verify `isActive: true` and `processedThroughUnifiedFilter: true`
- Check Typesense sync status
- Run manual filter processing if needed

## 📝 Collection Structure

### Main Properties Collection (`properties`)
```typescript
{
  zpid: "101234567",
  address: "123 Main St, Dallas, TX 75201",
  price: 250000,
  zestimate: 320000,
  description: "Beautiful home with owner financing available...",
  
  // Filter Results
  isOwnerfinance: true,
  isCashDeal: false,
  dealTypes: ["owner_finance"],
  ownerFinanceKeywords: ["owner financing", "seller carry"],
  
  // Agent Info  
  agentName: "John Smith",
  agentPhone: "+12145551234",
  agentEmail: "john@realty.com",
  
  // Status
  isActive: true,
  addedToAgentOutreach: false,
  processedThroughUnifiedFilter: true,
  rescrapedWithFullDetails: true
}
```

This workflow ensures every property goes through the complete pipeline: scraping → filtering → classification → agent outreach → website display.