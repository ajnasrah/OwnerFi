#!/usr/bin/env npx tsx
/**
 * Generate all Zillow URLs for manual testing
 * Creates URLs for all 54 zip codes without running the full scraper
 */

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

// CURRENT_TARGETED_ZIPS: 30 zip codes from current configuration
const CURRENT_TARGETED_ZIPS = [
  '32225', '32117', '32218', '32246', // Jacksonville, FL
  '73505', '73401', '73507', '73703', // Lawton, OK
  '76104', '76105', '76119', '76134', // Fort Worth, TX
  '30906', '30909', '30815', '30906', // Augusta, GA
  '36116', '36117', '36108', '36105', // Montgomery, AL
  '63137', '63114', '63121', '63134', // St. Louis, MO
  '39503', '39501', '39507', '39532', // Gulfport, MS
  '28269', '28216', '28205', '28208'  // Charlotte, NC
];

// COMBINED: All 54 zip codes (24 high-ROI + 30 current)
const ALL_TARGET_ZIPS = [...HIGH_ROI_ZIPS, ...CURRENT_TARGETED_ZIPS];

/**
 * Build Zillow search URL for a zip code WITHOUT doz filter (shows ALL properties)
 */
function buildAllPropertiesUrl(zip: string): string {
  const searchQueryState = {
    isMapVisible: true,
    mapBounds: {
      north: 90,  // Wide bounds to capture all properties in zip
      south: -90,
      east: 180,
      west: -180
    },
    mapZoom: 13,
    filterState: {
      sort: { value: "globalrelevanceex" },
      price: { min: 0, max: 300000 },
      mp: { min: null, max: 55000 },
      land: { value: false },
      apa: { value: false },
      manu: { value: false },
      hoa: { max: 200 },
      built: { min: 1970 },
      "55plus": { value: "e" },
      // NOTE: NO doz parameter - this will show ALL properties, not just recent ones
    },
    isListVisible: true,
    usersSearchTerm: zip,
    category: "cat1",
    regionSelection: [{ regionId: parseInt(zip), regionType: 7 }]
  };
  
  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  return `https://www.zillow.com/homes/${zip}_rb/?searchQueryState=${encoded}`;
}

function main() {
  console.log('='.repeat(80));
  console.log('ZILLOW URLs FOR ALL 54 ZIP CODES (NO DAYS FILTER)');
  console.log('='.repeat(80));
  console.log(`Total zip codes: ${ALL_TARGET_ZIPS.length}`);
  console.log(`  - High-ROI markets: ${HIGH_ROI_ZIPS.length} zips (scores 146-174)`);
  console.log(`  - Current targets: ${CURRENT_TARGETED_ZIPS.length} zips`);
  console.log('');
  
  console.log('HIGH-ROI MARKETS:');
  console.log('');
  
  // Group high-ROI zips by city
  const cities = {
    'Memphis, TN (174)': ['38125', '38127', '38118', '38109', '38116', '38128', '38141'],
    'Toledo, OH (160)': ['43605', '43607', '43612', '43613', '43608'],
    'Cleveland, OH (155)': ['44109', '44108', '44105', '44102'],
    'Indianapolis, IN (147)': ['46218', '46203', '46219', '46226'],
    'Detroit, MI (146)': ['48235', '48228', '48219', '48221']
  };
  
  for (const [cityName, zips] of Object.entries(cities)) {
    console.log(`## ${cityName}`);
    for (const zip of zips) {
      const url = buildAllPropertiesUrl(zip);
      console.log(`${zip}: ${url}`);
    }
    console.log('');
  }
  
  console.log('CURRENT TARGETED ZIPS:');
  console.log('');
  
  for (const zip of CURRENT_TARGETED_ZIPS) {
    const url = buildAllPropertiesUrl(zip);
    console.log(`${zip}: ${url}`);
  }
  
  console.log('');
  console.log('='.repeat(80));
  console.log('SUMMARY:');
  console.log(`- Generated ${ALL_TARGET_ZIPS.length} URLs total`);
  console.log('- All URLs include filters: $0-300k, built 1970+, no land/apartments/manufactured, max $200 HOA');
  console.log('- NO days-on-market filter (will show ALL active properties)');
  console.log('- Ready for manual testing or scraper integration');
  console.log('='.repeat(80));
}

if (require.main === module) {
  main();
}

export { ALL_TARGET_ZIPS, HIGH_ROI_ZIPS, CURRENT_TARGETED_ZIPS, buildAllPropertiesUrl };