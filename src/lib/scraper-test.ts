import { createScraper, SearchCriteria } from './property-scraper';

// Example function to test the scraper
export async function testPropertyScraper() {

  // Example search criteria
  const searchCriteria: SearchCriteria = {
    location: 'Austin, TX',
    minPrice: 200000,
    maxPrice: 500000,
    bedrooms: 3,
    bathrooms: 2,
    propertyType: 'single-family-home',
    sortBy: 'price-low'
  };

  try {
    // Test with Realtor.com (you can change this to other supported sites)
    const scraper = createScraper('realtor.com');
    

    const result = await scraper.scrapeProperties(searchCriteria, 2);

    if (result.success) {
      // Display first 5 properties
      const displayCount = Math.min(5, result.properties.length);

      return result;
    } else {
      return null;
    }

  } catch (error) {
    return null;
  }
}

// Function to test the API endpoint
export async function testScrapingAPI(baseUrl: string = 'http://localhost:3000') {

  const requestBody = {
    website: 'realtor.com',
    criteria: {
      location: 'Dallas, TX',
      minPrice: 150000,
      maxPrice: 400000,
      bedrooms: 2,
      bathrooms: 1,
    },
    maxPages: 1
  };

  try {
    const response = await fetch(`${baseUrl}/api/scraper/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Show first 3 URLs
      const urls = data.data.properties.slice(0, 3).map((p: any) => p.url);

      return data;
    } else {
      return null;
    }

  } catch (error) {
    console.error('💥 API test error:', error);
    return null;
  }
}

// Usage examples
export const usageExamples = {
  basic: {
    description: 'Basic scraping with minimal criteria',
    code: `
const scraper = createScraper('realtor.com');
const result = await scraper.scrapeProperties({
  location: 'Austin, TX',
  maxPrice: 300000
}, 1);
    `
  },
  
  detailed: {
    description: 'Detailed search with multiple criteria',
    code: `
const scraper = createScraper('zillow.com');
const result = await scraper.scrapeProperties({
  location: 'Miami, FL',
  minPrice: 250000,
  maxPrice: 600000,
  bedrooms: 3,
  bathrooms: 2,
  propertyType: 'houses',
  sortBy: 'price_asc'
}, 3);
    `
  },

  apiCall: {
    description: 'Using the API endpoint',
    code: `
const response = await fetch('/api/scraper/properties', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    website: 'redfin.com',
    criteria: {
      location: 'Seattle, WA',
      minPrice: 400000,
      bedrooms: 2
    },
    maxPages: 2
  })
});
    `
  }
};

// Export the test function for easy execution
if (require.main === module) {
  testPropertyScraper();
}