#!/usr/bin/env npx tsx
/**
 * Verify correct Zillow city-state-zip format for each target zip code
 * This script tests different city formats to find the correct Zillow URLs
 */

const HIGH_ROI_ZIPS = [
  // Memphis, TN area
  '38125', '38127', '38118', '38109', '38116', '38128', '38141',
  // Toledo, OH area 
  '43605', '43607', '43612', '43613', '43608',
  // Cleveland, OH area
  '44109', '44108', '44105', '44102',
  // Indianapolis, IN area
  '46218', '46203', '46219', '46226',
  // Detroit, MI area
  '48235', '48228', '48219', '48221'
];

// Known working formats from your examples
const KNOWN_WORKING = {
  '37923': 'knoxville-tn-37923',
  '37934': 'farragut-tn-37934', 
  '37922': 'knoxville-tn-37922',
  '37919': 'knoxville-tn-37919',
  '37921': 'knoxville-tn-37921',
  '37931': 'knoxville-tn-37931',
  '37924': 'knoxville-tn-37924',
  '37918': 'knoxville-tn-37918',
  '37912': 'knoxville-tn-37912',
  '37917': 'knoxville-tn-37917',
  '30605': 'athens-ga-30605',
  '30606': 'athens-ga-30606',
  '30609': 'athens-ga-30609',
  '30602': 'athens-ga-30602',
  '30607': 'athens-ga-30607',
  '30601': 'athens-ga-30601',
  '30608': 'athens-ga-30608',
  '30622': 'bogart-ga-30622',
  '30677': 'watkinsville-ga-30677',
  '30506': 'gainesville-ga-30506',
  '43235': 'dublin-oh-43235',
  '43017': 'dublin-oh-43017',
  '43240': 'columbus-oh-43240',
  '43229': 'columbus-oh-43229',
  '43202': 'columbus-oh-43202',
  '43210': 'columbus-oh-43210',
  '43201': 'columbus-oh-43201',
  '43214': 'columbus-oh-43214',
  '43228': 'columbus-oh-43228',
  '43223': 'columbus-oh-43223'
};

async function testZillowURL(zip: string, cityFormat: string): Promise<boolean> {
  try {
    const response = await fetch(`https://www.zillow.com/${cityFormat}/`);
    return response.status === 200;
  } catch {
    return false;
  }
}

async function findCorrectCityFormat(zip: string): Promise<string | null> {
  // Test common patterns
  const state = zip.startsWith('38') ? 'tn' : 
               zip.startsWith('43') ? 'oh' :
               zip.startsWith('44') ? 'oh' :
               zip.startsWith('46') ? 'in' :
               zip.startsWith('48') ? 'mi' : '';

  const possibleCities = [];
  
  if (zip.startsWith('38')) {
    possibleCities.push(`memphis-tn-${zip}`, `cordova-tn-${zip}`, `bartlett-tn-${zip}`);
  } else if (zip.startsWith('43') && ['43605', '43607', '43612', '43613', '43608'].includes(zip)) {
    possibleCities.push(`toledo-oh-${zip}`);
  } else if (zip.startsWith('44')) {
    possibleCities.push(`cleveland-oh-${zip}`);
  } else if (zip.startsWith('46')) {
    possibleCities.push(`indianapolis-in-${zip}`);
  } else if (zip.startsWith('48')) {
    possibleCities.push(`detroit-mi-${zip}`);
  }

  for (const cityFormat of possibleCities) {
    console.log(`Testing ${zip}: ${cityFormat}`);
    const works = await testZillowURL(zip, cityFormat);
    if (works) {
      console.log(`✅ FOUND: ${zip} -> ${cityFormat}`);
      return cityFormat;
    } else {
      console.log(`❌ Failed: ${cityFormat}`);
    }
  }

  console.log(`❓ Could not find working URL for ${zip}`);
  return null;
}

async function main() {
  console.log('Verifying Zillow city-state-zip formats...\n');
  
  console.log('Known working formats:');
  for (const [zip, format] of Object.entries(KNOWN_WORKING)) {
    console.log(`✅ ${zip} -> ${format}`);
  }
  
  console.log('\nTesting high-ROI market zip codes:');
  const results: { [zip: string]: string | null } = {};
  
  for (const zip of HIGH_ROI_ZIPS) {
    const format = await findCorrectCityFormat(zip);
    results[zip] = format;
    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
  }
  
  console.log('\n=== FINAL RESULTS ===');
  console.log('const ZILLOW_CITY_STATE_ZIP_MAPPING = {');
  
  // Output known working ones
  for (const [zip, format] of Object.entries(KNOWN_WORKING)) {
    console.log(`  '${zip}': '${format}',`);
  }
  
  // Output discovered ones
  for (const [zip, format] of Object.entries(results)) {
    if (format) {
      console.log(`  '${zip}': '${format}',`);
    } else {
      console.log(`  // '${zip}': 'UNKNOWN - NEEDS MANUAL LOOKUP',`);
    }
  }
  
  console.log('};');
}

if (require.main === module) {
  main().catch(console.error);
}