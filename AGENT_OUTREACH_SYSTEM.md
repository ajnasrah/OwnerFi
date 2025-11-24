# Agent Outreach System Documentation

## Overview

The Agent Outreach System is a dual-pipeline property discovery system that proactively reaches out to listing agents to find:
1. **Owner Finance Deals** - Properties where sellers might consider owner financing
2. **Cash Deals** - Properties priced below 80% of Zestimate (motivated sellers)

---

## System Architecture

### Two Independent Systems

#### System 1: Verified Owner Finance (Existing)
```
Zillow Search (with "owner financing" keywords)
    ↓
zillow_imports collection
    ↓
Display on website (public)
```

#### System 2: Agent Outreach (New)
```
Zillow Search (newly listed, NO filters)
    ↓
agent_outreach_queue collection
    ↓
Send to GHL (batches of 25)
    ↓
Agent responds YES/NO
    ↓
IF YES → zillow_imports OR cash_deals
IF NO → rejected (archived)
```

---

## Collections

### `agent_outreach_queue`
Stores properties pending agent outreach or awaiting response.

```typescript
{
  // Identifiers
  zpid: string,
  url: string,

  // Address
  address: string,
  city: string,
  state: string,
  zipCode: string,

  // Pricing
  price: number,
  zestimate: number,
  priceToZestimateRatio: number, // e.g., 0.75 = 75% of zestimate

  // Property details
  beds: number,
  baths: number,
  squareFeet: number,
  propertyType: string,

  // Agent info
  agentName: string,
  agentPhone: string,
  agentEmail: string,

  // Classification
  dealType: 'potential_owner_finance' | 'cash_deal',

  // Status tracking
  status: 'pending' | 'processing' | 'sent_to_ghl' | 'agent_yes' | 'agent_no' | 'failed',

  // GHL tracking
  ghlOpportunityId?: string,
  ghlContactId?: string,
  sentToGHLAt?: Date,

  // Response tracking
  agentResponse?: 'yes' | 'no',
  agentResponseAt?: Date,
  agentNote?: string,
  routedTo?: 'zillow_imports' | 'cash_deals' | 'rejected',

  // Error tracking
  errorMessage?: string,
  retryCount?: number,
  lastFailedAt?: Date,

  // Metadata
  source: 'agent_outreach_scraper',
  rawData: any, // Full Zillow property data
  addedAt: Date,
  updatedAt: Date,
}
```

### `cash_deals`
Stores agent-confirmed below-market properties.

```typescript
{
  // Same structure as zillow_imports, plus:
  zestimate: number,
  priceToZestimateRatio: number,
  discountPercent: number, // e.g., 25 = 25% below market

  source: 'agent_outreach',
  agentConfirmedMotivated: true,
  agentConfirmedAt: Date,
  originalQueueId: string,
}
```

---

## API Endpoints

### Cron Jobs

#### 1. `/api/cron/run-agent-outreach-scraper`
**Purpose:** Find newly listed properties from Zillow
**Schedule:** Daily at 6 AM
**What it does:**
- Searches Zillow for properties listed in last 3 days
- NO owner finance keyword filter
- Skips properties that already have owner finance keywords (System 1 handles those)
- Classifies properties:
  - Price < 80% Zestimate → `cash_deal`
  - Otherwise → `potential_owner_finance`
- Adds to `agent_outreach_queue`

**Expected Results:** ~100-200 properties per day

#### 2. `/api/cron/process-agent-outreach-queue`
**Purpose:** Send properties to GHL in batches of 25
**Schedule:** Every 4 hours (6 times per day)
**What it does:**
- Gets next 25 pending properties from queue
- Sends each to GHL webhook with:
  - Agent contact info
  - Property details
  - Deal type classification
  - Firebase ID (for webhook response)
- Updates status to `sent_to_ghl`
- Handles errors and retries

**Expected Results:** 150 properties sent per day max (25 × 6)

### Webhooks

#### `/api/webhooks/gohighlevel/agent-response`
**Purpose:** Receive agent YES/NO responses from GHL
**Method:** POST
**Security:** HMAC SHA-256 signature verification

**Expected Payload:**
```json
{
  "firebaseId": "abc123",
  "response": "yes",
  "agentNote": "Seller is motivated!",
  "opportunityId": "ghl_opp_123"
}
```

**What it does:**
- Validates signature and payload
- Looks up property in `agent_outreach_queue`
- If YES:
  - Owner Finance → Add to `zillow_imports` (displays on website)
  - Cash Deal → Add to `cash_deals`
- If NO:
  - Mark as rejected in queue
- Returns success response

---

## Environment Variables

Add these to your `.env.local`:

