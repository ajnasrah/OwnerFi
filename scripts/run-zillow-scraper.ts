import { ZillowScraper } from './zillow-scraper';

/**
 * Run Zillow scraper with custom configuration
 *
 * Usage:
 *   npm run scrape-zillow              # Run for all states
 *   npm run scrape-zillow -- --test    # Test with single state
 *   npm run scrape-zillow -- --states TX,CA,FL  # Specific states
 */

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New-Hampshire', 'New-Jersey', 'New-Mexico', 'New-York',
  'North-Carolina', 'North-Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode-Island', 'South-Carolina', 'South-Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West-Virginia', 'Wisconsin', 'Wyoming'
];

const STATE_ABBREVIATIONS: { [key: string]: string } = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New-Hampshire', 'NJ': 'New-Jersey', 'NM': 'New-Mexico', 'NY': 'New-York',
  'NC': 'North-Carolina', 'ND': 'North-Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode-Island', 'SC': 'South-Carolina',
  'SD': 'South-Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West-Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming'
};

async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  let states = US_STATES;
  let testMode = false;
  let headless = true;
  let maxPrice = 1000000;
  let daysListed = 30;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--test') {
      testMode = true;
      states = ['Texas']; // Test with Texas
      console.log('🧪 Test mode: Running for Texas only');
    } else if (arg === '--visible') {
      headless = false;
      console.log('👁️  Visible mode: Browser will be shown');
    } else if (arg === '--states' && args[i + 1]) {
      const stateInput = args[i + 1].split(',');
      states = stateInput.map(s => {
        const trimmed = s.trim().toUpperCase();
        // Check if it's an abbreviation
        if (STATE_ABBREVIATIONS[trimmed]) {
          return STATE_ABBREVIATIONS[trimmed];
        }
        // Otherwise, try to find the full name
        const found = US_STATES.find(state =>
          state.toLowerCase() === s.trim().toLowerCase()
        );
        return found || s.trim();
      });
      console.log(`🎯 Running for specific states: ${states.join(', ')}`);
      i++; // Skip next arg
    } else if (arg === '--max-price' && args[i + 1]) {
      maxPrice = parseInt(args[i + 1]);
      console.log(`💰 Max price set to: $${maxPrice.toLocaleString()}`);
      i++;
    } else if (arg === '--days' && args[i + 1]) {
      daysListed = parseInt(args[i + 1]);
      console.log(`📅 Days listed: ${daysListed}`);
      i++;
    } else if (arg === '--help') {
      console.log(`
Zillow Owner Finance Scraper
=============================

Usage:
  npm run scrape-zillow [options]

Options:
  --test              Run in test mode (Texas only)
  --visible           Show browser while scraping
  --states STATE1,STATE2  Run for specific states (use abbreviations or full names)
                      Example: --states TX,CA,FL or --states Texas,California
  --max-price PRICE   Set maximum price (default: 1000000)
  --days DAYS         Set days listed filter (default: 30)
  --help              Show this help message

Examples:
  npm run scrape-zillow -- --test
  npm run scrape-zillow -- --states TX,CA,FL
  npm run scrape-zillow -- --max-price 500000 --days 7
  npm run scrape-zillow -- --test --visible
      `);
      process.exit(0);
    }
  }

  console.log('\n🏡 Zillow Owner Finance Property Scraper');
  console.log('========================================\n');

  const scraper = new ZillowScraper({
    maxPrice,
    keywords: ['owner finance', 'owner financing', 'seller financing'],
    daysListed,
    propertyType: 'single-family',
    states,
    headless,
    delayBetweenPages: 3000,
    delayBetweenStates: testMode ? 2000 : 5000,
  });

  try {
    await scraper.scrapeAllStates();

    const results = scraper.getResults();
    console.log('\n📊 Scraping Summary');
    console.log('==================');
    console.log(`Total properties found: ${results.length}`);

    // Group by state
    const byState = results.reduce((acc, prop) => {
      acc[prop.state] = (acc[prop.state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nProperties by State:');
    Object.entries(byState)
      .sort((a, b) => b[1] - a[1])
      .forEach(([state, count]) => {
        console.log(`  ${state}: ${count}`);
      });

    console.log('\n✅ Results saved to:');
    console.log('  - scraper-output/zillow-scraper-results.json');
    console.log('  - scraper-output/zillow-scraper-results.csv');

  } catch (error) {
    console.error('\n❌ Error running scraper:', error);
    process.exit(1);
  }
}

main().catch(console.error);
