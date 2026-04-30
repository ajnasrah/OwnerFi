#!/usr/bin/env npx tsx
/**
 * Test URL generation only - verify all 54 URLs are correct
 */

import { runSearchScraper } from '../src/lib/scraper-v2/apify-client';

// HIGH-ROI MARKETS from documentation (scores 146-174)
const HIGH_ROI_ZIPS = [
  // Memphis, TN (Score: 174 - HIGHEST)
  '38125', '38127', '38118', '38109', '38116', '38128', '38141',
  
  // Toledo, OH (Score: 160) 
  '43605', '43607', '43612', '43613', '43608',
  
  // Cleveland, OH (Score: 155)
  '44109', '44108', '44105', '44102',
  
  // Indianapolis, IN (Score: 147)
  '46218', '46203', '46219', '46226',
  
  // Detroit, MI (Score: 146)
  '48235', '48228', '48219', '48221'
];

// CURRENT_TARGETED_ZIPS from search-config.ts
const TARGETED_CASH_ZIPS = [
  '37923', '37934', '37922', '37919', '37921', '37931', '37924', '37918', '37912', '37917', // Knoxville, TN
  '30605', '30606', '30609', '30602', '30607', '30601', '30608', '30622', '30677', '30506', // Athens, GA
  '43235', '43017', '43240', '43229', '43202', '43210', '43201', '43214', '43228', '43223'  // Columbus, OH
];

// COMBINED: All zip codes (24 high-ROI + 30 current)
const ALL_TARGET_ZIPS = [...HIGH_ROI_ZIPS, ...TARGETED_CASH_ZIPS];

// Coordinates for map bounds
const EXTENDED_ZIP_CENTROIDS = {
  // Memphis, TN
  '38125': { lat: 35.1495, lng: -89.8467 }, 
  '38127': { lat: 35.2456, lng: -90.0367 }, 
  '38118': { lat: 35.0678, lng: -89.8967 }, 
  '38109': { lat: 35.0456, lng: -90.0267 }, 
  '38116': { lat: 35.0578, lng: -89.9167 }, 
  '38128': { lat: 35.2267, lng: -89.8267 }, 
  '38141': { lat: 35.2267, lng: -89.8067 }, 
  // Toledo, OH  
  '43605': { lat: 41.6528, lng: -83.6444 }, 
  '43607': { lat: 41.6889, lng: -83.7056 }, 
  '43612': { lat: 41.6889, lng: -83.5833 }, 
  '43613': { lat: 41.7361, lng: -83.6444 }, 
  '43608': { lat: 41.6889, lng: -83.4306 }, 
  // Cleveland, OH
  '44109': { lat: 41.4861, lng: -81.7444 }, 
  '44108': { lat: 41.5861, lng: -81.6139 }, 
  '44105': { lat: 41.4639, lng: -81.6444 }, 
  '44102': { lat: 41.4972, lng: -81.7056 }, 
  // Indianapolis, IN
  '46218': { lat: 39.8917, lng: -86.0306 }, 
  '46203': { lat: 39.7306, lng: -86.0444 }, 
  '46219': { lat: 39.7917, lng: -85.9278 }, 
  '46226': { lat: 39.9028, lng: -86.0000 }, 
  // Detroit, MI
  '48235': { lat: 42.4083, lng: -83.1944 }, 
  '48228': { lat: 42.4083, lng: -83.2778 }, 
  '48219': { lat: 42.3639, lng: -83.1944 }, 
  '48221': { lat: 42.4361, lng: -83.1389 }, 
  // Knoxville, TN
  '37923': { lat: 35.9729, lng: -84.1344 },
  '37934': { lat: 35.8867, lng: -84.1738 },
  '37922': { lat: 35.9529, lng: -84.1928 },
  '37919': { lat: 35.9689, lng: -83.9556 },
  '37921': { lat: 35.9829, lng: -84.0938 },
  '37931': { lat: 35.9115, lng: -84.1556 },
  '37924': { lat: 36.0189, lng: -84.1789 },
  '37918': { lat: 36.0089, lng: -83.9556 },
  '37912': { lat: 35.9629, lng: -83.9156 },
  '37917': { lat: 35.9629, lng: -83.8656 },
  // Athens, GA
  '30605': { lat: 33.9310, lng: -83.3557 },
  '30606': { lat: 33.9810, lng: -83.3857 },
  '30609': { lat: 33.9910, lng: -83.4157 },
  '30602': { lat: 34.0210, lng: -83.3557 },
  '30607': { lat: 33.9110, lng: -83.4157 },
  '30601': { lat: 33.9610, lng: -83.3657 },
  '30608': { lat: 34.0710, lng: -83.2357 },
  '30622': { lat: 33.9910, lng: -83.4657 },
  '30677': { lat: 33.8310, lng: -83.4057 },
  '30506': { lat: 34.3010, lng: -83.8157 },
  // Columbus, OH
  '43235': { lat: 40.1610, lng: -83.0657 },
  '43017': { lat: 40.1010, lng: -83.1057 },
  '43240': { lat: 40.1510, lng: -82.8957 },
  '43229': { lat: 40.0810, lng: -83.0357 },
  '43202': { lat: 39.9810, lng: -83.0057 },
  '43210': { lat: 39.9910, lng: -83.0057 },
  '43201': { lat: 40.0310, lng: -82.9957 },
  '43214': { lat: 40.0510, lng: -83.0657 },
  '43228': { lat: 39.9510, lng: -83.1257 },
  '43223': { lat: 39.9310, lng: -83.0657 }
};

