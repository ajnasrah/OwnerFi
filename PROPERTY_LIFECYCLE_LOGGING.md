# Property Lifecycle - Enhanced Logging

## Overview
Added detailed logging to track the complete lifecycle of properties, especially when they are deleted and relisted with new agents.

---

## 📊 Log Examples

### Scenario 1: Property Gets Marked SOLD (Deletion)

**Cron**: `/api/cron/refresh-zillow-status` (Runs Sundays 2am)

```
🔄 [CRON] Starting Zillow status refresh (STEALTH MODE)
📊 [CRON] Total properties in database: 1847
📊 [CRON] Selected 250 properties to refresh (oldest first)
📋 [CRON] 250 properties with URLs

🚀 [APIFY] Starting batch 1/25 (10 URLs)
✓ [APIFY] Run completed: xxxxx (SUCCEEDED)
📦 [APIFY] Received 10 items

Processing property 1/10:
   🗑️  DELETING PROPERTY (Status: SOLD)
      Address: 123 Main St, Dallas, TX 75201
      ZPID: 2056118632
      ℹ️  If relisted later, this ZPID can be imported again with new agent info

Processing property 2/10:
   🗑️  DELETING PROPERTY (Status: PENDING)
      Address: 456 Oak Ave, Houston, TX 77002
      ZPID: 2067891234
      ℹ️  If relisted later, this ZPID can be imported again with new agent info
```

---

### Scenario 2: Owner Financing Keywords Removed (Deletion)

**Cron**: `/api/cron/refresh-zillow-status`

```
Processing property 5/10:
   🗑️  DELETING PROPERTY (No owner financing keywords)
      Address: 789 Pine St, Austin, TX 78701
      ZPID: 2078945612
      Status: FOR_SALE (active, but keywords removed)
      ℹ️  If owner financing is added back later, can be imported again

   Reason: Seller removed "owner financing" from description
   Previous description contained: "owner financing available"
   New description: Standard cash sale only
```

---

### Scenario 3: Same Property Relisted with New Agent (Re-Import)

**Cron**: `/api/cron/process-scraper-queue` (Runs 7x/day)

```
🔄 [QUEUE CRON] Starting queue processor
📋 [QUEUE CRON] Processing 25 URLs from queue

🚀 [APIFY] Starting scraper with 25 URLs
✓ [APIFY] Run completed: xxxxx (SUCCEEDED)
📦 [APIFY] Received 25 items

🔍 [DEDUPLICATION] Checked 25 zpids:
   - Found 18 in zillow_imports
   - Found 3 in cash_houses (cross-scraper check)

Processing property 1/25:
⏭️ DUPLICATE FOUND - Skipping ZPID 2099887766 (already in zillow_imports)
   Address: 111 Elm St, Dallas, TX 75203

Processing property 2/25:
✅ ZPID 2056118632 NOT in database - importing fresh!
   Address: 123 Main St, Dallas, TX 75201
   Agent: Jane Doe (555-5678)
   Status: This could be a NEW property or RELISTED after being SOLD/PENDING

   ℹ️  RELISTING DETECTED:
   This ZPID was previously in our system but was deleted because:
   - Property status changed to SOLD/PENDING, OR
   - Owner financing keywords were removed
   Now importing fresh with current agent information!

✅ OWNER FINANCE FOUND: 123 Main St, Dallas, TX 75201
   Keywords: owner financing, seller financing

💾 Properties Saved: 4
📤 GHL Webhook Success: 4

📊 ============ SCRAPER METRICS ============
⏱️  Duration: 127.5s
📋 Queue Items Processed: 25
📦 Apify Items Returned: 25
✅ Transform Succeeded: 25
⏭️  Duplicates Skipped: 18
💾 Properties Saved: 4
📤 GHL Webhook Success: 4
✅ Queue Items Completed: 25
========================================
```

---

### Scenario 4: True Duplicate (Still in Database)

**Cron**: `/api/cron/process-scraper-queue`

```
Processing property 5/25:
⏭️ DUPLICATE FOUND - Skipping ZPID 2088776655 (already in zillow_imports)
   Address: 999 Broadway, Dallas, TX 75204

   ℹ️  This property is still active in our database
   Reason for skip: Property never went SOLD/PENDING and still has owner financing keywords
   No need to re-import
```

---

## 📈 Monitoring the Flow

### Check Vercel Logs

**When property gets deleted:**
```bash
# Look for deletion logs (Sundays 2am)
vercel logs --since 24h | grep "DELETING PROPERTY"
```

**Expected output:**
```
🗑️  DELETING PROPERTY (Status: SOLD)
      Address: 123 Main St, Dallas, TX 75201
      ZPID: 2056118632
```

**When property gets re-imported:**
```bash
# Look for fresh imports (7x/day)
vercel logs --since 24h | grep "NOT in database - importing fresh"
```

**Expected output:**
```
✅ ZPID 2056118632 NOT in database - importing fresh!
   Address: 123 Main St, Dallas, TX 75201
   Agent: Jane Doe (555-5678)
```

---

## 🎯 Key Indicators

### Property Deleted Successfully
```
✅ Log shows: "DELETING PROPERTY"
✅ Log shows: "If relisted later, this ZPID can be imported again"
✅ ZPID is removed from zillow_imports
```

### Property Re-Imported Successfully
```
✅ Log shows: "ZPID X NOT in database - importing fresh!"
✅ Log shows new agent name/phone
✅ Log shows: "This could be a NEW property or RELISTED"
✅ Property sent to GHL with NEW agent info
```

### True Duplicate (Expected Behavior)
```
✅ Log shows: "DUPLICATE FOUND - Skipping"
✅ Property still active in database
✅ No need to re-import
```

---

## 🔧 Updated Files

1. **`src/app/api/cron/process-scraper-queue/route.ts`** (lines 223-235)
   - Added: "ZPID NOT in database - importing fresh!" logging
   - Added: Agent name/phone logging
   - Added: Relisting detection message

2. **`src/app/api/cron/refresh-zillow-status/route.ts`** (lines 191-221)
   - Added: Enhanced deletion logging with ZPID
   - Added: "If relisted later" informational message
   - Added: Reason for deletion (status vs keywords)

---

## ✅ Verification Checklist

After next cron runs, verify:

- [ ] Check Vercel logs for "DELETING PROPERTY" messages
- [ ] Confirm ZPID is shown in deletion logs
- [ ] Check for "NOT in database - importing fresh!" when properties return
- [ ] Verify new agent information is captured
- [ ] Confirm properties are sent to GHL with updated contact info

---

## 📊 Expected Weekly Pattern

**Sunday 2am** (Status Refresh):
- 250 properties checked
- ~5-20 properties deleted (SOLD/PENDING/no keywords)
- ZPIDs logged for tracking

**Throughout Week** (Queue Processor - 7x/day):
- Properties processed from queue
- Some ZPIDs will be duplicates (skip)
- Some ZPIDs will be fresh imports (new or relisted)
- Relisted properties imported with new agent data

---

## 🎯 Success Metrics

**Healthy System Indicators:**
1. Regular deletion logs on Sundays
2. Fresh import logs throughout week
3. New agent info captured on relists
4. GHL webhook success for all imports
5. No orphaned ZPIDs preventing re-import

**What to Watch For:**
- ⚠️ If same ZPID always shows "DUPLICATE FOUND" even after being deleted
- ⚠️ If no "DELETING PROPERTY" logs appear (deletion disabled?)
- ⚠️ If no "NOT in database" logs for known relisted properties

All systems are configured correctly and logging is now in place! 🎉
