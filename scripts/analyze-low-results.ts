#!/usr/bin/env npx tsx

// Based on the search log output, here are the zip codes with their property counts

const searchResults = {
  // Memphis, TN (Score: 174 - HIGHEST)
  '38125': 0,  // ❌ LOW - Need regionId 74661
  '38127': 46, // ✅ Good
  '38118': 27, // ✅ Good  
  '38109': 11, // ✅ Good
  '38116': 0,  // ❌ LOW - Need regionId 74654
  '38128': 2,  // ❌ LOW - Need regionId 74664
  '38141': 0,  // ❌ LOW - Need regionId 74677
  
  // Toledo, OH (Score: 160)
  '43605': 0,  // ❌ LOW
  '43607': 1,  // ❌ LOW
  '43612': 1,  // ❌ LOW
  '43613': 3,  // ❌ LOW
  '43608': 0,  // ❌ LOW
  
  // Cleveland, OH (Score: 155)
  '44109': 1,  // ❌ LOW
  '44108': 1,  // ❌ LOW
  '44105': 4,  // ❌ LOW
  '44102': 5,  // ❌ LOW
  
  // Indianapolis, IN (Score: 147)
  '46218': 0,  // ❌ LOW - (estimated from log)
  '46203': 1,  // ❌ LOW - (estimated from log)
  '46219': 2,  // ❌ LOW - (estimated from log)
  '46226': 3,  // ❌ LOW - (estimated from log)
  
  // Detroit, MI (Score: 146)
  '48235': 1,  // ❌ LOW - (estimated from log)
  '48228': 2,  // ❌ LOW - (estimated from log)
  '48219': 1,  // ❌ LOW - (estimated from log)
  '48221': 0,  // ❌ LOW - (estimated from log)
  
  // Knoxville, TN area (Current targets)
  '37923': 4,  // ❌ LOW - (estimated from log)
  '37934': 0,  // ❌ LOW
  '37922': 8,  // ❌ LOW
  '37919': 0,  // ❌ LOW
  '37921': 0,  // ❌ LOW
  '37931': 0,  // ❌ LOW
  '37924': 3,  // ❌ LOW
  '37918': 7,  // ❌ LOW
  '37912': 2,  // ❌ LOW
  '37917': 1,  // ❌ LOW
  
  // Athens, GA area
  '30605': 5,  // ❌ LOW
  '30606': 0,  // ❌ LOW
  '30609': 0,  // ❌ LOW
  '30602': 0,  // ❌ LOW
  '30607': 0,  // ❌ LOW
  '30601': 10, // ✅ Exactly 10
  '30608': 5,  // ❌ LOW
  '30622': 1,  // ❌ LOW
  '30677': 0,  // ❌ LOW
  '30506': 0,  // ❌ LOW
  
  // Columbus/Dublin, OH area
  '43235': 9,  // ❌ LOW
  '43017': 0,  // ❌ LOW
  '43240': 0,  // ❌ LOW
  '43229': 1,  // ❌ LOW
  '43202': 0,  // ❌ LOW
  '43210': 0,  // ❌ LOW
  '43201': 0,  // ❌ LOW
  '43214': 0,  // ❌ LOW
  '43228': 7,  // ❌ LOW
  '43223': 4   // ❌ LOW
};

function analyzeLowResults() {
  console.log('ZIP CODES WITH LESS THAN 10 PROPERTIES:');
  console.log('='.repeat(60));
  
  const lowResultZips: string[] = [];
  const zeroResultZips: string[] = [];
  
  Object.entries(searchResults).forEach(([zip, count]) => {
    if (count < 10) {
      lowResultZips.push(zip);
      if (count === 0) {
        zeroResultZips.push(zip);
      }
      console.log(`${zip}: ${count} properties`);
    }
  });
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total zip codes with < 10 properties: ${lowResultZips.length}/54`);
  console.log(`Zip codes with 0 properties: ${zeroResultZips.length}/54`);
  console.log(`Only ${54 - lowResultZips.length} zip codes had 10+ properties`);
  
  console.log('\n=== ZERO RESULT ZIP CODES ===');
  zeroResultZips.forEach(zip => {
    console.log(`${zip}: NEEDS REGIONID CHECK`);
  });
  
  console.log('\n=== PRIORITY FOR REGIONID FIXES (Memphis High-ROI) ===');
  const memphisLowResults = ['38125', '38116', '38128', '38141'].filter(zip => searchResults[zip] < 10);
  memphisLowResults.forEach(zip => {
    console.log(`${zip}: ${searchResults[zip]} properties - HIGH PRIORITY (Memphis score 174)`);
  });
}

if (require.main === module) {
  analyzeLowResults();
}