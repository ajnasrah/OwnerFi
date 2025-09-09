import { ZillowScraper, ZillowSearchCriteria } from './zillow-scraper';

// Test the updated Zillow scraper with correct search parameters
export async function testUpdatedZillowScraper() {

  const scraper = new ZillowScraper();

  // Test criteria matching your requirements
  const testCriteria: ZillowSearchCriteria = {
    location: 'Nashville, TN',  // Start with a specific city for testing
    maxPrice: 700000,
    homeTypes: ['single-family', 'condo', 'townhouse'],
    keywords: 'owner finance'  // This goes in the keyword field from More dropdown
  };


  try {
    
    const result = await scraper.scrapePropertyUrls(testCriteria, 3);

    if (result.success) {
      if (result.propertyUrls.length > 0) {
        
        return {
          success: true,
          urls: result.propertyUrls,
          searchUrl: result.searchUrl,
          count: result.totalFound
        };
      } else {
        
        return {
          success: true,
          urls: [],
          searchUrl: result.searchUrl,
          count: 0
        };
      }
    } else {
      return {
        success: false,
        error: result.error
      };
    }

  } catch (error) {
    console.error('💥 Test error:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// Test the Tennessee state-wide search
export async function testTennesseeUpdated() {

  const scraper = new ZillowScraper();

  const tennesseeCriteria: ZillowSearchCriteria = {
    location: 'Tennessee',
    maxPrice: 700000,
    homeTypes: ['single-family', 'condo', 'townhouse'],
    keywords: 'owner finance'
  };


  try {
    const startTime = Date.now();
    const result = await scraper.scrapePropertyUrls(tennesseeCriteria, 10);
    const duration = Math.round((Date.now() - startTime) / 1000);

    if (result.success) {
      if (result.totalFound > 0) {

        // Save URLs for Apify use
        const fs = await import('fs');
        const timestamp = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
        const filename = `tennessee-owner-finance-${timestamp}.txt`;
        
        await fs.promises.writeFile(filename, result.propertyUrls.join('\n'));
      }

      return result;
    } else {
      return result;
    }

  } catch (error) {
    console.error('💥 Tennessee test error:', error);
    return {
      success: false,
      error: (error as Error).message,
      propertyUrls: [],
      totalFound: 0,
      searchUrl: ''
    };
  }
}

// Show the exact URL that will be generated
export function showSearchUrl() {
  const scraper = new ZillowScraper();
  const criteria: ZillowSearchCriteria = {
    location: 'Tennessee',
    maxPrice: 700000,
    homeTypes: ['single-family', 'condo', 'townhouse'],
    keywords: 'owner finance'
  };

  // Access private method via any cast for testing
  const url = (scraper as any).buildZillowSearchUrl(criteria);
  
}

// Run test if called directly
// Removed module check - use direct function calls instead
// showSearchUrl();
// testUpdatedZillowScraper();