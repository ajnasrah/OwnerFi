#!/usr/bin/env npx tsx

// Extract regionIds from working URLs provided by user
const workingUrls = [
  'https://www.zillow.com/memphis-tn-38125/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.11139750863011%2C%22south%22%3A34.946653248745726%2C%22east%22%3A-89.70958322961425%2C%22west%22%3A-89.85429377038574%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3A0%2C%22max%22%3A55000%7D%2C%22beds%22%3A%7B%22min%22%3A2%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1.5%2C%22max%22%3Anull%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2238125%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74661%2C%22regionType%22%3A7%7D%5D%7D',
  'https://www.zillow.com/memphis-tn-38116/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.1178007511397%2C%22south%22%3A34.95306941104457%2C%22east%22%3A-89.93702522961426%2C%22west%22%3A-90.08173577038575%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3A0%2C%22max%22%3A55000%7D%2C%22beds%22%3A%7B%22min%22%3A2%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1.5%2C%22max%22%3Anull%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2238116%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74654%2C%22regionType%22%3A7%7D%5D%7D',
  'https://www.zillow.com/memphis-tn-38141/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.055795027759295%2C%22south%22%3A34.97340832274152%2C%22east%22%3A-89.81803136480711%2C%22west%22%3A-89.89038663519285%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3A0%2C%22max%22%3A55000%7D%2C%22beds%22%3A%7B%22min%22%3A2%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1.5%2C%22max%22%3Anull%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A14%2C%22usersSearchTerm%22%3A%2238141%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74677%2C%22regionType%22%3A7%7D%5D%7D',
  'https://www.zillow.com/memphis-tn-38128/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.3043417089875%2C%22south%22%3A35.13998765673017%2C%22east%22%3A-89.84631422961424%2C%22west%22%3A-89.99102477038572%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3A0%2C%22max%22%3A55000%7D%2C%22beds%22%3A%7B%22min%22%3A2%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1.5%2C%22max%22%3Anull%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A13%2C%22curatedCollection%22%3Anull%2C%22usersSearchTerm%22%3A%2238128%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74664%2C%22regionType%22%3A7%7D%5D%7D'
];

function extractRegionIds() {
  console.log('EXTRACTING REGION IDS FROM WORKING URLs:');
  console.log('='.repeat(60));
  
  const extractedRegions: Record<string, number> = {};
  
  workingUrls.forEach(url => {
    try {
      // Extract the searchQueryState parameter
      const urlObj = new URL(url);
      const searchQueryState = urlObj.searchParams.get('searchQueryState');
      
      if (searchQueryState) {
        const decoded = decodeURIComponent(searchQueryState);
        const parsed = JSON.parse(decoded);
        
        const zip = parsed.usersSearchTerm;
        const regionId = parsed.regionSelection?.[0]?.regionId;
        
        if (zip && regionId) {
          extractedRegions[zip] = regionId;
          console.log(`${zip}: regionId ${regionId}`);
        }
      }
    } catch (error) {
      console.log('Error parsing URL:', error.message);
    }
  });
  
  console.log('\n=== EXTRACTED REGION MAPPING ===');
  console.log('const ZILLOW_REGION_IDS = {');
  Object.entries(extractedRegions).forEach(([zip, regionId]) => {
    console.log(`  '${zip}': ${regionId},`);
  });
  console.log('};');
  
  return extractedRegions;
}

// All zip codes that need regionId mapping (the ones with 0 or low results)
const LOW_RESULT_ZIPS = [
  // Memphis (HIGH PRIORITY)
  '38125', '38116', '38128', '38141',
  // Other zero-result zips
  '30506', '30602', '30606', '30607', '30609', '30677',
  '37919', '37921', '37931', '37934', 
  '43017', '43201', '43202', '43210', '43214', '43240', '43605', '43608',
  '46218', '48221'
];

async function generateRegionIdUrls() {
  const knownRegions = extractRegionIds();
  
  console.log('\n=== ZIP CODES NEEDING REGION ID LOOKUP ===');
  console.log('Found regionIds for:', Object.keys(knownRegions).length, 'zip codes');
  
  const needLookup = LOW_RESULT_ZIPS.filter(zip => !knownRegions[zip]);
  console.log('Still need regionId for:', needLookup.length, 'zip codes');
  console.log(needLookup.join(', '));
  
  console.log('\n=== MANUAL LOOKUP INSTRUCTIONS ===');
  console.log('For each zip code below, visit the URL and extract the regionId:');
  
  needLookup.forEach(zip => {
    const baseUrl = `https://www.zillow.com/homes/${zip}_rb/`;
    console.log(`\n${zip}: ${baseUrl}`);
    console.log('  1. Visit URL');
    console.log('  2. Apply filters: price $0-300k, beds 2+, baths 1.5+');
    console.log('  3. Copy URL and extract regionId from regionSelection parameter');
  });
}

if (require.main === module) {
  generateRegionIdUrls().catch(console.error);
}