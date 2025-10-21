# Zillow Property URL Extractor - Chrome Extension

Extract property URLs from Zillow with one click!

## Installation Instructions

### Step 1: Load the Extension in Chrome

1. Open Chrome browser
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Navigate to and select this folder: `/Users/abdullahabunasrah/Desktop/ownerfi/chrome-extension/`
6. The extension is now installed!

You should see a house icon in your Chrome toolbar.

## How to Use

### Step 1: Set Up Your Zillow Search

1. Go to [Zillow.com](https://www.zillow.com)
2. Set up your search filters:
   - **Location**: Texas (or any state)
   - **Home Type**: Houses (Single Family)
   - **Price**: $0 - $1,000,000
   - **Days on Zillow**: 30 days
   - Click **More** filters at the bottom
   - In the **Keywords** field, type: `owner finance`
3. Click **Apply**

### Step 2: Extract URLs

1. While on the Zillow search results page
2. Click the **Zillow Property Extractor** extension icon in your toolbar
3. Click **Extract Property URLs** button
4. A CSV file will download automatically!

### Step 3: Get More Properties

Zillow shows ~40 properties per page:

1. Click "Next" to go to page 2
2. Click the extension icon again
3. Extract from page 2
4. Repeat for all pages
5. You'll have multiple CSV files - one per page

## CSV Output

The downloaded CSV contains:

- **Address**: Property street address
- **Price**: Listing price
- **URL**: Direct link to property details

```csv
Address,Price,URL
"123 Main St, Austin, TX 78701","$450,000","https://www.zillow.com/homedetails/..."
```

## Tips

### Extracting All Properties

For example, if Texas has 1,414 properties:
- ~40 properties per page = ~35 pages total
- Click through each page and extract
- Takes ~2-3 minutes to get all properties
- Much faster than automated scraping!

### Running for Multiple States

1. Search Texas → Extract all pages
2. Search California → Extract all pages
3. Search Florida → Extract all pages
4. Etc.

### Combining CSV Files

If you have multiple CSV files, combine them:

**On Mac/Linux:**
```bash
cd ~/Downloads
head -1 zillow-properties-*.csv | head -1 > all-texas-properties.csv
tail -n +2 -q zillow-properties-*.csv >> all-texas-properties.csv
```

**Or use Excel/Google Sheets:**
1. Open first CSV file
2. Copy/paste data from other CSV files below it
3. Save as one combined file

## Troubleshooting

### Extension not showing up

Make sure Developer Mode is enabled in `chrome://extensions/`

### "No properties found" message

Make sure you're on a Zillow **search results page**, not the homepage or a single property page.

### Extension icon not clicking

Try:
1. Refresh the Zillow page
2. Reload the extension in `chrome://extensions/`

### Download not starting

Check your browser's download settings and make sure downloads are not blocked.

## Advantages Over Other Methods

| Method | Speed | Reliability | Ease of Use |
|--------|-------|-------------|-------------|
| Chrome Extension | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Console Script | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Automated Scraper | ⭐ | ⭐ | ⭐⭐ |

## Example Workflow

**Goal**: Get all owner finance properties in all 50 states

1. Install extension (one-time setup)
2. For each state:
   - Go to Zillow
   - Set filters (state, price, days, keyword: "owner finance")
   - Click through all pages, extracting from each
   - Takes ~2-5 minutes per state
3. After 50 states (~2-3 hours total):
   - You have all owner finance properties nationwide
   - All data in CSV format
   - Ready to import into your database

## Files Included

- `manifest.json` - Extension configuration
- `popup.html` - Extension popup UI
- `popup.js` - Popup logic
- `content.js` - Page extraction logic
- `icon.png` - Extension icon
- `README.md` - This file

## Need Help?

If you need to:
- Extract additional property data (beds, baths, sqft, etc.)
- Auto-navigate through pages
- Export to different formats (JSON, Excel, etc.)

Just let me know and I can enhance the extension!

## Privacy & Terms

This extension:
- ✅ Only runs on Zillow.com
- ✅ Doesn't collect any personal data
- ✅ Doesn't send data anywhere
- ✅ Works entirely in your browser
- ⚠️ Please review Zillow's Terms of Service before use
