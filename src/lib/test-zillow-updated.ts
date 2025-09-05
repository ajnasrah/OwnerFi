import { ZillowScraper, ZillowSearchCriteria } from './zillow-scraper';

// Test the updated Zillow scraper with correct search parameters
export async function testUpdatedZillowScraper() {
  console.log('🔍 Testing Updated Zillow Scraper...\n');
  console.log('✅ Searching for ACTIVE, FOR-SALE properties');
  console.log('🔑 "owner finance" keyword from More dropdown');
  console.log('🏠 Property types: Single Family, Condo, Townhouse\n');

  const scraper = new ZillowScraper();

  // Test criteria matching your requirements
  const testCriteria: ZillowSearchCriteria = {
    location: 'Nashville, TN',  // Start with a specific city for testing
    maxPrice: 700000,
    homeTypes: ['single-family', 'condo', 'townhouse'],
    keywords: 'owner finance'  // This goes in the keyword field from More dropdown
  };

  console.log('📋 Test Search Criteria:');
  console.log(`  📍 Location: ${testCriteria.location}`);
  console.log(`  💰 Max Price: $${testCriteria.maxPrice?.toLocaleString()}`);
  console.log(`  🏠 Home Types: ${testCriteria.homeTypes?.join(', ')}`);
  console.log(`  🔑 Keywords: "${testCriteria.keywords}"`);
  console.log(`  📄 Max Pages: 3\n`);

  try {
    console.log('⏳ Scraping properties...\n');
    
    const result = await scraper.scrapePropertyUrls(testCriteria, 3);

    if (result.success) {
      console.log('✅ Scraping completed successfully!');
      console.log(`🔗 Search URL: ${result.searchUrl}`);
      console.log(`🏠 Total Properties Found: ${result.totalFound}\n`);

      if (result.propertyUrls.length > 0) {
        console.log('📋 Sample Property URLs:');
        result.propertyUrls.slice(0, 5).forEach((url, index) => {
          console.log(`${index + 1}. ${url}`);
        });

        console.log(`\n💡 These URLs are ready for your Apify scraper!`);
        console.log('💡 Each URL follows the format: https://www.zillow.com/homedetails/[address]/[zpid]_zpid/');
        
        return {
          success: true,
          urls: result.propertyUrls,
          searchUrl: result.searchUrl,
          count: result.totalFound
        };
      } else {
        console.log('⚠️  No properties found. This could mean:');
        console.log('   - No properties match your criteria in this location');
        console.log('   - The search parameters need adjustment');
        console.log('   - Zillow\'s HTML structure changed');
        
        return {
          success: true,
          urls: [],
          searchUrl: result.searchUrl,
          count: 0
        };
      }
    } else {
      console.log('❌ Scraping failed:', result.error);
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
  console.log('🏠 Testing Tennessee State-Wide Owner Finance Search...\n');

  const scraper = new ZillowScraper();

  const tennesseeCriteria: ZillowSearchCriteria = {
    location: 'Tennessee',
    maxPrice: 700000,
    homeTypes: ['single-family', 'condo', 'townhouse'],
    keywords: 'owner finance'
  };

  console.log('📋 Tennessee Search:');
  console.log('  📍 Location: Tennessee (entire state)');
  console.log('  💰 Max Price: $700,000');
  console.log('  🏠 Types: Single Family, Condo, Townhouse'); 
  console.log('  🔑 Keywords: "owner finance" (from More dropdown)');
  console.log('  📄 Max Pages: 10\n');

  try {
    const startTime = Date.now();
    const result = await scraper.scrapePropertyUrls(tennesseeCriteria, 10);
    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log(`⏱️  Scraping took ${duration} seconds`);

    if (result.success) {
      console.log('✅ Tennessee scraping completed!');
      console.log(`🔗 Search URL: ${result.searchUrl}`);
      console.log(`🏠 Properties Found: ${result.totalFound}`);

      if (result.totalFound > 0) {
        console.log('\n📋 First 3 Tennessee Properties:');
        result.propertyUrls.slice(0, 3).forEach((url, index) => {
          console.log(`${index + 1}. ${url}`);
        });

        // Save URLs for Apify use
        const fs = require('fs').promises;
        const timestamp = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
        const filename = `tennessee-owner-finance-${timestamp}.txt`;
        
        await fs.writeFile(filename, result.propertyUrls.join('\n'));
        console.log(`\n💾 All URLs saved to: ${filename}`);
        console.log('🚀 Ready for Apify processing!');
      }

      return result;
    } else {
      console.log('❌ Tennessee scraping failed:', result.error);
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
  
  console.log('🔗 Generated Zillow Search URL:');
  console.log(url);
  console.log('\n📝 URL Components:');
  console.log('  - Location: Tennessee');
  console.log('  - Max Price: $700,000');
  console.log('  - Home Types: house,condo,townhouse');
  console.log('  - Keywords: owner%20finance (from More dropdown)');
  console.log('  - Status: Active For Sale properties only');
}

// Run test if called directly
if (require.main === module) {
  console.log('Running Zillow scraper tests...\n');
  showSearchUrl();
  console.log('\n' + '='.repeat(50) + '\n');
  testUpdatedZillowScraper();
}