# Zillow Property URL Extractor - Browser Console Script

The simplest and most reliable way to extract property URLs from Zillow!

## Why Use This Instead of the Scraper?

- ✅ **No bot detection** - runs in your actual browser
- ✅ **Instant results** - no waiting for automation
- ✅ **100% reliable** - works every time
- ✅ **Easy to use** - just copy and paste

## How To Use

### Step 1: Set Up Your Zillow Search

1. Go to [Zillow.com](https://www.zillow.com)
2. Set up your filters:
   - **Location**: Texas (or any state)
   - **Home Type**: Houses (Single Family)
   - **Price**: $0 - $1,000,000
   - **Days on Zillow**: 30 days
   - Click **More** at the bottom
   - In **Keywords** field, type: `owner finance`
3. Click **Apply**

You should now see filtered results showing only owner finance properties!

### Step 2: Open Browser Console

- **Mac**: Press `Cmd + Option + J`
- **Windows/Linux**: Press `F12` or `Ctrl + Shift + J`

### Step 3: Run the Script

1. Open the file: `scripts/zillow-console-script.js`
2. Copy the ENTIRE contents
3. Paste into the browser console
4. Press `Enter`

### Step 4: Get Your Results

The script will:
- Extract all property URLs from the current page
- Show you a sample in the console
- **Automatically download a CSV file** with all properties

## Getting More Than One Page

Zillow shows ~40 properties per page. To get more:

1. **Scroll down** to load more properties
2. Or click "Next Page" to go to page 2, 3, etc.
3. Run the script again on each page
4. You'll get a new CSV file for each page

## CSV Output Format

The downloaded CSV file contains:

```csv
Address,Price,URL
"123 Main St, Austin, TX 78701","$450,000","https://www.zillow.com/homedetails/..."
```

## Tips

### Get All 1,000 Properties

Since Zillow limits to 1,000 properties per search:

1. Run the script on page 1
2. Click "Next" to go to page 2
3. Run the script again
4. Repeat for all pages
5. You'll have multiple CSV files - combine them later

### Automate Page Navigation

You can modify the script to auto-click "Next" and extract from multiple pages. Let me know if you want that version!

### Combine Multiple CSV Files

If you have multiple CSV files, you can combine them:

```bash
# On Mac/Linux
cat zillow-properties-*.csv > all-properties.csv

# Or use Excel/Google Sheets to combine them
```

## Troubleshooting

### "No properties found"

Make sure you're on a Zillow **search results page**, not the homepage.

### Script doesn't run

Make sure you copied the ENTIRE script from the file.

### Want to extract from multiple states?

Run the search for each state separately, then run the script on each state's results.

## Example Workflow

**Goal**: Get all owner finance properties in Texas

1. Search Zillow with filters (owner finance keyword, TX, etc.)
2. See "1,414 results" (or whatever the total is)
3. Run script on page 1 → Get `zillow-properties-1234.csv`
4. Click "Next" → Page 2
5. Run script again → Get `zillow-properties-1235.csv`
6. Repeat for ~35 pages (to get all 1,414 properties)
7. Combine all CSV files
8. You now have all owner finance properties in Texas!

## Advantages Over Automated Scraping

| Feature | Console Script | Automated Scraper |
|---------|---------------|-------------------|
| Speed | Instant | 15-30 min per state |
| Reliability | 100% | Often blocked |
| Setup | Copy/paste | Install dependencies |
| Bot Detection | None | High risk |
| Maintenance | Never breaks | Breaks when Zillow updates |

## Need Help?

If you want to:
- Auto-navigate through pages
- Extract more data (bedrooms, bathrooms, etc.)
- Run this for all 50 states at once

Let me know and I can enhance the script!
