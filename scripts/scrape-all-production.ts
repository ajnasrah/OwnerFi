#!/usr/bin/env npx tsx
/**
 * Scrape ALL properties using production method (no age filter)
 */

import * as dotenv from 'dotenv';
import { ApifyClient } from 'apify-client';
import { TARGETED_CASH_ZIPS, ZIP_CENTROIDS } from '../src/lib/scraper-v2/search-config';

dotenv.config({ path: '.env.local' });

// Use same actor as production
const SEARCH_ACTOR = 'api-ninja/zillow-search-scraper';

function buildSearchUrl(zip: string): string {
  const centroid = ZIP_CENTROIDS[zip];
  if (!centroid) throw new Error(`No centroid for ${zip}`);
  
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

  const cityPath = cityPaths[zip] || 'unknown';
  
  // Build WITHOUT doz (days on zillow) filter
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
      // NO doz parameter = ALL listings
    },
    isListVisible: true,
    usersSearchTerm: zip,
    category: "cat1",
    regionSelection: [{ regionId: parseInt(zip), regionType: 7 }]
  };

  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  return `https://www.zillow.com/${cityPath}-${zip}/?searchQueryState=${encoded}`;
}

async function scrapeAllProperties() {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    console.error('❌ APIFY_API_KEY required');
    process.exit(1);
  }

  const client = new ApifyClient({ token: apiKey });
  
  console.log('🏠 SCRAPING ALL PROPERTIES IN TARGET ZIPS (NO AGE FILTER)\n');
  console.log(`Using actor: ${SEARCH_ACTOR}`);
  console.log(`Zip codes: ${TARGETED_CASH_ZIPS.length}\n`);

  const allResults: any[] = [];
  let totalFound = 0;
  let ownerFinanceCount = 0;
  let cashDealCount = 0;

  // Build all URLs
  const searchUrls = TARGETED_CASH_ZIPS.map(zip => buildSearchUrl(zip));
  
  // api-ninja can handle multiple URLs in one run
  console.log('Starting Apify run with all URLs...\n');
  
  try {
    const input = {
      searchUrls,
      homesPerUrl: 1000, // Get ALL properties per zip
    };

    console.log('Calling Apify...');
    const run = await client.actor(SEARCH_ACTOR).call(input, {
      timeout: 600, // 10 minute timeout
    });
    
    console.log('Run completed, fetching results...');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`\n✅ Total properties found: ${items.length}\n`);

    // Process results by zip
    const byZip: Record<string, number> = {};
    
    for (const item of items) {
      const zip = item.addressZipcode || item.zipcode;
      if (!zip) continue;
      
      byZip[zip] = (byZip[zip] || 0) + 1;
      
      // Check for owner finance
      const desc = (item.description || '').toLowerCase();
      if (desc.includes('owner financ') || desc.includes('seller financ') ||
          desc.includes('rent to own') || desc.includes('lease option')) {
        ownerFinanceCount++;
      }
      
      // Check for cash deals
      const price = item.unformattedPrice || item.price;
      const zestimate = item.zestimate;
      if (price && zestimate && price < zestimate * 0.8) {
        cashDealCount++;
      }
    }
    
    totalFound = items.length;
    allResults.push(...items);
    
    console.log('Properties by zip:');
    for (const [zip, count] of Object.entries(byZip).sort()) {
      console.log(`  ${zip}: ${count}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Properties: ${totalFound}`);
  console.log(`Owner Finance: ${ownerFinanceCount}`);
  console.log(`Cash Deals (< 80% ARV): ${cashDealCount}`);
  
  // Save results
  if (allResults.length > 0) {
    const fs = await import('fs/promises');
    const filename = `all_properties_${new Date().toISOString().split('T')[0]}.json`;
    
    await fs.writeFile(filename, JSON.stringify({
      date: new Date().toISOString(),
      totalProperties: totalFound,
      ownerFinanceCount,
      cashDealCount,
      zipCodes: TARGETED_CASH_ZIPS,
      properties: allResults
    }, null, 2));
    
    console.log(`\n✅ Saved ${totalFound} properties to ${filename}`);
  } else {
    console.log('\n⚠️ No properties found');
  }
}

scrapeAllProperties().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});