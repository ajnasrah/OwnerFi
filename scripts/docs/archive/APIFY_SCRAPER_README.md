# Apify Zillow Property Details Scraper

Extract complete property details from Zillow URLs using Apify's powerful scraping service.

## What This Does

1. **Reads** Excel or CSV files with Zillow property URLs
2. **Scrapes** full property details using Apify
3. **Exports** results to JSON, Excel, and CSV

## Quick Start

### Step 1: Collect URLs

Use the Chrome Extension to collect property URLs:
1. Search Zillow with your filters (state, price, keywords, etc.)
2. Click extension to download CSV with URLs
3. Repeat for all pages/states you want

### Step 2: Scrape Details

Run the Apify scraper on your URL file:

```bash
npm run scrape-apify scraper-output/zillow-texas-results.csv
```

That's it! The scraper will:
- Read all URLs from your file
- Send them to Apify in batches (50 at a time)
- Save detailed property data to `apify-output/`

## Usage

### Basic Usage

```bash
npm run scrape-apify <file-path>
```

### With Custom Batch Size

```bash
npm run scrape-apify <file-path> <batch-size>
```

### Examples

```bash
# Scrape URLs from CSV file
npm run scrape-apify scraper-output/zillow-texas-results.csv

# Scrape URLs from Excel file
npm run scrape-apify ~/Downloads/properties.xlsx

# Use smaller batches (25 properties at a time)
npm run scrape-apify properties.csv 25

# Use larger batches (100 properties at a time) - faster but may hit rate limits
npm run scrape-apify properties.csv 100
```

## Input File Format

Your Excel or CSV file should have a column with Zillow URLs. These column names work automatically:
- `url`
- `URL`
- `link`
- `Link`
- `property_url`
- `Property URL`

**Example CSV:**
```csv
Address,Price,URL
"123 Main St, Austin, TX","$450,000","https://www.zillow.com/homedetails/..."
"456 Oak Ave, Dallas, TX","$325,000","https://www.zillow.com/homedetails/..."
```

**Example Excel:**
| Address | Price | URL |
|---------|-------|-----|
| 123 Main St, Austin, TX | $450,000 | https://www.zillow.com/homedetails/... |

## Output

Results are saved to `apify-output/` directory:

### 1. JSON File (`zillow-details-complete.json`)
```json
[
  {
    "url": "https://www.zillow.com/homedetails/...",
    "address": "123 Main St, Austin, TX 78701",
    "price": 450000,
    "bedrooms": 3,
    "bathrooms": 2,
    "livingArea": 1850,
    "lotSize": 7200,
    "yearBuilt": 2005,
    "propertyType": "Single Family",
    "description": "Beautiful home with...",
    "images": ["image1.jpg", "image2.jpg", ...]
  }
]
```

### 2. Excel File (`zillow-details-complete.xlsx`)
Spreadsheet with all property details in columns

### 3. CSV File (`zillow-details-complete.csv`)
CSV format for easy import into other tools

### 4. Progress File (`zillow-details-progress.json`)
Auto-saved after each batch - resume if interrupted

## Property Data Extracted

The Apify scraper extracts detailed information:

- **Basic Info**
  - URL
  - Address
  - Price
  - Property Type

- **Details**
  - Bedrooms
  - Bathrooms
  - Living Area (sqft)
  - Lot Size (sqft)
  - Year Built

- **Rich Content**
  - Full description text
  - All property images
  - Additional features
  - And more...

## Batching

Properties are scraped in batches to:
- ✅ Avoid rate limits
- ✅ Save progress incrementally
- ✅ Resume if interrupted
- ✅ Manage Apify costs

**Default batch size: 50 properties**

### Choosing Batch Size

- **Small batches (10-25)**: Slower but safer, good for testing
- **Medium batches (50)**: Balanced - recommended default
- **Large batches (100+)**: Faster but may hit rate limits

## Cost Estimation

Apify pricing is based on compute usage:

- **~$0.25** per 1,000 properties (estimate)
- **Free tier**: Includes some free credits
- **Typical costs**:
  - 100 properties: ~$0.03
  - 1,000 properties: ~$0.25
  - 10,000 properties: ~$2.50

Check [Apify pricing](https://apify.com/pricing) for current rates.

## Performance

- **Speed**: ~100-200 properties per minute
- **Time estimates**:
  - 100 properties: 30 seconds - 1 minute
  - 1,000 properties: 5-10 minutes
  - 10,000 properties: 50-100 minutes

## Complete Workflow Example

**Goal**: Get detailed data for all owner finance properties in Texas

### Step 1: Extract URLs (Chrome Extension)

```
1. Search Zillow: Texas + Owner Finance
2. Click extension on each page
3. Result: zillow-texas-*.csv files with ~1,400 URLs
```

### Step 2: Combine CSV Files (Optional)

```bash
cd ~/Downloads
head -1 zillow-texas-*.csv | head -1 > texas-all-urls.csv
tail -n +2 -q zillow-texas-*.csv >> texas-all-urls.csv
```

### Step 3: Scrape Details with Apify

```bash
npm run scrape-apify ~/Downloads/texas-all-urls.csv
```

### Step 4: Get Results

Check `apify-output/` directory:
- ✅ Full property details
- ✅ Ready to import to database
- ✅ Excel, CSV, and JSON formats

## For Multiple States

Repeat the process for each state:

```bash
# Texas
npm run scrape-apify scraper-output/zillow-texas-results.csv

# California
npm run scrape-apify scraper-output/zillow-california-results.csv

# Florida
npm run scrape-apify scraper-output/zillow-florida-results.csv
```

Or combine all states first, then scrape once:

```bash
npm run scrape-apify all-states-urls.csv
```

## Error Handling

The scraper includes robust error handling:

- ✅ **Auto-retry** on failures
- ✅ **Progress saving** after each batch
- ✅ **Graceful errors** - continues with next batch
- ✅ **Resume capability** - rerun with same file

If scraping is interrupted:
1. Check `apify-output/zillow-details-progress.json`
2. See how many were completed
3. Rerun the command to continue

## Troubleshooting

### "APIFY_API_KEY not found"

Make sure your API key is in `.env.local`:
```bash
APIFY_API_KEY=your_apify_api_key_here
```

### "No property URLs found"

- Check your file has a URL column
- Column should be named: url, URL, link, or property_url
- URLs should contain "zillow.com"

### Scraping is slow

- Increase batch size: `npm run scrape-apify file.csv 100`
- Each batch requires an Apify run which takes time

### Apify credits running low

- Check your Apify dashboard
- Upgrade plan if needed
- Reduce batch size to monitor usage

## Advanced Usage

### Filter Results

After scraping, you can filter in Excel/CSV:
- Filter by price range
- Filter by bedrooms
- Filter by location
- etc.

### Import to Database

The JSON output is ready to import:

```typescript
import results from './apify-output/zillow-details-complete.json';
import { db } from './lib/firebase-admin';

for (const property of results) {
  await db.collection('properties').add({
    ...property,
    source: 'zillow-apify',
    importedAt: new Date(),
  });
}
```

## Files Included

- `apify-zillow-scraper.ts` - Main scraper script
- `APIFY_SCRAPER_README.md` - This file

## Support

For issues:
1. Check Apify dashboard for run status
2. Check `apify-output/zillow-details-progress.json` for partial results
3. Review error messages in console
4. Check Apify actor status at: https://console.apify.com/actors/fdbXYQHBkaccpmRtX

## Next Steps

After getting property details:
1. Import to your database
2. Match with buyer preferences
3. Send notifications
4. Generate property pages
5. Run automated marketing campaigns

Perfect integration with your owner finance platform!
