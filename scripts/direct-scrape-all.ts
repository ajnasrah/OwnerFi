#!/usr/bin/env npx tsx
/**
 * Direct Apify scraper - ALL properties without age filter
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ZIPS = [
  // Knoxville, TN
  '37923', '37934', '37922', '37919', '37921', 
  '37931', '37924', '37918', '37912', '37917',
  // Athens, GA  
  '30605', '30606', '30609', '30602', '30607',
  '30601', '30608', '30622', '30677', '30506',
  // Columbus, OH
  '43235', '43017', '43240', '43229', '43202',
  '43210', '43201', '43214', '43228', '43223'
];

async function scrapeWithApify() {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    console.error('❌ APIFY_API_KEY required');
    process.exit(1);
  }

  console.log('🏠 SCRAPING ALL PROPERTIES - NO AGE FILTER\n');
  
  let totalFound = 0;
  const allProperties: any[] = [];

  for (let i = 0; i < ZIPS.length; i++) {
    const zip = ZIPS[i];
    console.log(`\n[${i+1}/${ZIPS.length}] Scraping ${zip}...`);
    
    try {
      // Use simple Zillow URL format that Apify recognizes
      const searchUrl = `https://www.zillow.com/homes/${zip}_rb/`;
      
      // Call Apify API directly
      const response = await fetch(
        `https://api.apify.com/v2/acts/petr_cermak~zillow-api-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=300`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchUrls: [searchUrl],
            maxItemsPerQuery: 500,
            proxyConfiguration: {
              useApifyProxy: true,
              apifyProxyGroups: ['RESIDENTIAL']
            }
          })
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error(`  ❌ Error ${response.status}: ${text.substring(0, 200)}`);
        continue;
      }

      const results = await response.json();
      const properties = Array.isArray(results) ? results : [];
      
      console.log(`  ✅ Found ${properties.length} properties`);
      
      // Filter for 1970+ and price range
      const filtered = properties.filter((p: any) => {
        const yearBuilt = p.yearBuilt || p.year_built;
        const price = p.price || p.unformattedPrice;
        return yearBuilt >= 1970 && price <= 300000 && price > 0;
      });
      
      console.log(`  ✅ After 1970+ filter: ${filtered.length} properties`);
      
      totalFound += filtered.length;
      allProperties.push(...filtered.map(p => ({ ...p, searchZip: zip })));
      
      // Delay to avoid rate limits
      await new Promise(r => setTimeout(r, 3000));
      
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
    }
  }

  // Analysis
  console.log('\n' + '='.repeat(50));
  console.log('RESULTS');
  console.log('='.repeat(50));
  console.log(`Total Properties: ${totalFound}`);
  
  let ownerFinance = 0;
  let cashDeals = 0;
  
  for (const prop of allProperties) {
    const desc = (prop.description || '').toLowerCase();
    if (desc.includes('owner financ') || desc.includes('seller financ') ||
        desc.includes('rent to own') || desc.includes('lease option')) {
      ownerFinance++;
    }
    
    if (prop.price && prop.zestimate && prop.price < prop.zestimate * 0.8) {
      cashDeals++;
    }
  }
  
  console.log(`Owner Finance: ${ownerFinance}`);
  console.log(`Cash Deals: ${cashDeals}`);
  
  // Save results
  if (allProperties.length > 0) {
    const fs = await import('fs/promises');
    const filename = `properties_all_${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify({
      date: new Date().toISOString(),
      total: totalFound,
      ownerFinance,
      cashDeals,
      properties: allProperties
    }, null, 2));
    console.log(`\n✅ Saved to ${filename}`);
  }
}

scrapeWithApify().catch(console.error);