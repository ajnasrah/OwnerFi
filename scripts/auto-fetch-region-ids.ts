#!/usr/bin/env npx tsx

// We'll use direct web requests to get regionIds

// Known regionIds from your working URLs
const KNOWN_REGION_IDS = {
  '38116': 74654,
  '38125': 74661,
  '38128': 74664,
  '38141': 74677,
};

// Zip codes that need regionId lookup (returned 0 or few properties)
const ZERO_RESULT_ZIPS = [
  '30506', '30602', '30606', '30607', '30609', '30677', // Georgia
  '37919', '37921', '37931', '37934', // Tennessee 
  '43017', '43201', '43202', '43210', '43214', '43240', '43605', '43608', // Ohio
  '46218', // Indiana
  '48221'  // Michigan
];

// All zip codes from our target list
const ALL_TARGET_ZIPS = [
  // Memphis, TN (Score: 174 - HIGHEST)
  '38125', '38127', '38118', '38109', '38116', '38128', '38141',
  // Toledo, OH (Score: 160)
  '43605', '43607', '43612', '43613', '43608',
  // Cleveland, OH (Score: 155)
  '44109', '44108', '44105', '44102',
  // Indianapolis, IN (Score: 147)
  '46218', '46203', '46219', '46226',
  // Detroit, MI (Score: 146)
  '48235', '48228', '48219', '48221',
  // Knoxville, TN area (current targets)
  '37923', '37934', '37922', '37919', '37921', '37931', '37924', '37918', '37912', '37917',
  // Athens, GA area
  '30605', '30606', '30609', '30602', '30607', '30601', '30608', '30622', '30677', '30506',
  // Columbus/Dublin, OH area
  '43235', '43017', '43240', '43229', '43202', '43210', '43201', '43214', '43228', '43223'
];

async function fetchRegionIdFromZillow(zip: string): Promise<number | null> {
  try {
    console.log(`Fetching regionId for ${zip}...`);
    
    // Try to fetch from Zillow homes search page
    const zillowUrl = `https://www.zillow.com/homes/${zip}_rb/`;
    
    const result = await WebFetch({
      url: zillowUrl,
      prompt: `Extract the regionId from this Zillow page. Look for any JavaScript variables, data attributes, or JSON objects that contain "regionId" or "region_id" and the number ${zip}. Return just the numeric regionId value, or "NOT_FOUND" if you cannot find it.`
    });
    
    // Try to extract numeric regionId from the response
    const regionIdMatch = result.match(/regionId["\']?\s*:\s*(\d+)/i) || 
                         result.match(/region_id["\']?\s*:\s*(\d+)/i) ||
                         result.match(/"regionId"\s*:\s*(\d+)/i);
    
    if (regionIdMatch) {
      const regionId = parseInt(regionIdMatch[1]);
      console.log(`✅ Found regionId ${regionId} for ${zip}`);
      return regionId;
    }
    
    console.log(`❌ Could not extract regionId for ${zip}`);
    return null;
    
  } catch (error) {
    console.log(`❌ Error fetching regionId for ${zip}:`, error.message);
    return null;
  }
}

async function buildComprehensiveRegionMapping() {
  console.log('BUILDING COMPREHENSIVE REGION ID MAPPING');
  console.log('='.repeat(60));
  console.log(`Total target zip codes: ${ALL_TARGET_ZIPS.length}`);
  console.log(`Known regionIds: ${Object.keys(KNOWN_REGION_IDS).length}`);
  console.log(`Need to fetch: ${ALL_TARGET_ZIPS.filter(zip => !KNOWN_REGION_IDS[zip]).length}`);
  
  const finalMapping = { ...KNOWN_REGION_IDS };
  
  console.log('\nFetching missing regionIds...');
  
  // Focus on the zero-result zips first (highest priority)
  for (const zip of ZERO_RESULT_ZIPS) {
    if (!finalMapping[zip]) {
      const regionId = await fetchRegionIdFromZillow(zip);
      if (regionId) {
        finalMapping[zip] = regionId;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n=== FINAL REGION ID MAPPING ===');
  console.log('const ZILLOW_REGION_IDS = {');
  
  // Sort by zip code for organization
  const sortedEntries = Object.entries(finalMapping).sort(([a], [b]) => a.localeCompare(b));
  
  sortedEntries.forEach(([zip, regionId]) => {
    const status = KNOWN_REGION_IDS[zip] ? 'known' : 'fetched';
    console.log(`  '${zip}': ${regionId}, // ${status}`);
  });
  
  console.log('};');
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total regionIds mapped: ${Object.keys(finalMapping).length}/${ALL_TARGET_ZIPS.length}`);
  
  const stillMissing = ALL_TARGET_ZIPS.filter(zip => !finalMapping[zip]);
  if (stillMissing.length > 0) {
    console.log(`Still missing regionIds for: ${stillMissing.join(', ')}`);
  } else {
    console.log('✅ All zip codes have regionId mappings!');
  }
  
  return finalMapping;
}

if (require.main === module) {
  buildComprehensiveRegionMapping().catch(console.error);
}