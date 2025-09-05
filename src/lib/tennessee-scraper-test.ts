import { scrapeTennesseeOwnerFinance, scrapeStateOwnerFinance } from './zillow-scraper';

// Test function for Tennessee owner finance scraping
export async function testTennesseeScraping() {
  console.log('🏠 Testing Tennessee Owner Finance Property Scraping...\n');

  try {
    console.log('📍 Location: Tennessee');
    console.log('💰 Max Price: $700,000');
    console.log('🏘️  Property Types: Single Family, Condo, Townhouse');
    console.log('🔍 Keywords: "owner finance"');
    console.log('📄 Max Pages: 50\n');

    console.log('⏳ Starting scrape (this may take several minutes)...\n');

    const startTime = Date.now();
    const propertyUrls = await scrapeTennesseeOwnerFinance(700000, 50);
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log('✅ Tennessee scraping completed!');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`🏠 Total Properties Found: ${propertyUrls.length}\n`);

    // Display first 10 URLs as examples
    const displayCount = Math.min(10, propertyUrls.length);
    console.log(`📋 First ${displayCount} Property URLs:`);
    
    propertyUrls.slice(0, displayCount).forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });

    if (propertyUrls.length > displayCount) {
      console.log(`... and ${propertyUrls.length - displayCount} more properties\n`);
    }

    // Save URLs to file for use with Apify
    const fs = require('fs').promises;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `tennessee-owner-finance-urls-${timestamp}.txt`;
    
    await fs.writeFile(filename, propertyUrls.join('\n'), 'utf8');
    console.log(`💾 URLs saved to: ${filename}`);
    console.log('📤 Ready for Apify processing!\n');

    return {
      urls: propertyUrls,
      count: propertyUrls.length,
      duration,
      filename
    };

  } catch (error) {
    console.error('❌ Tennessee scraping failed:', error);
    return null;
  }
}

// Test function for any state owner finance scraping
export async function testStateScraping(state: string = 'Tennessee', maxPrice: number = 700000, maxPages: number = 20) {
  console.log(`🏠 Testing ${state} Owner Finance Property Scraping...\n`);

  try {
    console.log(`📍 Location: ${state}`);
    console.log(`💰 Max Price: $${maxPrice.toLocaleString()}`);
    console.log('🏘️  Property Types: Single Family, Condo, Townhouse');
    console.log('🔍 Keywords: "owner finance"');
    console.log(`📄 Max Pages: ${maxPages}\n`);

    const startTime = Date.now();
    const result = await scrapeStateOwnerFinance(state, maxPrice, maxPages);
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log(`✅ ${state} scraping completed!`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`🏠 Total Properties Found: ${result.totalFound}`);
    console.log(`🔗 Search URL: ${result.searchUrl}\n`);

    // Display first 5 URLs
    const displayCount = Math.min(5, result.allUrls.length);
    console.log(`📋 First ${displayCount} Property URLs:`);
    
    result.allUrls.slice(0, displayCount).forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });

    return result;

  } catch (error) {
    console.error(`❌ ${state} scraping failed:`, error);
    return null;
  }
}

// Test the API endpoint
export async function testTennesseeAPI(baseUrl: string = 'http://localhost:3000') {
  console.log('🧪 Testing Tennessee Scraping API...\n');

  const requestBody = {
    type: 'tennessee',
    maxPrice: 700000,
    maxPages: 5  // Smaller number for testing
  };

  try {
    console.log('📡 Making API request...');
    console.log('📋 Request Body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${baseUrl}/api/scraper/zillow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ API test successful!');
      console.log(`🏠 Found ${data.data.totalFound} properties`);
      console.log(`🔗 Search URL: ${data.data.searchUrl}`);
      
      // Show first 3 URLs
      const urls = data.data.propertyUrls.slice(0, 3);
      console.log('\n📋 Sample URLs:');
      urls.forEach((url: string, index: number) => {
        console.log(`${index + 1}. ${url}`);
      });

      return data;
    } else {
      console.log('❌ API test failed:', data.error || 'Unknown error');
      return null;
    }

  } catch (error) {
    console.error('💥 API test error:', error);
    return null;
  }
}

// Usage examples for different scenarios
export const tennesseScrapingExamples = {
  quickTest: {
    description: 'Quick test with limited pages',
    code: `
// Test with just 5 pages
const result = await testStateScraping('Tennessee', 700000, 5);
    `
  },
  
  fullScrape: {
    description: 'Full Tennessee scrape',
    code: `
// Scrape all Tennessee owner finance properties up to $700K
const urls = await scrapeTennesseeOwnerFinance(700000, 50);
console.log(\`Found \${urls.length} properties\`);
    `
  },

  apiCall: {
    description: 'Using the API for Tennessee',
    code: `
const response = await fetch('/api/scraper/zillow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'tennessee',
    maxPrice: 700000,
    maxPages: 50
  })
});
    `
  },

  otherStates: {
    description: 'Scraping other states',
    code: `
// Texas
const texasUrls = await scrapeStateOwnerFinance('Texas', 700000, 30);

// Florida  
const floridaUrls = await scrapeStateOwnerFinance('Florida', 700000, 40);

// API call for any state
fetch('/api/scraper/zillow', {
  method: 'POST',
  body: JSON.stringify({
    type: 'state',
    state: 'Georgia',
    maxPrice: 600000,
    maxPages: 25
  })
});
    `
  }
};

// Export the test function for easy execution
if (require.main === module) {
  testTennesseeScraping();
}