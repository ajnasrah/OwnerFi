# Duplicate Prevention System

## Overview

The agent outreach system now prevents duplicate contacts by checking against a `contacted_agents` collection before sending properties to GHL.

---

## How It Works

### Deduplication Logic

**Same Address + Same Phone = Duplicate (Skip)**
- If we've already contacted Agent A about 123 Main St, we won't contact them again
- If a different agent (Agent B) lists the same property with a different phone, we WILL contact them (might be a new listing agent)

### Collections

#### `contacted_agents`
Stores all agents we've contacted (from CSV import + new outreach):

```typescript
{
  propertyAddress: "123 Main St",
  contactName: "John Smith",
  contactPhone: "+19015551234",
  contactEmail: "john@example.com",

  // For fast deduplication queries
  addressNormalized: "123 main st",  // lowercase, no punctuation
  phoneNormalized: "9015551234",      // digits only

  // Status tracking
  stage: "sent" | "not interested" | "pending",
  status: "awaiting_response" | "open",

  // Metadata
  source: "csv_import" | "agent_outreach_system",
  dealType: "cash_deal" | "potential_owner_finance",
  firebase_id: "queue_doc_id",
  opportunityId: "ghl_opp_id",
  importedAt: Date,
  createdOn: ISO string,
}
```

---

## System Flow

### 1. Import Existing Contacts (One-Time)
```bash
npx tsx scripts/import-contacted-agents.ts /path/to/opportunities.csv
```

This imports your CSV of previously contacted agents into the `contacted_agents` collection.

**Result:** ✅ 1402 agents imported from your CSV

### 2. Scraper Checks Before Adding to Queue

When the scraper finds new properties:

```typescript
// Normalize address and phone
const addressNormalized = normalize(property.address);
const phoneNormalized = normalize(agentPhone);

// Check if we've already contacted this agent about this property
const alreadyContacted = await db
  .collection('contacted_agents')
  .where('addressNormalized', '==', addressNormalized)
  .where('phoneNormalized', '==', phoneNormalized)
  .limit(1)
  .get();

if (!alreadyContacted.empty) {
  // Skip - we've already contacted this agent
  continue;
}

// Add to queue (new property + agent combination)
await db.collection('agent_outreach_queue').add({...});
```

### 3. Queue Processor Marks as Contacted

When properties are sent to GHL:

```typescript
// Send to GHL
await sendToGHL(property);

// Mark as contacted to prevent future duplicates
await db.collection('contacted_agents').add({
  propertyAddress: property.address,
  contactName: property.agentName,
  contactPhone: property.agentPhone,
  addressNormalized: property.addressNormalized,
  phoneNormalized: property.phoneNormalized,
  status: 'awaiting_response',
  source: 'agent_outreach_system',
  importedAt: new Date(),
});
```

---

## Address Normalization

Addresses are normalized for consistent matching:

```typescript
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()                    // "123 Main St" → "123 main st"
    .trim()
    .replace(/[#,\.]/g, '')          // Remove punctuation
    .replace(/\s+/g, ' ')            // Single spaces
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|circle|cir)\b/g, '')  // Remove common suffixes
    .trim();
}
```

**Examples:**
- "123 Main Street" → "123 main"
- "123 Main St." → "123 main"
- "123 Main St, Apt #5" → "123 main  apt 5"

### Phone Normalization

```typescript
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, ''); // Remove all non-digits
}
```

**Examples:**
- "+1 (901) 555-1234" → "19015551234"
- "901-555-1234" → "9015551234"
- "9015551234" → "9015551234"

---

## Examples

### Example 1: Same Agent, Same Property = Skip

**CSV Import:**
- Address: "123 Main St"
- Agent: John Smith
- Phone: "+19015551234"

**New Scrape:**
- Address: "123 Main Street"  ← Normalizes to same
- Agent: John Smith
- Phone: "(901) 555-1234"     ← Normalizes to same

**Result:** ⏭️ **SKIPPED** - Already contacted

---

### Example 2: Different Agent, Same Property = Contact

**CSV Import:**
- Address: "123 Main St"
- Agent: John Smith
- Phone: "+19015551234"

**New Scrape:**
- Address: "123 Main St"      ← Same property
- Agent: Jane Doe             ← Different agent
- Phone: "+19015559999"       ← Different phone

**Result:** ✅ **CONTACTED** - New agent listing same property

---

### Example 3: Same Agent, Different Property = Contact

**CSV Import:**
- Address: "123 Main St"
- Agent: John Smith
- Phone: "+19015551234"

**New Scrape:**
- Address: "456 Oak Ave"      ← Different property
- Agent: John Smith           ← Same agent
- Phone: "+19015551234"       ← Same phone

**Result:** ✅ **CONTACTED** - Same agent, but different property

---

## Files Modified

### New Files
- `scripts/import-contacted-agents.ts` - Import CSV of previously contacted agents
- `DUPLICATE_PREVENTION.md` - This documentation

### Modified Files
- `src/app/api/cron/run-agent-outreach-scraper/route.ts`
  - Added check against `contacted_agents` collection
  - Stores normalized address/phone in queue

- `src/app/api/cron/process-agent-outreach-queue/route.ts`
  - Adds entry to `contacted_agents` after sending to GHL

---

## Maintenance

### Re-import Updated CSV

If you get a new export from GHL with more contacted agents:

```bash
# This will skip duplicates automatically
npx tsx scripts/import-contacted-agents.ts /path/to/new-opportunities.csv
```

### Check Duplicate Prevention Stats

```typescript
// Count total contacted agents
const total = await db.collection('contacted_agents').count().get();

// Count by source
const fromCSV = await db.collection('contacted_agents')
  .where('source', '==', 'csv_import')
  .count().get();

const fromSystem = await db.collection('contacted_agents')
  .where('source', '==', 'agent_outreach_system')
  .count().get();
```

---

## Database Indexes

For optimal performance, create these Firestore indexes:

```
Collection: contacted_agents
├─ addressNormalized (Ascending) + phoneNormalized (Ascending)
└─ source (Ascending) + importedAt (Descending)
```

Firestore will prompt you to create these automatically when the queries run.

---

## Status

✅ **Implemented and Tested**
- ✅ CSV import script created
- ✅ 1402 agents imported from your CSV
- ✅ Scraper checks before adding to queue
- ✅ Queue processor marks as contacted
- ✅ Address/phone normalization
- ✅ System ready for production

---

## Summary

**Before:** Risk of contacting same agent multiple times about same property

**Now:** Automatic duplicate prevention
- Checks against 1402+ contacted agents
- Normalizes addresses and phones for reliable matching
- Allows different agents for same property
- Tracks all contacts in one collection

**Result:** No duplicate outreach, better agent relationships! 🎯
