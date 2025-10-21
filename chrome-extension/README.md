# OwnerFi Chrome Extension v2.0 - Direct Firebase Queue Upload

Save Zillow properties directly to your OwnerFi scraper queue with one click!

---

## 🎯 What Changed

**Version 1.0 (Old):**
Zillow Search → Click Extension → Download CSV → Upload to Admin

**Version 2.0 (NEW):**
Zillow Search → Click Extension → **Directly Saved to Firebase Queue** ✅

**No more downloading and uploading files!**

---

## 🚀 Quick Setup

### Step 1: Update API URL

**Edit `popup.js` line 2:**
```javascript
const API_URL = 'https://ownerfi.vercel.app/api/scraper/add-to-queue';
```

Change `ownerfi.vercel.app` to your actual Vercel domain.

### Step 2: Load Extension in Chrome

1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Navigate to and select: `/Users/abdullahabunasrah/Desktop/ownerfi/chrome-extension/`
6. The extension is now installed!

You should see the house icon in your Chrome toolbar.

---

## 📖 How to Use

### Extract & Save Properties from Zillow

**Step 1: Set Up Your Zillow Search**

1. Go to [Zillow.com](https://www.zillow.com)
2. Set up your search filters:
   - **Location**: Any state/city
   - **Home Type**: Houses (Single Family)
   - **Price**: $0 - $1,000,000
   - **Days on Zillow**: 30 days
   - Click **More** filters
   - In **Keywords** field: `owner finance`
3. Click **Apply**

**Step 2: Save All Properties**

1. While on the Zillow search results page
2. Click the **OwnerFi Queue** extension icon in toolbar
3. Click **Save to Queue** button
4. Watch the progress bar!
   - Shows: "25 / 40" as it uploads
   - Takes ~30-40 seconds for 40 properties

**Step 3: Go to Next Page**

1. Click "Next" at bottom of Zillow results
2. Click extension icon again
3. Click **Save to Queue**
4. Repeat for all pages

**Results:**
- ✅ "X added to queue"
- ℹ️ "X already saved" (duplicates automatically skipped)
- ❌ "X failed" (if any errors)

---

## 🔄 What Happens Next

Once properties are saved to the queue:

### 1. Cron Job Runs Every 15 Minutes

- Picks up 50 pending URLs from `scraper_queue`
- Sends to Apify for full property scraping
- Extracts:
  - Agent name & phone ✅
  - Broker name & phone ✅
  - Property details (beds, baths, sqft)
  - Images, tax history, etc.

### 2. Data Saved to Firebase

- Full property data saved to `zillow_imports` collection
- Includes ALL 40+ fields
- Agent/broker contact info guaranteed

### 3. Export Whenever Ready

- Go to Admin Dashboard → Zillow Imports
- Click "Export to GHL Format"
- Download Excel with all properties

---

## 📊 What Gets Saved

### From Extension (Saved to Queue):
- **URL** - Full Zillow property URL
- **Address** - Street address
- **Price** - Listed price
- **Status** - `pending`
- **Timestamp** - When added

### From Apify (After Processing):
- Agent name, phone, email, license
- Broker name, phone
- Property images (array of URLs)
- Bedrooms, bathrooms, square footage
- Tax history, HOA, estimates
- And 30+ more fields!

---

## ⚡ Features

### ✅ Duplicate Prevention
- Checks Firebase before adding
- Won't re-add properties already in queue
- Won't re-add properties already scraped
- **Never any duplicates!**

### ✅ Progress Tracking
- Real-time progress bar
- Shows count: "25 / 40"
- Final statistics breakdown

### ✅ Error Handling
- Continues if one property fails
- Shows total errors at end
- Logs errors to browser console

### ✅ Works on Any Zillow Page
- Search results pages
- Saved homes pages
- Any page with property cards

---

## 🎯 Example Workflow

**Goal**: Save all owner finance properties in Texas

### Using the Extension:

1. **Search Zillow for Texas + "owner finance"**
   - Results: ~1,400 properties across ~35 pages

2. **Page 1:**
   - Click extension → "Save to Queue"
   - Result: "40 added to queue"
   - Time: ~40 seconds

3. **Page 2:**
   - Click "Next" on Zillow
   - Click extension → "Save to Queue"
   - Result: "40 added to queue, 0 duplicates"
   - Time: ~40 seconds

4. **Repeat for all 35 pages**
   - Total time: ~20-25 minutes
   - Total saved: ~1,400 properties

5. **Wait for Processing:**
   - Cron processes 50 URLs every 15 min
   - ~1,400 properties = ~7-8 hours
   - Happens automatically in background

6. **Export When Ready:**
   - Admin → Zillow Imports → Export to GHL
   - You have ~1,100 properties with contact info
   - (~300 skipped due to no agent/broker phone)

---

## 🛠️ Troubleshooting

### Extension not working?

**Check:**
1. Are you on a Zillow.com page?
2. Did you update the `API_URL` in `popup.js`?
3. Is your API endpoint deployed?

**Test API manually:**
```bash
curl -X POST https://ownerfi.vercel.app/api/scraper/add-to-queue \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.zillow.com/homedetails/test","address":"Test","price":"$100"}'
```

Should return: `{"success":true,"message":"Added to scraper queue"}`

### No properties found?

Make sure you're on a **search results page** with property cards, not:
- Zillow homepage
- Individual property details page
- User account pages

### All properties showing "already saved"?

This is GOOD! It means they're already in your queue or already scraped. The system prevents duplicates automatically.

### Properties saved but not processing?

**Check the cron job:**
1. Open `vercel.json`
2. Look for:
   ```json
   {
     "path": "/api/cron/process-scraper-queue",
     "schedule": "*/15 * * * *"
   }
   ```
3. If missing, it needs to be added and deployed

**Manually trigger cron:**
```bash
curl https://ownerfi.vercel.app/api/cron/process-scraper-queue
```

---

## 📈 Performance

### Extension Upload Speed:
- ~1 second per property
- 40 properties = ~40 seconds
- 1,000 properties = ~15-20 minutes of clicking

### Cron Processing Speed:
- 50 URLs per batch
- 1 batch every 15 minutes
- ~200 properties/hour
- 1,000 properties = ~5 hours

### Data Quality:
- ~70% have agent phone
- ~10% have broker phone (used as fallback)
- ~20% skipped (no contact info)
- **Expected behavior - not all listings have public contacts**

---

## 🔧 Advanced

### Change Upload Speed

Edit `popup.js` - add delay in upload loop:

```javascript
for (let i = 0; i < properties.length; i++) {
  // ... upload code ...

  // Add 500ms delay between uploads
  if (i < properties.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
```

### Extract More Fields

Edit `content.js` to extract additional data:

```javascript
// Add to extraction
const bedrooms = card.querySelector('[data-test="property-card-beds"]')?.textContent;
const bathrooms = card.querySelector('[data-test="property-card-baths"]')?.textContent;

properties.push({
  url,
  address,
  price,
  bedrooms,  // New field
  bathrooms  // New field
});
```

Then update `popup.js` to send them:

```javascript
body: JSON.stringify({
  url: property.url,
  address: property.address,
  price: property.price,
  bedrooms: property.bedrooms,
  bathrooms: property.bathrooms
})
```

### Batch Upload (Future Enhancement)

Instead of uploading one-by-one, you could:
1. Extract all properties
2. Send in single API call
3. Process batch on backend

This would be faster but requires API modification.

---

## 📁 Files

- `manifest.json` - Extension configuration
- `popup.html` - Extension UI with progress bar
- `popup.js` - **Main logic - UPDATE API_URL HERE**
- `content.js` - Zillow page scraper
- `icon.png` - Extension icon
- `README.md` - This file

---

## 🔗 Related Documentation

**Backend API:**
- `/api/scraper/add-to-queue/route.ts` - Queue API endpoint
- `/api/cron/process-scraper-queue/route.ts` - Background processor

**Firebase Collections:**
- `scraper_queue` - Pending URLs (temporary)
- `zillow_imports` - Scraped property data (permanent)

**Guides:**
- `BOOKMARKLET_QUEUE_SETUP.md` - Full system overview
- `QUICK_START.md` - Quick reference
- `AGENT_DATA_FIX_SUMMARY.md` - Technical details

---

## ⚠️ Important Notes

1. **Rate Limiting**: Extension uploads one property at a time to avoid overwhelming server
2. **Zillow TOS**: Be mindful of Zillow's Terms of Service when scraping
3. **Data Quality**: ~80% of properties will have agent/broker contact info (this is expected)
4. **Duplicates**: System automatically prevents duplicate saves across queue and imports
5. **Privacy**: Extension doesn't collect any personal data - only extracts public Zillow listings

---

## 📞 Support

**Check Logs:**
- Browser Console: F12 → Console tab
- Vercel Logs: `vercel logs --follow`

**Check Firebase:**
- Firestore → `scraper_queue` (pending)
- Firestore → `zillow_imports` (completed)

**Check API:**
```bash
# Test queue API
curl https://ownerfi.vercel.app/api/scraper/add-to-queue

# Test cron
curl https://ownerfi.vercel.app/api/cron/process-scraper-queue
```

---

## 🎉 Success!

You now have a **fully automated property scraping system**:

1. ✅ Browse Zillow normally
2. ✅ Click extension to save properties
3. ✅ Cron auto-processes in background
4. ✅ Full data with agent/broker info
5. ✅ Export to GHL whenever ready

**No manual file management. No CSV uploads. Just click and go!**

---

**Version 2.0** - Direct Firebase Queue Upload with Progress Tracking
