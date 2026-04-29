#!/usr/bin/env npx tsx
/**
 * One-time script to scrape ALL properties in target zip codes
 * WITHOUT days-on-market filter (gets all active listings)
 */

import * as dotenv from 'dotenv';
import { TARGETED_CASH_ZIPS, ZIP_CENTROIDS } from '../src/lib/scraper-v2/search-config';

dotenv.config({ path: '.env.local' });

/**
 * Build search URL for a zip code WITHOUT days-on-market filter
 */
function buildSearchUrlNoDaysFilter(zip: string): string | null {
  const centroid = ZIP_CENTROIDS[zip];
  if (!centroid) {
    console.error(`No coordinates for zip ${zip}`);
    return null;
  }

  // Build search query state - REMOVED doz (days on Zillow) parameter
  const searchQueryState = {
    pagination: {},
    isMapVisible: true,
    mapBounds: {
      west: centroid.lng - 0.05,
      east: centroid.lng + 0.05,
      south: centroid.lat - 0.05,
      north: centroid.lat + 0.05
    },
    usersSearchTerm: zip,
    regionSelection: [
      {
        regionId: parseInt(zip),
        regionType: 7 // 7 = zip code
      }
    ],
    filterState: {
      sortSelection: { value: "globalrelevanceex" },
      price: { min: 0, max: 300000 },
      monthlyPayment: { max: 55000 },
      hoa: { max: 200 },
      built: { min: 1970 }, // 1970+ homes only
      isAllHomes: { value: true },
      isAuction: { value: false },
      isForeclosure: { value: false },
      isManufactured: { value: false },
      is55Plus: { value: false },
      isLotLand: { value: false },
      isApartment: { value: false }
    }
  };

  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  return `https://www.zillow.com/${zip.toLowerCase()}/?searchQueryState=${encoded}`;
}

async function runOneTimeScrape() {
  console.log('=== ONE-TIME SCRAPER: ALL PROPERTIES IN TARGET ZIPS ===\n');
  console.log('Target zip codes:', TARGETED_CASH_ZIPS.length);
  console.log('Removing days-on-market filter to get ALL active listings\n');

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    throw new Error('APIFY_API_KEY is required');
  }

  const allResults: any[] = [];
  let totalProperties = 0;
  let ownerFinanceCount = 0;
  let cashDealCount = 0;

  // Process each zip code
  for (let i = 0; i < TARGETED_CASH_ZIPS.length; i++) {
    const zip = TARGETED_CASH_ZIPS[i];
    console.log(`\n[${i + 1}/${TARGETED_CASH_ZIPS.length}] Processing ${zip}...`);

    const url = buildSearchUrlNoDaysFilter(zip);
    if (!url) {
      console.error(`  ⚠️ Skipping ${zip} - no coordinates`);
      continue;
    }

    console.log(`  URL: ${url.substring(0, 100)}...`);

    try {
      // Run Apify scraper with correct input format
      const response = await fetch(
        `https://api.apify.com/v2/acts/maxcopell~zillow-detail-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=120`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchType: 'url',
            url: url,
            maxItems: 200, // Get more results per zip
            proxy: {
              useApifyProxy: true,
              apifyProxyGroups: ['RESIDENTIAL']
            }
          })
        }
      );

      if (!response.ok) {
        console.error(`  ❌ Apify error: ${response.status}`);
        continue;
      }

      const results = await response.json();
      const properties = Array.isArray(results) ? results : [];
      
      console.log(`  ✅ Found ${properties.length} properties`);
      
      // Quick analysis
      let zipOwnerFinance = 0;
      let zipCashDeals = 0;
      
      for (const property of properties) {
        // Check for owner financing keywords
        const description = property.description || '';
        const ownerFinanceKeywords = [
          'owner financ', 'seller financ', 'owner carry', 'seller carry',
          'rent to own', 'lease option', 'owner terms', 'seller terms'
        ];
        
        const hasOwnerFinance = ownerFinanceKeywords.some(keyword => 
          description.toLowerCase().includes(keyword)
        );
        
        if (hasOwnerFinance) {
          zipOwnerFinance++;
          ownerFinanceCount++;
        }
        
        // Check for cash deals (< 80% zestimate)
        const price = property.price;
        const zestimate = property.zestimate;
        if (price && zestimate && price < zestimate * 0.8) {
          zipCashDeals++;
          cashDealCount++;
        }
      }
      
      console.log(`  📊 Owner Finance: ${zipOwnerFinance}, Cash Deals: ${zipCashDeals}`);
      
      totalProperties += properties.length;
      allResults.push(...properties.map(p => ({
        ...p,
        searchZip: zip,
        scrapedAt: new Date().toISOString()
      })));

      // Small delay between requests
      if (i < TARGETED_CASH_ZIPS.length - 1) {
        console.log('  Waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.error(`  ❌ Error scraping ${zip}:`, error);
    }
  }

  console.log('\n=== SCRAPING COMPLETE ===');
  console.log(`Total properties found: ${totalProperties}`);
  console.log(`Owner finance opportunities: ${ownerFinanceCount}`);
  console.log(`Cash deals (< 80% ARV): ${cashDealCount}`);

  // Save results to JSON file
  if (allResults.length > 0) {
    console.log('\nSaving results to file...');
    
    const fs = await import('fs/promises');
    const outputFile = `one_time_scrape_${new Date().toISOString().split('T')[0]}.json`;
    
    const output = {
      metadata: {
        scrapedAt: new Date().toISOString(),
        totalProperties: totalProperties,
        ownerFinanceCount,
        cashDealCount,
        zipCodes: TARGETED_CASH_ZIPS,
        withoutDaysFilter: true
      },
      properties: allResults
    };
    
    await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
    console.log(`✅ Results saved to ${outputFile}`);
  }

  // Generate summary report
  console.log('\n=== SUMMARY REPORT ===');
  console.log('Zip Code Breakdown:');
  
  const zipSummary: Record<string, number> = {};
  for (const result of allResults) {
    zipSummary[result.searchZip] = (zipSummary[result.searchZip] || 0) + 1;
  }
  
  for (const [zip, count] of Object.entries(zipSummary).sort()) {
    console.log(`  ${zip}: ${count} properties`);
  }
  
  console.log('\n✨ Script complete!');
}

// Run the script
runOneTimeScrape().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});