# Zillow Owner Finance Scraper

A powerful web scraper built to extract owner-financed property listings from Zillow across all US states.

## Features

- **State-by-State Scraping**: Runs automated searches for all 50 US states
- **Advanced Filtering**:
  - Single-family homes only
  - Maximum price: $1,000,000
  - Listed within last 30 days
  - Keywords: "owner finance", "owner financing", "seller financing"
- **Smart Pagination**: Automatically navigates through multiple pages of results
- **Keyword Matching**: Checks property descriptions for owner finance keywords
- **Multiple Output Formats**: Saves results as both JSON and CSV
- **Progress Tracking**: Saves progress after each state to avoid data loss
- **Rate Limiting**: Built-in delays to avoid detection and rate limiting
- **Error Handling**: Robust retry logic and error recovery

## Installation

The required dependencies are already installed. If you need to reinstall:

```bash
npm install puppeteer
```

## Usage

### Quick Start (Test Mode)

Test the scraper with a single state (Texas) before running the full scrape:

```bash
npm run scrape-zillow -- --test
```

### Run for All States

```bash
npm run scrape-zillow
```

### Run for Specific States

Using state abbreviations:
```bash
npm run scrape-zillow -- --states TX,CA,FL,NY
```

Using full state names:
```bash
npm run scrape-zillow -- --states Texas,California,Florida
```

### Custom Configuration

```bash
# Set custom max price
npm run scrape-zillow -- --max-price 500000

# Set days listed filter
npm run scrape-zillow -- --days 7

# Show browser while scraping (for debugging)
npm run scrape-zillow -- --test --visible

# Combine multiple options
npm run scrape-zillow -- --states TX,CA --max-price 750000 --days 14
```

### Command Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--test` | Run in test mode (Texas only) | `--test` |
| `--visible` | Show browser while scraping | `--visible` |
| `--states` | Comma-separated list of states | `--states TX,CA,FL` |
| `--max-price` | Maximum property price | `--max-price 500000` |
| `--days` | Days since listing | `--days 7` |
| `--help` | Show help message | `--help` |

## Output

The scraper creates a `scraper-output/` directory with the following files:

### JSON Output (`zillow-scraper-results.json`)
```json
[
  {
    "url": "https://www.zillow.com/homedetails/...",
    "address": "123 Main St, Austin, TX 78701",
    "price": "$450,000",
    "state": "Texas",
    "description": "Beautiful home with owner financing available..."
  }
]
```

### CSV Output (`zillow-scraper-results.csv`)
```csv
State,Address,Price,URL
Texas,"123 Main St, Austin, TX 78701","$450,000","https://www.zillow.com/..."
```

### Progress File (`zillow-scraper-progress.json`)
Automatically saved after each state to prevent data loss if the scraper is interrupted.

## How It Works

1. **URL Construction**: Builds Zillow search URLs with appropriate filters for each state
2. **Page Navigation**: Uses Puppeteer to navigate to search results pages
3. **Property Extraction**: Extracts property URLs, addresses, and prices from listing cards
4. **Keyword Filtering**: Visits each property detail page to check description for owner finance keywords
5. **Pagination**: Automatically moves to the next page until no more results are found
6. **Data Storage**: Saves results in both JSON and CSV formats

## Configuration

You can customize the scraper by modifying `scripts/run-zillow-scraper.ts`:

```typescript
const scraper = new ZillowScraper({
  maxPrice: 1000000,              // Maximum property price
  keywords: [                      // Keywords to search for
    'owner finance',
    'owner financing',
    'seller financing'
  ],
  daysListed: 30,                 // Days since listing
  propertyType: 'single-family',  // Property type filter
  states: US_STATES,              // States to search
  headless: true,                 // Run browser in headless mode
  delayBetweenPages: 3000,        // Delay between pages (ms)
  delayBetweenStates: 5000,       // Delay between states (ms)
});
```

## Best Practices

### 1. Start with Test Mode
Always test with a single state first:
```bash
npm run scrape-zillow -- --test
```

### 2. Use Delays
The scraper includes built-in delays to avoid detection. Don't remove these.

### 3. Monitor Progress
Check the `scraper-output/zillow-scraper-progress.json` file to see progress.

### 4. Run During Off-Peak Hours
For large scrapes (all states), run during off-peak hours to reduce load on Zillow's servers.

### 5. Handle Interruptions
If the scraper is interrupted, the progress file contains all data collected so far.

## Troubleshooting

### Browser Launch Fails
If Puppeteer fails to launch the browser:
```bash
# On macOS/Linux
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
npm install puppeteer

# On Windows
set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
npm install puppeteer
```

### No Results Found
- Check if Zillow's HTML structure has changed
- Run with `--visible` flag to see what's happening
- Verify the search URL works in a regular browser

### Rate Limiting
If you get rate limited:
- Increase delays in the configuration
- Run for fewer states at a time
- Use a VPN or proxy (requires additional configuration)

### Timeout Errors
If pages timeout:
- Check your internet connection
- Increase timeout values in `zillow-scraper.ts`
- Run during off-peak hours

## Legal and Ethical Considerations

**Important**: Web scraping may violate Zillow's Terms of Service. This tool is provided for educational purposes only.

- Always review and comply with Zillow's Terms of Service
- Respect rate limits and use appropriate delays
- Don't overload Zillow's servers
- Consider using Zillow's official API if available
- Use scraped data responsibly and ethically

## Advanced Usage

### Programmatic Usage

You can also use the scraper programmatically in your own scripts:

```typescript
import { ZillowScraper } from './scripts/zillow-scraper';

async function customScrape() {
  const scraper = new ZillowScraper({
    maxPrice: 500000,
    states: ['Texas', 'California'],
    headless: true,
  });

  await scraper.scrapeAllStates();
  const results = scraper.getResults();

  // Process results
  console.log(`Found ${results.length} properties`);
}

customScrape();
```

### Integration with Database

You can easily integrate the scraper with your database:

```typescript
import { ZillowScraper } from './scripts/zillow-scraper';
import { db } from './lib/firebase-admin';

async function scrapeAndSave() {
  const scraper = new ZillowScraper({ states: ['Texas'] });
  await scraper.scrapeAllStates();

  const results = scraper.getResults();

  // Save to Firebase
  for (const property of results) {
    await db.collection('properties').add({
      ...property,
      source: 'zillow',
      scrapedAt: new Date(),
    });
  }
}
```

## Performance

- **Speed**: ~10-15 properties per minute (with delays)
- **Memory**: ~200-300 MB RAM usage
- **Time Estimate**:
  - Single state: 10-30 minutes
  - All 50 states: 8-15 hours

## Future Enhancements

Potential improvements:
- Proxy rotation for better reliability
- Captcha handling
- Real-time database integration
- Email notifications when complete
- Duplicate detection
- Price history tracking
- Image downloading

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the Zillow scraper code
3. File an issue in the project repository

## License

This tool is provided as-is for educational purposes. Use at your own risk and ensure compliance with all applicable laws and terms of service.
