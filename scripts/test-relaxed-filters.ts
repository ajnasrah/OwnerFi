#!/usr/bin/env npx tsx

import { runSearchScraper } from '../src/lib/scraper-v2/apify-client';

// Test with different filter combinations to see what's available
const MEMPHIS_HIGH_PRIORITY_ZIPS = ['38125', '38116', '38128', '38141'];

const ZILLOW_REGION_IDS = {
  '38125': 74661,
  '38116': 74654, 
  '38128': 74664,
  '38141': 74677,
};

const CITY_STATE_ZIP_MAPPING = {
  '38125': 'memphis-tn-38125',
  '38116': 'memphis-tn-38116',
  '38128': 'memphis-tn-38128', 
  '38141': 'memphis-tn-38141',
};

function buildTestUrl(zip: string, filterLevel: 'none' | 'light' | 'medium' | 'strict'): string {
  const coordinate = {
    '38125': { lat: 35.1495, lng: -89.8467 },
    '38116': { lat: 35.0578, lng: -89.9167 },
    '38128': { lat: 35.2267, lng: -89.8267 },
    '38141': { lat: 35.2267, lng: -89.8067 },
  }[zip];
  
  let filterState: any = {
    sort: { value: "globalrelevanceex" },
  };
  
  // Apply different filter levels
  if (filterLevel === 'strict') {
    // Current strict filters
    filterState = {
      ...filterState,
      price: { min: 0, max: 300000 },
      mp: { min: 0, max: 55000 },
      beds: { min: 2, max: null },
      baths: { min: 1.5, max: null },
      land: { value: false },
      apa: { value: false },
      manu: { value: false },
      hoa: { min: null, max: 200 },
      built: { min: 1970, max: null },
      "55plus": { value: "e" }
    };
  } else if (filterLevel === 'medium') {
    // Medium filters
    filterState = {
      ...filterState,
      price: { min: 0, max: 500000 },
      land: { value: false },
      apa: { value: false },
      manu: { value: false },
    };
  } else if (filterLevel === 'light') {
    // Light filters - just basic property types
    filterState = {
      ...filterState,
      land: { value: false },
      apa: { value: false },
    };
  }
  // 'none' = no filters except sorting
  
  const searchQueryState = {
    isMapVisible: true,
    mapBounds: {
      north: coordinate.lat + 0.08,
      south: coordinate.lat - 0.08,
      east: coordinate.lng + 0.07,
      west: coordinate.lng - 0.07
    },
    usersSearchTerm: zip,
    filterState,
    isListVisible: true,
    mapZoom: 13,
    regionSelection: [{ regionId: ZILLOW_REGION_IDS[zip], regionType: 7 }]
  };
  
  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  return `https://www.zillow.com/${CITY_STATE_ZIP_MAPPING[zip]}/?searchQueryState=${encoded}`;
}

async function testFilterLevels() {
  console.log('TESTING DIFFERENT FILTER LEVELS FOR MEMPHIS HIGH-PRIORITY ZIPS');
  console.log('='.repeat(80));
  
  const filterLevels: Array<'none' | 'light' | 'medium' | 'strict'> = ['none', 'light', 'medium', 'strict'];
  
  for (const level of filterLevels) {
    console.log(`\n=== TESTING ${level.toUpperCase()} FILTERS ===`);
    
    const testUrls = MEMPHIS_HIGH_PRIORITY_ZIPS.map(zip => {
      const url = buildTestUrl(zip, level);
      console.log(`${zip}: Generated URL with ${level} filters`);
      return url;
    });
    
    try {
      console.log(`\nSearching with ${level} filters...`);
      const results = await runSearchScraper(testUrls, {
        maxResults: 100, // Small limit for testing
      });
      
      console.log(`Found ${results.length} properties with ${level} filters`);
      
      // Count by zip
      const zipCounts: Record<string, number> = {};
      results.forEach(property => {
        const zip = (property as any).zipcode || (property as any).addressZipcode;
        if (zip && MEMPHIS_HIGH_PRIORITY_ZIPS.includes(zip)) {
          zipCounts[zip] = (zipCounts[zip] || 0) + 1;
        }
      });
      
      MEMPHIS_HIGH_PRIORITY_ZIPS.forEach(zip => {
        const count = zipCounts[zip] || 0;
        console.log(`  ${zip}: ${count} properties`);
      });
      
    } catch (error) {
      console.log(`Error with ${level} filters:`, error.message);
    }
  }
  
  console.log('\n=== RECOMMENDATIONS ===');
  console.log('Based on results above:');
  console.log('1. Use filter level that gives 10+ properties per zip');
  console.log('2. Apply additional filters in post-processing if needed');
  console.log('3. Update manual search script with optimal filter level');
}

if (require.main === module) {
  testFilterLevels().catch(console.error);
}