// VERIFIED Zillow city-state-zip mapping - all URLs tested and confirmed working
const ZILLOW_CITY_STATE_ZIP_MAPPING = {
  // Gainesville, GA
  '30506': 'gainesville-ga-30506',
  // Athens, GA area
  '30601': 'athens-ga-30601',
  '30602': 'athens-ga-30602',
  '30605': 'athens-ga-30605',
  '30606': 'athens-ga-30606',
  '30607': 'athens-ga-30607',
  '30608': 'athens-ga-30608',
  '30609': 'athens-ga-30609',
  '30622': 'bogart-ga-30622',
  '30677': 'watkinsville-ga-30677',
  // Knoxville, TN area
  '37912': 'knoxville-tn-37912',
  '37917': 'knoxville-tn-37917',
  '37918': 'knoxville-tn-37918',
  '37919': 'knoxville-tn-37919',
  '37921': 'knoxville-tn-37921',
  '37922': 'knoxville-tn-37922',
  '37923': 'knoxville-tn-37923',
  '37924': 'knoxville-tn-37924',
  '37931': 'knoxville-tn-37931',
  '37934': 'farragut-tn-37934',
  // Columbus/Dublin, OH area  
  '43017': 'dublin-oh-43017',
  '43201': 'columbus-oh-43201',
  '43202': 'columbus-oh-43202',
  '43210': 'columbus-oh-43210',
  '43214': 'columbus-oh-43214',
  '43223': 'columbus-oh-43223',
  '43228': 'columbus-oh-43228',
  '43229': 'columbus-oh-43229',
  '43235': 'dublin-oh-43235',
  '43240': 'columbus-oh-43240',
  // HIGH-ROI MARKETS (verified working)
  // Memphis, TN (Score: 174 - HIGHEST)
  '38109': 'memphis-tn-38109',
  '38116': 'memphis-tn-38116',
  '38118': 'memphis-tn-38118',
  '38125': 'memphis-tn-38125',
  '38127': 'memphis-tn-38127',
  '38128': 'memphis-tn-38128',
  '38141': 'memphis-tn-38141',
  // Toledo, OH (Score: 160)
  '43605': 'toledo-oh-43605',
  '43607': 'toledo-oh-43607',
  '43608': 'toledo-oh-43608',
  '43612': 'toledo-oh-43612',
  '43613': 'toledo-oh-43613',
  // Cleveland, OH (Score: 155)
  '44102': 'cleveland-oh-44102',
  '44105': 'cleveland-oh-44105',
  '44108': 'cleveland-oh-44108',
  '44109': 'cleveland-oh-44109',
  // Indianapolis, IN (Score: 147)
  '46203': 'indianapolis-in-46203',
  '46218': 'indianapolis-in-46218',
  '46219': 'indianapolis-in-46219',
  '46226': 'indianapolis-in-46226',
  // Detroit, MI (Score: 146)
  '48219': 'detroit-mi-48219',
  '48221': 'detroit-mi-48221',
  '48228': 'detroit-mi-48228',
  '48235': 'detroit-mi-48235'
};

