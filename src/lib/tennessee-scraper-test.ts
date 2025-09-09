import { scrapeTennesseeOwnerFinance, scrapeStateOwnerFinance } from './zillow-scraper';
import { promises as fs } from 'fs';

// Test function for Tennessee owner finance scraping
export async function testTennesseeScraping() {
  try {

    const startTime = Date.now();
    const propertyUrls = await scrapeTennesseeOwnerFinance(700000, 50);
    const endTime = Date.now();
    const _duration = Math.round((endTime - startTime) / 1000);

    // Display first 10 URLs as examples
    const _displayCount = Math.min(10, propertyUrls.length);

    // Save URLs to file for use with Apify
    // Using imported fs promises
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `tennessee-owner-finance-urls-${timestamp}.txt`;
    
    await fs.writeFile(filename, propertyUrls.join('\n'), 'utf8');

    return {
      urls: propertyUrls,
      count: propertyUrls.length,
      duration,
      filename
    };

  } catch (_error) {
    return null;
  }
}

// Test function for any state owner finance scraping
export async function testStateScraping(state: string = 'Tennessee', maxPrice: number = 700000, maxPages: number = 20) {
  try {

    const startTime = Date.now();
    const result = await scrapeStateOwnerFinance(state, maxPrice, maxPages);
    const endTime = Date.now();
    const _duration = Math.round((endTime - startTime) / 1000);

    // Display first 5 URLs
    const _displayCount = Math.min(5, result.allUrls.length);

    return result;

  } catch (_error) {
    return null;
  }
}

// Test the API endpoint
export async function testTennesseeAPI(baseUrl: string = 'http://localhost:3000') {

  const requestBody = {
    type: 'tennessee',
    maxPrice: 700000,
    maxPages: 5  // Smaller number for testing
  };

  try {

    const response = await fetch(`${baseUrl}/api/scraper/zillow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Show first 3 URLs
      const _urls = data.data.propertyUrls.slice(0, 3);

      return data;
    } else {
      return null;
    }

  } catch (_error) {
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