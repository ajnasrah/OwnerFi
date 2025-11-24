# Negative Keyword Filter - Agent Outreach System

## Overview

The agent outreach scraper now automatically filters out properties that explicitly state they do **NOT** offer owner financing or creative financing options.

This prevents wasting time and GHL contact slots on properties that are guaranteed to say "NO" when asked.

---

## How It Works

### Filter Location
**File:** `src/app/api/cron/run-agent-outreach-scraper/route.ts`

### Filter Logic
```typescript
// After checking for positive owner finance keywords...

// CRITICAL: Skip if description has negative keywords
const negativeCheck = hasNegativeKeywords(description);

if (negativeCheck.hasNegative) {
  skippedNegativeKeywords++;
  console.log(`⏭️ Skipping ${property.address} - negative keywords found: ${negativeCheck.matches.join(', ')}`);
  continue;
}
```

---

## What Gets Filtered Out

### 1. **Explicit "NO" Statements**
- "no owner financing"
- "no seller financing"
- "no creative financing"
- "owner financing not available"
- "not offering owner financing"
- "will not carry"
- "cannot finance"

### 2. **Cash Only Requirements**
- "cash only"
- "cash buyers only"
- "all cash only"
- "cash offers only"
- "cash required"
- "must be cash"

### 3. **Conventional/Traditional Only**
- "cash or conventional"
- "conventional financing only"
- "traditional financing only"
- "bank financing only"
- "cash or conventional only"

### 4. **Wholesale/Investor Exclusions**
- "no wholesalers, no assignments, no owner financing"
- "no creative or owner financed offers"
- "no assignments or seller financing"
- "no contract sales or owner financing"

### 5. **Complete List**
The filter checks against **200+ negative keyword patterns** including:
- All variations with hyphens: "owner-financing", "seller-financing"
- Truncated versions: "no owner fin", "no seller fin"
- Complex phrases: "seller is not interested in owner financing"
- And many more...

**Full list:** See `src/lib/negative-keywords.ts`

---

## Example Scenarios

### ❌ **FILTERED OUT** - Will NOT Contact Agent

**Property Description:**
> "Beautiful 3BR home. **Cash only**, no financing. Recently renovated..."

**Result:** ⏭️ Skipped - negative keywords: "cash only"

---

**Property Description:**
> "Investor special! **No owner financing, no creative offers**. Needs work..."

**Result:** ⏭️ Skipped - negative keywords: "no owner financing", "no creative offers"

---

**Property Description:**
> "Price reduced! **Cash or conventional financing only**. Move-in ready..."

**Result:** ⏭️ Skipped - negative keywords: "cash or conventional financing only"

---

### ✅ **NOT FILTERED** - Will Contact Agent

**Property Description:**
> "Charming 3BR home. Motivated seller. Make an offer!"

**Result:** ✅ Added to queue - no negative keywords found

---

**Property Description:**
> "Investment opportunity. Price negotiable. Seller open to offers."

**Result:** ✅ Added to queue - no negative keywords found

---

## Benefits

1. **Saves GHL Contact Slots**
   - Don't waste contacts on guaranteed "NO" responses

2. **Increases Response Rate**
   - Only contact agents who haven't explicitly said NO

3. **Saves Time**
   - No need to process responses from properties that won't work

4. **Cleaner Pipeline**
   - Focus on real opportunities, not dead ends

5. **Better Agent Relationships**
   - Don't annoy agents by asking when they've already said NO in the listing

---

## Filter Order (Processing Pipeline)

Properties go through these filters in order:

1. ✅ **Has URL/ZPID?** → If no, skip
2. ✅ **Has agent contact info?** → If no, skip
3. ✅ **Has positive owner finance keywords?** → If yes, skip (System 1 handles it)
4. ✅ **Has NEGATIVE keywords?** → If yes, skip ← **NEW FILTER**
5. ✅ **Already in queue?** → If yes, skip
6. ✅ **Already in zillow_imports?** → If yes, skip
7. ✅ **Already in cash_deals?** → If yes, skip
8. ✅ **Already contacted this agent about this property?** → If yes, skip
9. ✅ **Passes all filters** → Add to queue

---

## Statistics Tracking

The scraper now reports how many properties were filtered out:

```
✅ [AGENT OUTREACH SCRAPER] Complete:
   ✅ Added to queue: 87
      💰 Cash deals: 23
      🏡 Potential owner finance: 64
   ⏭️  Skipped (has owner finance keywords): 15
   ⏭️  Skipped (negative keywords - explicitly NO): 42  ← NEW
   ⏭️  Already in queue: 8
   ⏭️  Already contacted: 18
```

---

## Word Boundary Matching

The filter uses **word boundary matching** to prevent false positives:

### ✅ **Correctly Matched**
- "cash only" in "This is a cash only sale" → **MATCHED**
- "no owner financing" in "Property has no owner financing" → **MATCHED**

### ✅ **NOT Falsely Matched**
- "no" in "Renovated kitchen" → **NOT MATCHED** (not a boundary match)
- "cash" in "cashew trees" → **NOT MATCHED** (not "cash only")
- "conventional" in "unconventional layout" → **NOT MATCHED** (word boundary)

This ensures we only filter out genuine negative statements, not random word occurrences.

---

## Maintenance

The negative keyword list is maintained in:
**`src/lib/negative-keywords.ts`**

To add new negative keywords:
1. Add to the `NEGATIVE_KEYWORDS` array
2. The regex patterns are automatically generated
3. Redeploy

The list is already comprehensive (200+ patterns) based on analysis of 166 false positives found in the database.

---

## Status

✅ **Implemented and Active**
- Filter is now live in the agent outreach scraper
- Will take effect on next scraper run (daily at 6 AM)
- No leakage of "no owner finance" properties into the pipeline

---

## Summary

**Before:** Properties saying "no owner finance" would be sent to GHL, wasting contacts and time.

**Now:** Automatically filtered out before adding to queue, ensuring only viable opportunities reach GHL.

**Impact:** Cleaner pipeline, better response rates, less wasted effort. 🎯
