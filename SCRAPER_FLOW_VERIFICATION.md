# ✅ SCRAPER FLOW VERIFICATION CHECKLIST

## 🎯 COMPLETE FLOW: SCRAPE → FILTER → OUTREACH

### 1️⃣ **CRON JOBS** ✅
- **Main Scraper**: `/api/v2/scraper/run` 
  - Schedule: **Daily at 12pm CST** (18:00 UTC)
  - Max Duration: 600 seconds (10 minutes)
- **Agent Outreach**: `/api/cron/run-agent-outreach-scraper`
  - Schedule: **Daily at 6am CST** (11:00 UTC)  
  - Max Duration: 600 seconds (10 minutes)
- **Queue Processor**: `/api/cron/process-agent-outreach-queue`
  - Schedule: **Every hour**
  - Processes GHL outreach queue

---

## 2️⃣ **SEARCH CONFIGURATIONS** ✅

### **Search 1: Owner Finance (Nationwide)** - UNCHANGED
- Keyword-based search across entire US
- Keywords: "owner financing", "seller financing", "owner carry", etc.
- **Does NOT send to GHL**

### **Search 2: Cash Deals Regional (AR/TN)** - UNCHANGED  
- Geographic region search
- **SENDS TO GHL** for outreach

### **Search 3: Targeted Zips** - ✅ UPDATED WITH YOUR 30 ZIPS
- **30 individual zip code searches**
- **NEW Zip Codes**: Knoxville TN, Athens GA, Columbus OH
- **Filters Applied**:
  - ✅ 1970+ built homes only (`built: { min: 1970 }`)
  - ✅ $40k-$150k price range
  - ✅ Max $55k monthly payment
  - ✅ Max $200 HOA
  - ✅ 1 day listings (fresh daily)
  - ✅ No land/apartments/manufactured/55+ communities
- **SENDS TO GHL** for outreach

---

## 3️⃣ **PROPERTY FILTERING** ✅

### **Owner Finance Detection**
Properties are marked as owner finance if they contain:
- "owner financing", "seller financing"
- "owner carry", "seller carry"  
- "owner terms", "seller terms"
- "rent to own", "lease option"
- "contract for deed", "land contract"
- "assumable loan", "no bank needed"

### **Cash Deal Detection**
Properties are marked as cash deals if:
- Price < 80% of Zestimate (ARV)
- Excludes auctions/foreclosures
- May also detect "needs work" keywords

---

## 4️⃣ **GHL WEBHOOK INTEGRATION** ✅

### **Which Properties Go to GHL?**
✅ **Search 2**: AR/TN Regional properties  
✅ **Search 3**: Your 30 targeted zip codes

### **GHL Webhook URL**
```
https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/f13ea8d2-a22c-4365-9156-759d18147d4a
```

### **What Happens in GHL?**
1. Property data sent to webhook
2. GHL creates opportunity record
3. Agents contacted for owner finance deals
4. Tracked in `agent_outreach_queue` collection

---

## 5️⃣ **DATA FLOW** ✅

```
Daily at 12pm CST
     ↓
Run 3 Search Configurations
     ↓
Scrape Properties (Apify)
     ↓
Filter for Owner Finance & Cash Deals
     ↓
Save to Firestore 'properties' collection
     ↓
Index in Typesense for search
     ↓
Send Regional + Targeted Zips to GHL
     ↓
GHL contacts agents to find owner finance
     ↓
Process responses via queue processor (hourly)
```

---

## 6️⃣ **YOUR 30 ZIP CODES** ✅

### **Knoxville, TN** (10 zips)
37923, 37934, 37922, 37919, 37921, 37931, 37924, 37918, 37912, 37917

### **Athens, GA** (10 zips)
30605, 30606, 30609, 30602, 30607, 30601, 30608, 30622, 30677, 30506

### **Columbus, OH** (10 zips)
43235, 43017, 43240, 43229, 43202, 43210, 43201, 43214, 43228, 43223

---

## 7️⃣ **ALERTS & NOTIFICATIONS** ✅

### **Abdullah SMS Alerts**
- Sends SMS for cash deals < 80% ARV
- Only for regional properties (AR/TN + your 30 zips)
- Phone: 9018319661

### **Investor Subscriber Alerts**
- Email alerts for cash deals up to 90% ARV
- Sent to all investor subscribers

### **Buyer Notifications**
- Owner finance properties trigger buyer matching
- Notifications sent via `/api/properties/sync-matches`

---

## ⚠️ **IMPORTANT NOTES**

1. **URL Generation**: Using `buildPreciseZipSearchUrl()` for exact Zillow format
2. **1970+ Filter**: Applied to both targeted zips AND agent outreach
3. **Zip Filter**: Applied after scraping to remove bleed-over from neighboring zips
4. **GHL Tracking**: `sentToGHL` and `sentToGHLAt` fields prevent duplicates
5. **Daily Fresh**: `doz: { value: "1" }` ensures only new listings (1 day)

---

## 🔍 **VERIFICATION STEPS**

### **To Test the System:**

1. **Check Cron is Running**:
   ```bash
   curl https://ownerfi.ai/api/v2/scraper/run \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

2. **Verify Search URLs**:
   - Check `/src/lib/scraper-v2/search-config.ts`
   - Confirm `TARGETED_CASH_ZIPS` has 30 zips
   - Confirm `ZIP_CENTROIDS` has coordinates

3. **Monitor Firestore**:
   - Collection: `properties`
   - Check for new documents with your zip codes
   - Verify `isOwnerfinance` and `isCashDeal` flags

4. **Check GHL Webhook**:
   - Collection: `agent_outreach_queue`
   - Look for properties from your zip codes
   - Verify `sentToGHL` = true

5. **Verify Filters**:
   - Check properties have `yearBuilt >= 1970`
   - Confirm price range $40k-$150k
   - No land/apartments/manufactured

---

## ✅ **SYSTEM STATUS: READY**

Your scraper is configured to:
1. ✅ Run daily at 12pm CST
2. ✅ Search your 30 targeted zip codes
3. ✅ Filter for 1970+ brick homes
4. ✅ Detect owner finance opportunities
5. ✅ Send to GHL for agent outreach
6. ✅ Alert you for cash deals < 80% ARV

**Everything is set up correctly and ready to find owner finance deals!**