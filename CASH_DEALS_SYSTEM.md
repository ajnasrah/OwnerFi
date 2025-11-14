# Cash Deals System Documentation

## Overview
The Cash Deals system is a parallel workflow to the existing Zillow scraper that automatically filters properties priced **under 80% of their Zestimate value**. This helps identify potential cash deal opportunities.

## System Architecture

### 1. Chrome Extension (Updated)
- **Location**: `chrome-extension/`
- **New Button**: "Press for Cash Deals" (green button)
- **Functionality**: Extracts Zillow property URLs and sends them to the cash deals queue

### 2. Firebase Collections

#### `cash_deals_queue` Collection
- Temporary queue for properties to be processed
- Fields:
  - `url`: Zillow property URL
  - `address`: Property address
  - `price`: Listing price
  - `status`: `pending`, `processing`, or `completed`
  - `addedAt`: Timestamp when added
  - `source`: `chrome-extension`

#### `cash_houses` Collection
- Final storage for properties that pass the 80% filter
- Fields include all standard property data plus:
  - `discountPercentage`: How much below Zestimate (e.g., 25.5%)
  - `eightyPercentOfZestimate`: Calculated 80% threshold value
  - All other fields from Apify scraper (address, price, zestimate, beds, baths, etc.)

### 3. API Endpoints

#### `/api/scraper/add-to-cash-queue` (POST)
- Accepts property URLs from Chrome extension
- Checks for duplicates in both queue and final collection
- Triggers immediate processing via cron endpoint
- CORS enabled for Chrome extension

#### `/api/cron/process-cash-deals-queue` (GET)
- Processes pending items from `cash_deals_queue`
- Calls Apify to scrape full property data
- **Applies 80% filter**: Only saves properties where `price < (zestimate * 0.8)`
- Logs detailed info about filtered properties
- Does NOT send to GHL (unlike regular scraper)

### 4. Admin Dashboard

#### Cash Houses Tab
- **Location**: Admin Dashboard → "Cash Houses" tab (💰 icon)
- **Features**:
  - Table view of all cash deal properties
  - Shows: Property image, address, price, Zestimate, discount %
  - Displays 80% threshold for each property
  - Shows property details (beds, baths, sqft)
  - Shows agent phone if available
  - Link to view on Zillow
  - Refresh button to reload data
  - Shows most recent 100 properties

## Workflow

```
1. User navigates to Zillow search results (e.g., Dallas, Memphis listings)
   ↓
2. Clicks "Press for Cash Deals" in Chrome extension
   ↓
3. Extension extracts all property URLs on the page
   ↓
4. URLs sent to /api/scraper/add-to-cash-queue
   ↓
5. Added to cash_deals_queue collection (status: pending)
   ↓
6. API triggers /api/cron/process-cash-deals-queue immediately
   ↓
7. Cron endpoint:
   - Fetches up to 25 pending URLs
   - Marks as processing
   - Calls Apify scraper to get full property data
   ↓
8. For each property scraped:
   - Check if price AND zestimate exist
   - Calculate: price < (zestimate * 0.8)?
   - If YES: Save to cash_houses collection with discount %
   - If NO: Filter out (log to console)
   ↓
9. Queue items marked as completed
   ↓
10. View results in Admin Dashboard → Cash Houses tab
```

## Example Filtering

### Property A (SAVED ✅)
- Price: $180,000
- Zestimate: $250,000
- 80% threshold: $200,000
- Result: $180k < $200k → **SAVED** (28% discount)

### Property B (FILTERED OUT ❌)
- Price: $220,000
- Zestimate: $250,000
- 80% threshold: $200,000
- Result: $220k > $200k → **FILTERED OUT** (only 12% discount)

### Property C (FILTERED OUT ❌)
- Price: $180,000
- Zestimate: null (missing)
- Result: No Zestimate → **FILTERED OUT**

## Usage Instructions

### For Regular Use:
1. Install Chrome extension (load unpacked from `chrome-extension/`)
2. Navigate to Zillow search results for Dallas, Memphis, or any city
3. Click extension icon
4. Click **"Press for Cash Deals"** (green button)
5. Wait for processing to complete
6. Go to Admin Dashboard → Cash Houses tab
7. Review properties that meet the 80% criteria

### For Testing:
1. Test with a small number of properties first
2. Check Firebase Console → `cash_houses` collection
3. Verify discount percentages are calculated correctly
4. Check console logs for filtering decisions

## Key Differences from Regular Scraper

| Feature | Regular Scraper | Cash Deals |
|---------|----------------|------------|
| Queue Collection | `scraper_queue` | `cash_deals_queue` |
| Final Collection | `zillow_imports` | `cash_houses` |
| API Endpoint | `/api/scraper/add-to-queue` | `/api/scraper/add-to-cash-queue` |
| Cron Endpoint | `/api/cron/process-scraper-queue` | `/api/cron/process-cash-deals-queue` |
| Filtering | None | Price < 80% of Zestimate |
| GHL Integration | Yes | No |
| Admin Tab | New Properties (Upload tab) | Cash Houses |
| Button Color | Blue | Green |

## Files Modified/Created

### Chrome Extension:
- ✏️ `chrome-extension/popup.html` - Added green button
- ✏️ `chrome-extension/popup.js` - Added cash deals handler
- ✏️ `chrome-extension/manifest.json` - Updated version to 2.1

### API Endpoints:
- ✨ `src/app/api/scraper/add-to-cash-queue/route.ts` - New queue endpoint
- ✨ `src/app/api/cron/process-cash-deals-queue/route.ts` - New cron processor with 80% filter

### Admin Dashboard:
- ✏️ `src/app/admin/page.tsx` - Added cash-houses tab and UI

### Documentation:
- ✨ `CASH_DEALS_SYSTEM.md` - This file

## Cron Schedule (Optional)

To automatically process the queue periodically, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-cash-deals-queue",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

This runs every 30 minutes, but immediate processing is also triggered when adding to queue.

## Future Enhancements

Possible improvements:
- Export cash houses to CSV
- Email notifications for new cash deals
- Adjustable discount threshold (currently fixed at 80%)
- Additional filters (location, price range, etc.)
- Integration with your own CRM instead of GHL
