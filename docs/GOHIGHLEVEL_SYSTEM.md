# GoHighLevel (GHL) Integration System

> Complete documentation for CRM integration, notifications, and agent outreach
> **For: New Employee Onboarding**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Webhook Endpoints (Incoming)](#webhook-endpoints-incoming)
4. [Outgoing API Calls](#outgoing-api-calls)
5. [Agent Outreach System](#agent-outreach-system)
6. [Buyer Notification System](#buyer-notification-system)
7. [Database Collections](#database-collections)
8. [Cron Jobs](#cron-jobs)
9. [Admin Endpoints](#admin-endpoints)
10. [Environment Variables](#environment-variables)
11. [Security](#security)
12. [Troubleshooting](#troubleshooting)

---

## System Overview

GoHighLevel (GHL) is our CRM platform that handles:

1. **Agent Outreach** - Contacting listing agents about owner financing
2. **Buyer Notifications** - SMS alerts when properties match buyer criteria
3. **Lead Management** - Tracking contacts and opportunities
4. **Workflow Automation** - Triggering SMS/email sequences

### How It Connects

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GHL INTEGRATION OVERVIEW                         │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │   GoHighLevel    │
                    │      (CRM)       │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │   Webhooks   │ │   Webhooks   │ │  SMS/Email   │
    │  (Incoming)  │ │  (Outgoing)  │ │  Workflows   │
    └──────────────┘ └──────────────┘ └──────────────┘
            │                │                │
            ▼                ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │   Property   │ │    Agent     │ │    Buyer     │
    │   Updates    │ │   Outreach   │ │    Alerts    │
    └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Architecture Diagram

### Data Flow: Agent Outreach

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      AGENT OUTREACH FLOW                                 │
└─────────────────────────────────────────────────────────────────────────┘

  STEP 1: Scrape Properties (Daily 9 PM)
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  Cron: run-agent-outreach-scraper                                   │
  │  ├── Scrapes Zillow for Memphis/TN properties                       │
  │  ├── Filters: $50k-$500k, no owner financing keywords               │
  │  ├── Extracts agent contact info                                    │
  │  └── Adds to agent_outreach_queue (status: pending)                 │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  STEP 2: Send to GHL (Every 4 hours)
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  Cron: process-agent-outreach-queue                                 │
  │  ├── Fetches pending items (batch of 50)                            │
  │  ├── Sends each to GHL webhook                                      │
  │  ├── Updates status to sent_to_ghl                                  │
  │  └── Tracks in contacted_agents collection                          │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  STEP 3: GHL Sends SMS/Email
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  GHL Workflow                                                        │
  │  ├── Creates contact from webhook data                              │
  │  ├── Sends SMS: "Do you offer owner financing on [address]?"        │
  │  └── Waits for agent reply                                          │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  STEP 4: Agent Responds
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  Webhook: /api/webhooks/gohighlevel/agent-response                  │
  │  ├── Agent YES → Add property to 'properties' collection            │
  │  │              → Mark ownerFinanceVerified: true                   │
  │  │              → Index to Typesense for search                     │
  │  └── Agent NO  → Update status to agent_no                          │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Buyer Notifications

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     BUYER NOTIFICATION FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

  STEP 1: New Property Added
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  Webhook: /api/webhooks/gohighlevel/property                        │
  │  ├── Receives property data from GHL                                │
  │  ├── Saves to 'properties' collection                               │
  │  └── Triggers buyer matching                                        │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  STEP 2: Match Buyers
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  Buyer Matching Logic                                                │
  │  ├── Query buyerProfiles where state matches                        │
  │  ├── Check: city in buyer's preferred cities                        │
  │  ├── Check: monthlyPayment <= maxMonthlyPayment                     │
  │  ├── Check: downPayment <= maxDownPayment                           │
  │  ├── Check: beds >= minBedrooms, baths >= minBathrooms              │
  │  └── Filter: not already notified about this property               │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  STEP 3: Send SMS via GHL
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  For each matched buyer:                                             │
  │  ├── POST to /api/webhooks/gohighlevel/property-match               │
  │  ├── Forwards to GOHIGHLEVEL_WEBHOOK_URL                            │
  │  ├── GHL workflow sends SMS                                         │
  │  └── Track in buyerProfiles.notifiedPropertyIds                     │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
  STEP 4: Buyer Receives SMS
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  SMS Message:                                                        │
  │  "🏠 New Property Match!                                             │
  │   Hi John! We found a home for you in Memphis, TN:                  │
  │   📍 123 Main St                                                     │
  │   🛏️ 3 bed, 2 bath                                                   │
  │   💰 $150,000 list price                                             │
  │   💵 $1,200/mo, $15,000 down                                         │
  │   View it now: https://ownerfi.ai/dashboard                         │
  │   Reply STOP to unsubscribe"                                        │
  │                                                                      │
  └─────────────────────────────────────────────────────────────────────┘
```

---

## Webhook Endpoints (Incoming)

These endpoints receive data FROM GoHighLevel.

### 1. Property Webhook

**Endpoint:** `POST /api/webhooks/gohighlevel/property`

**Purpose:** Receives property data from GHL and saves to Firestore

**File:** `/src/app/api/webhooks/gohighlevel/property/route.ts`

**Payload:**
```json
{
  "firebase_id": "prop_123",
  "opportunityId": "ghl_opp_456",
  "address": "123 Main St",
  "city": "Memphis",
  "state": "TN",
  "zipcode": "38103",
  "price": 150000,
  "beds": 3,
  "baths": 2,
  "squareFeet": 1500,
  "downPaymentAmount": 15000,
  "monthlyPayment": 1200,
  "interestRate": 8.5,
  "termYears": 30
}
```

**What It Does:**
1. Validates webhook signature (HMAC-SHA256)
2. Extracts and normalizes property data
3. Calculates monthly payment if not provided
4. Saves to `properties` collection
5. **Triggers buyer matching** - finds buyers whose criteria match
6. Sends SMS notifications to matched buyers
7. Indexes property to Typesense for search

**Response:**
```json
{
  "success": true,
  "data": {
    "propertyId": "prop_123",
    "address": "123 Main St",
    "city": "Memphis",
    "state": "TN",
    "price": 150000
  }
}
```

---

### 2. Agent Response Webhook

**Endpoint:** `POST /api/webhooks/gohighlevel/agent-response`

**Purpose:** Receives agent YES/NO decisions on owner financing

**File:** `/src/app/api/webhooks/gohighlevel/agent-response/route.ts`

**Payload:**
```json
{
  "firebaseId": "queue_item_123",
  "response": "yes",
  "agentNote": "Yes, we offer owner financing on this property",
  "opportunityId": "ghl_opp_456"
}
```

**What It Does:**

**If Agent Says YES:**
1. Fetches property from `agent_outreach_queue`
2. Adds to `properties` collection with:
   - `ownerFinanceVerified: true`
   - `isOwnerFinance: true`
   - `dealTypes: ['owner_finance']`
3. Indexes to Typesense
4. Updates queue status to `agent_yes`

**If Agent Says NO:**
1. Updates queue status to `agent_no`
2. Stores agent note if provided

---

### 3. Property Match Notification Webhook

**Endpoint:** `POST /api/webhooks/gohighlevel/property-match`

**Purpose:** Forwards property match notifications to GHL for SMS delivery

**File:** `/src/app/api/webhooks/gohighlevel/property-match/route.ts`

**Payload:**
```json
{
  "buyerId": "buyer_123",
  "propertyId": "prop_456",
  "buyerName": "John Smith",
  "buyerFirstName": "John",
  "buyerLastName": "Smith",
  "buyerPhone": "+19015551234",
  "buyerEmail": "john@example.com",
  "buyerCity": "Memphis",
  "buyerState": "TN",
  "propertyAddress": "123 Main St",
  "propertyCity": "Memphis",
  "propertyState": "TN",
  "monthlyPayment": 1200,
  "downPaymentAmount": 15000,
  "listPrice": 150000,
  "bedrooms": 3,
  "bathrooms": 2,
  "dashboardUrl": "https://ownerfi.ai/dashboard",
  "trigger": "new_property_added"
}
```

**What It Does:**
1. Logs webhook to `webhookLogs` collection
2. Formats SMS message using template
3. Forwards to `GOHIGHLEVEL_WEBHOOK_URL`
4. Updates log with GHL response
5. Tracks processing time

---

### 4. Agent Not Interested Webhook

**Endpoint:** `POST /api/webhooks/gohighlevel/agent-not-interested`

**Purpose:** Simple endpoint to mark properties as agent declined

**File:** `/src/app/api/webhooks/gohighlevel/agent-not-interested/route.ts`

**Payload:**
```json
{
  "firebaseId": "queue_item_123",
  "note": "Agent declined - not offering owner financing"
}
```

**What It Does:**
1. Updates `agent_outreach_queue` status to `agent_no`
2. Stores optional note

---

## Outgoing API Calls

These are calls we make TO GoHighLevel.

### 1. Send Property to GHL

**Function:** `syncPropertyToGHL()`

**File:** `/src/lib/gohighlevel-api.ts`

**Purpose:** Creates/updates opportunities in GHL pipeline

**API Call:**
```typescript
POST https://services.leadconnectorhq.com/opportunities
Headers:
  Authorization: Bearer {GHL_API_KEY}
  Content-Type: application/json

Body:
{
  "locationId": "{GHL_LOCATION_ID}",
  "name": "123 Main St, Memphis, TN",
  "pipelineId": "...",
  "stageId": "...",
  "customFields": {
    "property_address": "123 Main St",
    "property_city": "Memphis",
    "property_state": "TN",
    "property_zip": "38103",
    "property_price": 150000,
    "bedrooms": 3,
    "bathrooms": 2,
    "monthly_payment": 1200,
    "down_payment": 15000
  }
}
```

---

### 2. Send Buyer to GHL

**Function:** `syncBuyerToGHL()`

**File:** `/src/lib/gohighlevel-api.ts`

**Purpose:** Creates buyer contacts in GHL

**Webhook Payload:**
```json
{
  "buyer_id": "buyer_123",
  "first_name": "John",
  "last_name": "Smith",
  "email": "john@example.com",
  "phone": "+19015551234",
  "city": "Memphis",
  "state": "TN",
  "search_radius": 25,
  "languages": ["English"],
  "source": "website_registration",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### 3. Agent Outreach Webhook

**Cron:** `process-agent-outreach-queue`

**File:** `/src/app/api/cron/process-agent-outreach-queue/route.ts`

**Purpose:** Sends properties to GHL for agent SMS outreach

**Webhook Payload:**
```json
{
  "contactName": "Agent Jane Doe",
  "contactPhone": "+19015559999",
  "contactEmail": "jane@realty.com",
  "propertyAddress": "456 Oak Ave",
  "propertyCity": "Memphis",
  "propertyState": "TN",
  "propertyZip": "38104",
  "propertyPrice": 175000,
  "propertyBeds": 4,
  "propertyBaths": 2,
  "propertySquareFeet": 1800,
  "dealType": "potential_owner_finance",
  "firebaseId": "queue_item_789",
  "zpid": 12345678,
  "zillowUrl": "https://zillow.com/...",
  "source": "agent_outreach_system",
  "addedAt": "2024-01-15T21:00:00Z"
}
```

---

## Agent Outreach System

The agent outreach system finds properties and contacts listing agents to ask about owner financing.

### How It Works

#### Step 1: Scrape Properties

**Cron:** `/api/cron/run-agent-outreach-scraper`

**Schedule:** Daily at 9 PM UTC

**What It Does:**
1. Uses Apify Zillow scraper
2. Searches Memphis/TN area
3. Filters: $50k-$500k price range
4. Excludes: Properties that already mention owner financing
5. Excludes: Multi-family, land, foreclosures, auctions
6. Extracts agent/broker contact info
7. Adds to `agent_outreach_queue` with `status: pending`

---

#### Step 2: Process Queue

**Cron:** `/api/cron/process-agent-outreach-queue`

**Schedule:** Every 4 hours (6 times daily)

**What It Does:**
1. Fetches pending items (batch of 50)
2. Resets stuck items (>30 min in processing)
3. For each property:
   - Sends to GHL webhook
   - Updates status to `sent_to_ghl`
   - Tracks in `contacted_agents` collection
4. Handles retries (max 3 per property)
5. Logs results to `cron_logs`

---

#### Step 3: GHL Workflow

GHL receives the webhook and:
1. Creates a contact for the agent
2. Sends SMS: "Hi [Agent], do you offer owner financing on [Address]?"
3. Waits for agent reply
4. On reply, triggers response webhook back to us

---

#### Step 4: Handle Response

**Webhook:** `/api/webhooks/gohighlevel/agent-response`

- **Agent YES:** Property added to live listings
- **Agent NO:** Marked as declined

---

### Queue Status Flow

```
pending
    │
    │ (picked up by cron)
    ▼
processing
    │
    │ (sent to GHL)
    ▼
sent_to_ghl
    │
    ├──────────────────┐
    │                  │
    ▼                  ▼
agent_yes          agent_no
    │
    ▼
Added to 'properties'
collection
```

---

## Buyer Notification System

Sends SMS alerts to buyers when properties match their criteria.

### Matching Logic

A buyer matches a property when:

```typescript
// Location match
property.state === buyer.preferredState
AND property.city IN buyer.preferredCities

// Budget match (either condition)
property.monthlyPayment <= buyer.maxMonthlyPayment
OR property.downPaymentAmount <= buyer.maxDownPayment

// Size match
property.bedrooms >= buyer.minBedrooms
property.bathrooms >= buyer.minBathrooms

// Not already notified
property.id NOT IN buyer.notifiedPropertyIds

// SMS enabled
buyer.smsNotifications !== false
```

### SMS Template

```
🏠 New Property Match!

Hi {firstName}! We found a home for you in {city}, {state}:

📍 {address}
🛏️ {beds} bed, {baths} bath
💰 ${price} list price
💵 ${monthlyPayment}/mo, ${downPayment} down

View it now: {dashboardUrl}

Reply STOP to unsubscribe
```

### Notification Library

**File:** `/src/lib/gohighlevel-notifications.ts`

**Functions:**

```typescript
// Send notification for single buyer-property match
sendPropertyMatchNotification({
  buyer: BuyerProfile,
  property: PropertyListing,
  trigger: 'new_property_added' | 'buyer_criteria_changed' | 'manual_trigger'
})

// Send notifications to multiple buyers for one property
sendBatchPropertyMatchNotifications({
  property: PropertyListing,
  buyers: BuyerProfile[],
  trigger: string
})

// Check if buyer should receive notification
shouldNotifyBuyer(buyer, property): {
  shouldNotify: boolean,
  reason?: string
}
```

---

## Database Collections

### 1. agent_outreach_queue

**Purpose:** Tracks properties waiting for agent outreach

```javascript
{
  // Identity
  id: "queue_item_123",
  zpid: 12345678,
  url: "https://zillow.com/...",

  // Property details
  address: "456 Oak Ave",
  city: "Memphis",
  state: "TN",
  zipCode: "38104",
  price: 175000,
  beds: 4,
  baths: 2,
  squareFeet: 1800,

  // Agent contact
  agentName: "Jane Doe",
  agentPhone: "+19015559999",
  agentEmail: "jane@realty.com",

  // Status tracking
  status: "pending",  // pending | processing | sent_to_ghl | agent_yes | agent_no | failed
  dealType: "potential_owner_finance",

  // Processing metadata
  processingStartedAt: null,
  sentToGHLAt: null,
  agentResponse: null,  // "yes" | "no"
  agentResponseAt: null,
  agentNote: null,

  // Retry tracking
  retryCount: 0,
  errorMessage: null,

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### 2. contacted_agents

**Purpose:** Deduplication - tracks which agents we've already contacted

```javascript
{
  id: "contact_456",

  // Property info
  propertyAddress: "456 Oak Ave",
  firebase_id: "queue_item_123",

  // Agent info
  contactName: "Jane Doe",
  contactPhone: "+19015559999",
  contactEmail: "jane@realty.com",

  // Normalized for dedup
  addressNormalized: "456 oak ave memphis tn",
  phoneNormalized: "9015559999",

  // Status
  stage: "sent",
  status: "awaiting_response",
  dealType: "potential_owner_finance",

  // GHL reference
  opportunityId: "ghl_opp_789",

  // Timestamps
  createdAt: Timestamp
}
```

---

### 3. buyerProfiles

**Purpose:** Stores buyer preferences and notification tracking

```javascript
{
  id: "buyer_123",

  // Contact info
  firstName: "John",
  lastName: "Smith",
  email: "john@example.com",
  phone: "+19015551234",

  // Preferences
  preferredState: "TN",
  preferredCities: ["Memphis", "Germantown", "Collierville"],
  maxMonthlyPayment: 1500,
  maxDownPayment: 20000,
  minBedrooms: 3,
  minBathrooms: 2,

  // Notification settings
  smsNotifications: true,
  emailNotifications: true,

  // Tracking
  notifiedPropertyIds: ["prop_1", "prop_2"],
  matchedPropertyIds: ["prop_1", "prop_2", "prop_3"],
  likedPropertyIds: ["prop_1"],
  passedPropertyIds: ["prop_3"],

  // Metadata
  lastNotifiedAt: Timestamp,
  notificationCount: 5,
  isActive: true,

  // Timestamps
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### 4. webhookLogs

**Purpose:** Audit trail for all GHL webhook activity

```javascript
{
  id: "log_789",

  // Webhook info
  type: "property_match_notification",
  status: "sent",  // pending | sent | failed

  // References
  buyerId: "buyer_123",
  propertyId: "prop_456",
  buyerPhone: "+19015551234",

  // Full payload
  payload: {
    buyerName: "John Smith",
    propertyAddress: "123 Main St",
    // ... full webhook data
  },

  // Response
  goHighLevelResponse: {
    status: 200,
    body: { success: true }
  },

  // Error tracking
  errorMessage: null,

  // Performance
  processingTimeMs: 245,

  // Timestamps
  createdAt: Timestamp
}
```

---

### 5. cron_logs

**Purpose:** Audit trail for cron job executions

```javascript
{
  id: "cron_log_123",

  // Job info
  cronName: "process-agent-outreach-queue",
  status: "success",  // success | failed | partial

  // Results
  duration: 45000,  // ms
  counts: {
    processed: 50,
    sent: 48,
    failed: 2,
    retried: 3
  },

  // Errors
  errors: [
    { id: "queue_1", error: "Network timeout" },
    { id: "queue_2", error: "Invalid phone" }
  ],

  // Timestamps
  startedAt: Timestamp,
  completedAt: Timestamp
}
```

---

## Cron Jobs

| Cron | Schedule | Purpose | File |
|------|----------|---------|------|
| `run-agent-outreach-scraper` | Daily 9 PM UTC | Scrape properties for agent outreach | `/src/app/api/cron/run-agent-outreach-scraper/route.ts` |
| `process-agent-outreach-queue` | Every 4 hours | Send batches to GHL | `/src/app/api/cron/process-agent-outreach-queue/route.ts` |

### run-agent-outreach-scraper

**Schedule:** Daily at 9 PM UTC (3 PM CST)

**What It Does:**
1. Calls Apify Zillow scraper
2. Searches: Memphis/TN, $50k-$500k
3. Filters out properties with owner financing keywords
4. Extracts agent contact info
5. Adds to `agent_outreach_queue`

**Configuration:**
```typescript
{
  location: "Memphis, TN",
  minPrice: 50000,
  maxPrice: 500000,
  daysOnZillow: 1,  // Only last 24 hours
  excludeKeywords: ["owner finance", "seller finance", "rent to own"],
  excludePropertyTypes: ["multi-family", "land", "foreclosure", "auction"]
}
```

---

### process-agent-outreach-queue

**Schedule:** Every 4 hours (0, 4, 8, 12, 16, 20 UTC)

**What It Does:**
1. Fetches pending items (limit: 50)
2. Resets stuck items (>30 min in processing)
3. Sends each to GHL webhook
4. Updates status to `sent_to_ghl`
5. Tracks in `contacted_agents`
6. Retries failed items (max 3)
7. Logs to `cron_logs`

**Rate Limiting:**
- 100ms delay between requests
- Batch size: 50 properties

---

## Admin Endpoints

### Send Properties to GHL

**Endpoint:** `POST /api/admin/properties/send-to-ghl`

**Purpose:** Manually send selected properties to GHL

**Request:**
```json
{
  "propertyIds": ["prop_1", "prop_2", "prop_3"]
}
```

**Response:**
```json
{
  "success": true,
  "sent": 3,
  "failed": 0
}
```

---

### Send Cash Deals to GHL

**Endpoint:** `POST /api/admin/cash-deals/send-to-ghl`

**Purpose:** Send cash deals (< 80% ARV) to GHL for agent outreach

**Request:**
```json
{
  "propertyIds": ["deal_1", "deal_2"]
}
```

---

### Send Zillow Imports to GHL

**Endpoint:** `POST /api/admin/zillow-imports/send-to-ghl`

**Purpose:** Export Zillow imports with owner financing keywords

**Features:**
- Filters for owner financing keywords
- Deduplicates by ZPID
- Max 3 properties per agent phone

---

### Monitor GHL Sync

**Endpoint:** `GET /api/admin/monitor-ghl-sync`

**Purpose:** Check sync status between GHL and Firestore

**Response:**
```json
{
  "totalInGHL": 150,
  "totalInFirestore": 148,
  "missing": 2,
  "missingIds": ["ghl_123", "ghl_456"],
  "stageBreakdown": {
    "new_lead": 50,
    "contacted": 30,
    "exported_to_website": 70
  }
}
```

---

### Test GHL Notification

**Endpoint:** `POST /api/admin/test-ghl-notification`

**Purpose:** Test SMS notification to a specific buyer

**Request:**
```json
{
  "buyerId": "buyer_123",
  "propertyId": "prop_456"
}
```

---

### Agent Outreach Queue Stats

**Endpoint:** `GET /api/admin/agent-outreach-queue/stats`

**Purpose:** View queue statistics

**Response:**
```json
{
  "pending": 125,
  "processing": 0,
  "sent_to_ghl": 450,
  "agent_yes": 32,
  "agent_no": 180,
  "failed": 8,
  "total": 795
}
```

---

## Environment Variables

### Required Variables

```bash
# GHL API Access
GOHIGHLEVEL_API_KEY=your_api_key_here
GOHIGHLEVEL_LOCATION_ID=your_location_id_here

# Webhook Security
GHL_WEBHOOK_SECRET=your_webhook_secret_here

# Outgoing Webhooks
GHL_AGENT_OUTREACH_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/...
GOHIGHLEVEL_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/...
GHL_BUYER_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/...
```

### Where to Find These

| Variable | Where to Find |
|----------|---------------|
| `GOHIGHLEVEL_API_KEY` | GHL Settings > API Keys |
| `GOHIGHLEVEL_LOCATION_ID` | GHL Settings > Business Info > Location ID |
| `GHL_WEBHOOK_SECRET` | Create in GHL and save here |
| `GHL_*_WEBHOOK_URL` | GHL Automations > Workflows > Webhook Trigger |

---

## Security

### Webhook Signature Verification

All incoming webhooks are verified using HMAC-SHA256:

```typescript
// Signature verification
const expectedSignature = crypto
  .createHmac('sha256', GHL_WEBHOOK_SECRET)
  .update(JSON.stringify(body))
  .digest('hex');

const receivedSignature = headers.get('x-ghl-signature');

if (expectedSignature !== receivedSignature) {
  return new Response('Unauthorized', { status: 401 });
}
```

### Supported Signature Headers

- `x-ghl-signature`
- `X-GHL-Signature`
- `x-webhook-signature`
- `X-Webhook-Signature`

### Signature Formats

- Plain hex: `abc123...`
- With prefix: `sha256=abc123...`

### Rate Limiting

Webhooks are rate limited:
- **Limit:** 100 requests per IP per minute
- **Response:** 429 Too Many Requests when exceeded

### Admin Authentication

Admin endpoints require:
- NextAuth session
- User role = 'admin'

---

## Troubleshooting

### "Webhook signature verification failed"

1. Check `GHL_WEBHOOK_SECRET` matches what's in GHL
2. Verify the signature header is being sent
3. Check for whitespace in the secret

### "Agent outreach not sending"

1. Check `agent_outreach_queue` for pending items
2. Verify cron job is running (check `cron_logs`)
3. Check `GHL_AGENT_OUTREACH_WEBHOOK_URL` is correct
4. Look for errors in Vercel logs

### "Buyers not receiving SMS"

1. Check buyer has `smsNotifications: true`
2. Verify buyer has valid phone number
3. Check `notifiedPropertyIds` doesn't include property
4. Review `webhookLogs` for errors
5. Verify `GOHIGHLEVEL_WEBHOOK_URL` is correct

### "Properties not matching buyers"

1. Check buyer's `preferredState` matches property state
2. Verify buyer's `preferredCities` includes property city
3. Check budget criteria (monthly payment or down payment)
4. Verify buyer is active (`isActive: true`)

### "Stuck items in processing"

1. Items stuck > 30 min are auto-reset by cron
2. Check for network errors in logs
3. Verify GHL webhook URL is responding
4. Check `retryCount` < 3

### "Duplicate notifications"

1. Check `notifiedPropertyIds` is being updated
2. Verify webhook returns 200 before marking sent
3. Check for race conditions in parallel processing

---

## Key File Locations

```
src/
├── app/api/
│   ├── webhooks/gohighlevel/
│   │   ├── property/route.ts           # Incoming property webhook
│   │   ├── agent-response/route.ts     # Agent YES/NO responses
│   │   ├── property-match/route.ts     # Forward to GHL for SMS
│   │   └── agent-not-interested/route.ts
│   ├── cron/
│   │   ├── run-agent-outreach-scraper/route.ts
│   │   └── process-agent-outreach-queue/route.ts
│   └── admin/
│       ├── properties/send-to-ghl/route.ts
│       ├── cash-deals/send-to-ghl/route.ts
│       ├── zillow-imports/send-to-ghl/route.ts
│       └── monitor-ghl-sync/route.ts
│
└── lib/
    ├── gohighlevel-api.ts              # GHL API client
    ├── gohighlevel-notifications.ts    # Notification logic
    └── sms-templates.ts                # SMS message templates
```

---

## External Resources

| Resource | URL |
|----------|-----|
| **GHL Dashboard** | https://app.gohighlevel.com |
| **GHL API Docs** | https://highlevel.stoplight.io |
| **GHL Workflows** | Dashboard > Automation > Workflows |
| **GHL Webhooks** | Dashboard > Settings > Webhooks |

---

*Last updated: January 2025*