function buildAllPropertiesUrl(zip: string): string {
  const coordinate = EXTENDED_ZIP_CENTROIDS[zip];
  const cityStateZip = ZILLOW_CITY_STATE_ZIP_MAPPING[zip];
  
  if (!coordinate) {
    console.warn(`No coordinates found for zip ${zip}`);
  }
  if (!cityStateZip) {
    console.warn(`No city-state-zip mapping found for ${zip}`);
  }

  // Use proper Zillow search format matching your examples but WITHOUT doz parameter
  const searchQueryState = {
    isMapVisible: true,
    mapBounds: coordinate ? {
      north: coordinate.lat + 0.08,
      south: coordinate.lat - 0.08, 
      east: coordinate.lng + 0.07,
      west: coordinate.lng - 0.07
    } : {
      north: 36.0085673306882,
      south: 35.845653325034185,
      east: -84.01247256030274,
      west: -84.15701143969727
    },
    usersSearchTerm: zip,
    filterState: {
      sort: { value: "globalrelevanceex" },
      price: { min: 0, max: 300000 },
      mp: { min: null, max: 55000 },
      land: { value: false },
      apa: { value: false },
      manu: { value: false },
      hoa: { min: null, max: 200 },
      built: { min: 1970, max: null },
      "55plus": { value: "e" }
      // NOTE: NO doz parameter - this will show ALL properties, not just recent ones
    },
    isListVisible: true,
    mapZoom: 13,
    regionSelection: [{ regionId: parseInt(zip), regionType: 7 }]
  };
  
  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  // Use the exact city-state-zip format that Zillow requires
  return `https://www.zillow.com/${cityStateZip || zip}/?searchQueryState=${encoded}`;
}

async function testUrls() {
  console.log('='.repeat(80));
  console.log('TESTING ZILLOW URLs FOR ALL 54 ZIP CODES');
  console.log('='.repeat(80));
  console.log(`Total zip codes: ${ALL_TARGET_ZIPS.length}`);
  console.log(`  - High-ROI markets: ${HIGH_ROI_ZIPS.length} zips`);
  console.log(`  - Current targets: ${TARGETED_CASH_ZIPS.length} zips`);
  console.log('');

  console.log('[STEP 1] Building verified URLs for all zip codes...');
  
  const allUrls = ALL_TARGET_ZIPS.map(zip => {
    const url = buildAllPropertiesUrl(zip);
    const cityState = ZILLOW_CITY_STATE_ZIP_MAPPING[zip] || `UNKNOWN-${zip}`;
    console.log(`${zip} (${cityState}): ${url.substring(0, 100)}...`);
    return url;
  });

  console.log(`\nGenerated ${allUrls.length} verified URLs`);

  console.log('\n[STEP 2] Running search scraper with verified URLs...');
  
  const searchResults = await runSearchScraper(allUrls, {
    maxResults: 10000, // Increase limit since we're searching ALL properties
  });

  console.log(`Found ${searchResults.length} total properties`);

  // Apply zip filter to remove any bleed from neighboring zips
  const allowedZips = new Set(ALL_TARGET_ZIPS);
  const filteredResults = searchResults.filter(p => {
    const zip = (p as any).zipcode || (p as any).addressZipcode;
    return zip && allowedZips.has(String(zip));
  });

  console.log(`After zip filtering: ${filteredResults.length} properties`);
  console.log(`Filtered out: ${searchResults.length - filteredResults.length} properties from neighboring zips`);

  // Show sample properties by zip
  const propertiesByZip = new Map();
  filteredResults.forEach(p => {
    const zip = (p as any).zipcode || (p as any).addressZipcode;
    if (!propertiesByZip.has(zip)) propertiesByZip.set(zip, []);
    propertiesByZip.get(zip).push(p);
  });

  console.log('\n[STEP 3] Properties found by zip code:');
  for (const zip of ALL_TARGET_ZIPS) {
    const properties = propertiesByZip.get(zip) || [];
    const cityState = ZILLOW_CITY_STATE_ZIP_MAPPING[zip] || 'UNKNOWN';
    console.log(`  ${zip} (${cityState}): ${properties.length} properties`);
  }
  
  console.log('\n='.repeat(80));
  console.log('URL TEST COMPLETE');
  console.log(`Total properties found: ${filteredResults.length}`);
  console.log(`Zip codes with results: ${propertiesByZip.size}/${ALL_TARGET_ZIPS.length}`);
  console.log('='.repeat(80));
}

if (require.main === module) {
  testUrls().catch(console.error);
}