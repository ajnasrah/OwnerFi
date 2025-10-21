import * as fs from 'fs';
import * as path from 'path';

interface PropertyData {
  url: string;
  address: string;
  price: string;
  state: string;
  description?: string;
}

/**
 * View and analyze Zillow scraper results
 */
function viewResults() {
  const resultsPath = path.join(process.cwd(), 'scraper-output', 'zillow-scraper-results.json');
  const progressPath = path.join(process.cwd(), 'scraper-output', 'zillow-scraper-progress.json');

  // Check if results file exists
  if (!fs.existsSync(resultsPath)) {
    console.log('❌ No results file found.');
    console.log(`   Expected at: ${resultsPath}`);
    console.log('\n   Run the scraper first:');
    console.log('   npm run scrape-zillow -- --test\n');
    return;
  }

  // Load results
  const resultsContent = fs.readFileSync(resultsPath, 'utf-8');
  const properties: PropertyData[] = JSON.parse(resultsContent);

  console.log('\n📊 Zillow Scraper Results');
  console.log('='.repeat(50));
  console.log(`\nTotal Properties Found: ${properties.length}\n`);

  if (properties.length === 0) {
    console.log('No properties found matching the criteria.\n');
    return;
  }

  // Group by state
  const byState: Record<string, PropertyData[]> = {};
  properties.forEach(prop => {
    if (!byState[prop.state]) {
      byState[prop.state] = [];
    }
    byState[prop.state].push(prop);
  });

  // Display stats by state
  console.log('Properties by State:');
  console.log('-'.repeat(50));
  const sortedStates = Object.entries(byState).sort((a, b) => b[1].length - a[1].length);

  sortedStates.forEach(([state, props]) => {
    console.log(`  ${state.padEnd(20)} ${props.length} properties`);
  });

  // Price analysis
  console.log('\n💰 Price Analysis:');
  console.log('-'.repeat(50));

  const prices = properties
    .map(p => {
      const priceStr = p.price.replace(/[$,]/g, '');
      return parseFloat(priceStr);
    })
    .filter(p => !isNaN(p));

  if (prices.length > 0) {
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    console.log(`  Average Price: $${avgPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    console.log(`  Minimum Price: $${minPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
    console.log(`  Maximum Price: $${maxPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
  }

  // Show sample properties
  console.log('\n🏡 Sample Properties:');
  console.log('-'.repeat(50));

  const sampleSize = Math.min(5, properties.length);
  for (let i = 0; i < sampleSize; i++) {
    const prop = properties[i];
    console.log(`\n${i + 1}. ${prop.address}`);
    console.log(`   Price: ${prop.price}`);
    console.log(`   State: ${prop.state}`);
    console.log(`   URL: ${prop.url}`);
  }

  if (properties.length > sampleSize) {
    console.log(`\n   ... and ${properties.length - sampleSize} more properties`);
  }

  // Output file locations
  console.log('\n📁 Output Files:');
  console.log('-'.repeat(50));
  console.log(`  JSON: ${resultsPath}`);
  console.log(`  CSV:  ${resultsPath.replace('.json', '.csv')}`);

  if (fs.existsSync(progressPath)) {
    console.log(`  Progress: ${progressPath}`);
  }

  console.log('\n');
}

// Run
viewResults();
