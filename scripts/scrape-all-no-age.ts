#!/usr/bin/env npx tsx
/**
 * Scrape ALL properties (no age filter) using the same method as production
 */

import * as dotenv from 'dotenv';
import { TARGETED_CASH_ZIPS, ZIP_CENTROIDS } from '../src/lib/scraper-v2/search-config';
import { runApifySearch } from '../src/lib/scraper-v2/apify-client';

dotenv.config({ path: '.env.local' });

// Build URL without days filter
function buildUrlNoAge(zip: string): string {
  const centroid = ZIP_CENTROIDS[zip];
  if (!centroid) throw new Error(`No centroid for ${zip}`);
  
  // City mapping
  const cityPaths: Record<string, string> = {
    // Knoxville
    '37923': 'knoxville-tn', '37934': 'knoxville-tn', '37922': 'knoxville-tn',
    '37919': 'knoxville-tn', '37921': 'knoxville-tn', '37931': 'knoxville-tn',
    '37924': 'knoxville-tn', '37918': 'knoxville-tn', '37912': 'knoxville-tn',
    '37917': 'knoxville-tn',
    // Athens  
    '30605': 'athens-ga', '30606': 'athens-ga', '30609': 'athens-ga',
    '30602': 'athens-ga', '30607': 'athens-ga', '30601': 'athens-ga',
    '30608': 'athens-ga', '30622': 'athens-ga', '30677': 'athens-ga',
    '30506': 'athens-ga',
    // Columbus
    '43235': 'columbus-oh', '43017': 'columbus-oh', '43240': 'columbus-oh',
    '43229': 'columbus-oh', '43202': 'columbus-oh', '43210': 'columbus-oh',
    '43201': 'columbus-oh', '43214': 'columbus-oh', '43228': 'columbus-oh',
    '43223': 'columbus-oh',
  };

  const cityPath = cityPaths[zip];
  
  const searchQueryState = {
    pagination: {},
    isMapVisible: true,
    mapBounds: {
      west: centroid.lng - 0.08,
      east: centroid.lng + 0.08,
      south: centroid.lat - 0.08,
      north: centroid.lat + 0.08
    },
    filterState: {
      sort: { value: "globalrelevanceex" },
      price: { min: 0, max: 300000 },
      mp: { min: null, max: 55000 },
      land: { value: false },
      apa: { value: false },
      manu: { value: false },
      hoa: { max: 200 },
      built: { min: 1970 },
      "55plus": { value: "e" }
      // NO doz parameter
    },
    isListVisible: true,
    usersSearchTerm: zip,
    category: "cat1",
    regionSelection: [{ regionId: parseInt(zip), regionType: 7 }]
  };

  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  return `https://www.zillow.com/${cityPath}-${zip}/?searchQueryState=${encoded}`;
}

async function scrapeAllZips() {
  console.log('🏠 SCRAPING ALL PROPERTIES - NO AGE FILTER\n');
  
  let totalProperties = 0;
  let ownerFinanceCount = 0;
  let cashDealCount = 0;
  
  const results: any[] = [];

  for (let i = 0; i < TARGETED_CASH_ZIPS.length; i++) {
    const zip = TARGETED_CASH_ZIPS[i];
    console.log(`\n[${i+1}/${TARGETED_CASH_ZIPS.length}] Scraping ${zip}...`);
    
    try {
      const url = buildUrlNoAge(zip);
      console.log(`  URL: ${url.substring(0, 80)}...`);
      
      // Use the production scraper function
      const properties = await runApifySearch({
        id: `zip_${zip}_all`,
        name: `All properties in ${zip}`,
        url,
        maxItems: 500
      });
      
      console.log(`  ✅ Found ${properties.length} properties`);
      
      // Quick analysis
      for (const prop of properties) {
        const desc = (prop.description || '').toLowerCase();
        
        // Check owner finance
        if (desc.includes('owner financ') || desc.includes('seller financ') ||
            desc.includes('rent to own') || desc.includes('lease option')) {
          ownerFinanceCount++;
        }
        
        // Check cash deals
        if (prop.price && prop.zestimate && prop.price < prop.zestimate * 0.8) {
          cashDealCount++;
        }
      }
      
      totalProperties += properties.length;
      results.push(...properties.map(p => ({ ...p, searchZip: zip })));
      
      // Small delay
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('COMPLETE');
  console.log('='.repeat(50));
  console.log(`Total Properties: ${totalProperties}`);
  console.log(`Owner Finance: ${ownerFinanceCount}`);
  console.log(`Cash Deals: ${cashDealCount}`);
  
  // Save results
  if (results.length > 0) {
    const fs = await import('fs/promises');
    const filename = `all_properties_${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify({
      scraped: new Date().toISOString(),
      total: totalProperties,
      ownerFinance: ownerFinanceCount,
      cashDeals: cashDealCount,
      properties: results
    }, null, 2));
    console.log(`\nSaved to ${filename}`);
  }
}

scrapeAllZips().catch(console.error);