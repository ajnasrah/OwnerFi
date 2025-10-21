# Quick Start Guide - Zillow Scraper with Bookmarklet

## 🎯 What Changed

**BEFORE:** Agent/broker data wasn't being saved ❌
**NOW:** Complete contact extraction with multiple fallbacks ✅

---

## 🚀 Quick Setup (5 Minutes)

### 1. Update Your Bookmarklet

**Open:** `scripts/zillow-save-bookmarklet.js`

**Find line 6 and change:**
```javascript
const API_URL = 'https://YOURAPP.vercel.app/api/scraper/add-to-queue';
```

**Copy the minified code** at the bottom of the file (starts with `javascript:(function(){...`)

**Create Chrome bookmark:**
- Right-click bookmark bar
- Add page
- Name: "Save to OwnerFi"
- URL: Paste the code
- Save

### 2. Add Cron Job to Vercel

**Edit `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/process-scraper-queue",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### 3. Deploy

```bash
git add .
git commit -m "Add bookmarklet queue system"
git push origin main
```

Vercel will auto-deploy.

---

## 📝 How to Use

### Save Properties from Zillow

1. Go to any Zillow property page
2. Click "Save to OwnerFi" bookmark
3. See notification: ✅ "Property saved to queue!"
4. Repeat for more properties

### Wait for Cron to Process

Cron runs **every 15 minutes** and:
- Picks up 50 URLs from queue
- Sends to Apify
- Saves full data to Firebase
- Takes ~2-3 minutes per batch

### Export Data

Admin Dashboard → Zillow Imports → "Export to GHL Format"

---

## 🔍 Verify It's Working

### Check Queue (Firebase Console)

```
Firestore → scraper_queue
```

Should see documents with:
- `status: "pending"` (waiting to be processed)
- `status: "completed"` (already processed)

### Check Scraped Data

```
Firestore → zillow_imports
```

Should see:
- ✅ `agentName`: "John Doe"
- ✅ `agentPhoneNumber`: "555-1234"
- ✅ `brokerName`: "Real Estate Inc"
- ✅ `brokerPhoneNumber`: "555-5678"
- ✅ `propertyImages`: ["url1", "url2", ...]
- ✅ `firstPropertyImage`: "https://..."

### Check Vercel Logs

```bash
vercel logs --follow
```

Look for:
```
✓ FOUND CONTACT for ZPID 12345678
  agentName: "John Doe"
  agentPhone: "555-1234"
  brokerPhone: "555-5678"
```

---

## 🧪 Test It

### 1. Test Bookmarklet API

```bash
curl -X POST https://yourapp.vercel.app/api/scraper/add-to-queue \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.zillow.com/homedetails/123-Main-St-...", "address":"123 Main St"}'
```

**Expected:** `{"success":true,"message":"Added to scraper queue"}`

### 2. Test Cron Job

```bash
curl https://yourapp.vercel.app/api/cron/process-scraper-queue
```

**Expected:** `{"success":true,"processed":X,"saved":Y}`

### 3. Test Data Extraction

```bash
npx tsx scripts/test-apify-data-extraction.ts /Users/abdullahabunasrah/Downloads/dataset_zillow-detail-scraper_*.json
```

**Expected:** Statistics showing % of properties with contact info

---

## 📊 Expected Results

**Contact Info Coverage:**
- ~70% have agent phone ✅
- ~10% have only broker phone (used as fallback) ✅
- ~20% have NO phone (automatically skipped) ⚠️

**This is normal** - not all Zillow listings have public contact info.

---

## ⚙️ Configuration

### Change Batch Size

**File:** `/api/cron/process-scraper-queue/route.ts`
**Line 25:**
```typescript
.limit(50)  // Change to 100 or whatever
```

### Change Cron Frequency

**File:** `vercel.json`
```json
"schedule": "*/30 * * * *"  // Every 30 minutes
"schedule": "0 * * * *"     // Every hour
```

---

## 🐛 Troubleshooting

### Bookmarklet shows "Failed to connect"

- Check if API is deployed
- Verify `API_URL` in bookmarklet matches your domain
- Check browser console for CORS errors

### No properties being processed

- Check if cron is set up in `vercel.json`
- Manually trigger: Visit `/api/cron/process-scraper-queue`
- Check `APIFY_API_KEY` in Vercel env vars

### No agent/broker data in Firebase

- Check Vercel logs for extraction warnings
- Run test script: `npx tsx scripts/test-apify-data-extraction.ts`
- Verify Apify is returning `attributionInfo` object

---

## 📚 Full Documentation

- **Setup Guide:** `BOOKMARKLET_QUEUE_SETUP.md`
- **Fix Summary:** `AGENT_DATA_FIX_SUMMARY.md`
- **Zillow Scraping Overview:** (review your original analysis)

---

## ✅ Checklist

- [ ] Update bookmarklet API_URL
- [ ] Create Chrome bookmark
- [ ] Add cron to vercel.json
- [ ] Deploy to Vercel
- [ ] Test with 5 properties
- [ ] Check Firebase for data
- [ ] Verify agent/broker fields populated
- [ ] Export to GHL
- [ ] Scale up!

---

## 🎉 You're Ready!

The system is now:
- ✅ Properly extracting agent/broker contact info
- ✅ Using multiple fallback sources
- ✅ Skipping properties without contact info
- ✅ Easy to use with one-click bookmarklet
- ✅ Automated processing every 15 minutes

**Questions?** Check the full docs or review the code.