```bash
# GHL Webhook URL for sending agent outreach properties
GHL_AGENT_OUTREACH_WEBHOOK_URL=https://services.leadconnectorhq.com/hooks/YOUR_WEBHOOK_ID_HERE

# GHL Webhook Secret for verifying incoming responses
GHL_WEBHOOK_SECRET=your_webhook_secret_here

# Existing variables (already configured)
APIFY_API_KEY=your_apify_key
CRON_SECRET=your_cron_secret
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
```

---

## GHL Setup

### 1. Incoming Webhook (Receive Properties)
Create a webhook in GHL that receives property data from the queue processor.

**Custom Fields to Create:**
- `firebaseId` (text) - **CRITICAL: Must be passed back in response**
- `dealType` (text) - "cash_deal" or "potential_owner_finance"
- `zpid` (text) - Zillow property ID
- `propertyPrice` (number)
- `propertyZestimate` (number)
- `discountPercent` (number) - Only for cash deals

### 2. Outgoing Webhook (Send Responses)
Create a workflow that:
1. Sends message to agent with property details
2. Waits for agent to reply YES or NO
3. Sends response to: `https://yourdomain.com/api/webhooks/gohighlevel/agent-response`

**Payload to Send:**
```json
{
  "firebaseId": "{{custom.firebaseId}}",
  "response": "{{agent_response}}",
  "agentNote": "{{agent_note}}",
  "opportunityId": "{{opportunity.id}}"
}
```

**⚠️ CRITICAL:** The `firebaseId` field MUST be included in the response so we can look up the property.

---

## Message Templates

You'll handle these in GHL, but here are the two types:

### Owner Finance Template
```
🏡 NEW LISTING ALERT

📍 Address: {{property.address}}
💰 Price: ${{property.price}}
🛏️ Beds/Baths: {{property.beds}}/{{property.baths}}

❓ QUESTION FOR AGENT:
Would the seller consider OWNER FINANCING terms?

👉 Reply YES or NO
```

### Cash Deal Template
```
🏡 BELOW-MARKET OPPORTUNITY

📍 Address: {{property.address}}
💰 List Price: ${{property.price}}
🏷️ Zestimate: ${{property.zestimate}}
📉 {{discountPercent}}% BELOW MARKET

❓ QUESTION FOR AGENT:
Is seller motivated for QUICK CASH SALE?

👉 Reply YES or NO
```

---

## Monitoring & Admin

### Check Queue Status
```bash
# Check pending items
curl -X GET "http://localhost:3000/api/admin/agent-outreach-queue/stats" \
  -H "Authorization: Bearer your_session_token"
```

### Manually Trigger Cron Jobs
```bash
# Run scraper
curl -X GET "http://localhost:3000/api/cron/run-agent-outreach-scraper" \
  -H "Authorization: Bearer $CRON_SECRET"

# Process queue
curl -X GET "http://localhost:3000/api/cron/process-agent-outreach-queue" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Expected Flow Example

### Day 1
1. **6:00 AM** - Scraper finds 150 new properties
   - 30 cash deals (< 80% zestimate)
   - 120 potential owner finance
2. **8:00 AM** - Queue processor sends first 25 to GHL
3. **12:00 PM** - Queue processor sends next 25 to GHL
4. **Throughout day** - Agents respond via GHL
5. **Webhook receives responses:**
   - 10 YES (owner finance) → Added to `zillow_imports`
   - 3 YES (cash deals) → Added to `cash_deals`
   - 12 NO → Marked as rejected

### Result
- 10 new owner finance properties on website
- 3 new cash deals for cash buyers
- 100 properties still in queue for next batches

---

## Troubleshooting

### Properties not being sent to GHL
- Check `GHL_AGENT_OUTREACH_WEBHOOK_URL` in environment variables
- Check queue processor logs for errors
- Verify GHL webhook is active

### Agent responses not being processed
- Check `GHL_WEBHOOK_SECRET` matches your GHL configuration
- Verify webhook signature verification
- Check that `firebaseId` is being passed back from GHL

### Properties being skipped
- Properties with owner finance keywords are intentionally skipped (System 1 handles them)
- Duplicates are skipped if already in queue or other collections
- Properties without agent contact info are skipped

---

## Statistics & Metrics

Track these metrics for system health:

### Scraper Metrics
- Properties found per day
- Cash deals vs owner finance candidates
- Skipped (already has keywords)
- Duplicates skipped

### Queue Metrics
- Properties sent per day
- Success rate
- Error rate
- Average time in queue

### Conversion Metrics
- Agent YES rate (target: 5-10%)
- Owner finance conversions
- Cash deal conversions

---

## Future Enhancements

1. **Auto-retry failed items** - Retry properties that failed to send
2. **Agent response rate tracking** - Track which agents are most responsive
3. **Geographic targeting** - Focus on specific markets
4. **Price range optimization** - Test different zestimate thresholds
5. **Follow-up system** - Auto-follow-up if agent doesn't respond in 48 hours
