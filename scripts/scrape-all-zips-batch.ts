#!/usr/bin/env npx tsx
/**
 * Batch scraper for all properties in target zip codes
 * Runs searches WITHOUT days-on-market filter to get ALL active listings
 */

import * as dotenv from 'dotenv';
import { TARGETED_CASH_ZIPS, ZIP_CENTROIDS } from '../src/lib/scraper-v2/search-config';

dotenv.config({ path: '.env.local' });

/**
 * Build precise Zillow URL without days filter
 */
function buildZillowUrlNoAge(zip: string): string | null {
  const centroid = ZIP_CENTROIDS[zip];
  if (!centroid) return null;

  // Get city name from zip for URL path
  const cityPaths: Record<string, string> = {
    // Knoxville
    '37923': 'knoxville-tn',
    '37934': 'knoxville-tn',
    '37922': 'knoxville-tn',
    '37919': 'knoxville-tn',
    '37921': 'knoxville-tn',
    '37931': 'knoxville-tn',
    '37924': 'knoxville-tn',
    '37918': 'knoxville-tn',
    '37912': 'knoxville-tn',
    '37917': 'knoxville-tn',
    // Athens
    '30605': 'athens-ga',
    '30606': 'athens-ga',
    '30609': 'athens-ga',
    '30602': 'athens-ga',
    '30607': 'athens-ga',
    '30601': 'athens-ga',
    '30608': 'athens-ga',
    '30622': 'athens-ga',
    '30677': 'athens-ga',
    '30506': 'athens-ga',
    // Columbus
    '43235': 'columbus-oh',
    '43017': 'columbus-oh',
    '43240': 'columbus-oh',
    '43229': 'columbus-oh',
    '43202': 'columbus-oh',
    '43210': 'columbus-oh',
    '43201': 'columbus-oh',
    '43214': 'columbus-oh',
    '43228': 'columbus-oh',
    '43223': 'columbus-oh',
  };

  const cityPath = cityPaths[zip];
  if (!cityPath) return null;

  // Build query WITHOUT doz (days on Zillow) parameter
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
      // NO doz parameter = ALL listings regardless of age
    },
    isListVisible: true,
    usersSearchTerm: zip,
    category: "cat1",
    regionSelection: [{ regionId: parseInt(zip), regionType: 7 }]
  };

  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  return `https://www.zillow.com/${cityPath}-${zip}/?searchQueryState=${encoded}`;
}

async function startApifyRun(url: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/maxcopell~zillow-detail-scraper/runs?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchType: 'url',
          url: url,
          maxItems: 500, // Get ALL properties
          proxy: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL']
          }
        })
      }
    );

    if (!response.ok) {
      console.error(`Apify start error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data.id; // Run ID
  } catch (error) {
    console.error('Failed to start Apify run:', error);
    return null;
  }
}

async function waitForRun(runId: string, apiKey: string): Promise<boolean> {
  const maxWait = 300000; // 5 minutes
  const start = Date.now();
  
  while (Date.now() - start < maxWait) {
    const response = await fetch(
      `https://api.apify.com/v2/acts/maxcopell~zillow-detail-scraper/runs/${runId}?token=${apiKey}`
    );
    
    if (!response.ok) return false;
    
    const data = await response.json();
    const status = data.data.status;
    
    if (status === 'SUCCEEDED') return true;
    if (status === 'FAILED' || status === 'ABORTED') return false;
    
    // Still running, wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  return false; // Timeout
}

async function getRunResults(runId: string, apiKey: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/maxcopell~zillow-detail-scraper/runs/${runId}/dataset/items?token=${apiKey}`
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function runBatchScraper() {
  console.log('🚀 BATCH SCRAPER - ALL PROPERTIES IN TARGET ZIPS\n');
  console.log(`Processing ${TARGETED_CASH_ZIPS.length} zip codes`);
  console.log('NO days-on-market filter - getting ALL active listings\n');

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    console.error('❌ APIFY_API_KEY is required');
    process.exit(1);
  }

  const allResults: any[] = [];
  const runIds: { zip: string; runId: string }[] = [];

  // Start all runs in parallel
  console.log('Starting Apify runs...\n');
  
  for (const zip of TARGETED_CASH_ZIPS) {
    const url = buildZillowUrlNoAge(zip);
    if (!url) {
      console.log(`⚠️ Skipping ${zip} - no city mapping`);
      continue;
    }

    const runId = await startApifyRun(url, apiKey);
    if (runId) {
      runIds.push({ zip, runId });
      console.log(`✅ Started run for ${zip}: ${runId}`);
    } else {
      console.log(`❌ Failed to start ${zip}`);
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n⏳ Waiting for ${runIds.length} runs to complete...\n`);

  // Wait for all runs and collect results
  for (const { zip, runId } of runIds) {
    console.log(`Checking ${zip}...`);
    
    const success = await waitForRun(runId, apiKey);
    if (success) {
      const results = await getRunResults(runId, apiKey);
      console.log(`✅ ${zip}: ${results.length} properties`);
      
      // Add zip to each result
      const withZip = results.map(r => ({ ...r, searchZip: zip }));
      allResults.push(...withZip);
    } else {
      console.log(`❌ ${zip}: Run failed or timed out`);
    }
  }

  // Analyze results
  console.log('\n📊 ANALYSIS\n');
  
  let ownerFinanceCount = 0;
  let cashDealCount = 0;
  const zipStats: Record<string, { total: number; ownerFinance: number; cashDeals: number }> = {};

  for (const property of allResults) {
    const zip = property.searchZip;
    if (!zipStats[zip]) {
      zipStats[zip] = { total: 0, ownerFinance: 0, cashDeals: 0 };
    }
    zipStats[zip].total++;

    // Check owner financing
    const description = (property.description || '').toLowerCase();
    const ownerFinanceKeywords = [
      'owner financ', 'seller financ', 'owner carry', 'seller carry',
      'rent to own', 'lease option', 'owner terms', 'seller terms'
    ];
    
    if (ownerFinanceKeywords.some(k => description.includes(k))) {
      ownerFinanceCount++;
      zipStats[zip].ownerFinance++;
    }

    // Check cash deals
    if (property.price && property.zestimate && property.price < property.zestimate * 0.8) {
      cashDealCount++;
      zipStats[zip].cashDeals++;
    }
  }

  console.log(`Total Properties: ${allResults.length}`);
  console.log(`Owner Finance: ${ownerFinanceCount}`);
  console.log(`Cash Deals: ${cashDealCount}\n`);

  console.log('BY ZIP CODE:');
  for (const [zip, stats] of Object.entries(zipStats).sort()) {
    console.log(`${zip}: ${stats.total} total, ${stats.ownerFinance} OF, ${stats.cashDeals} cash`);
  }

  // Save to file
  if (allResults.length > 0) {
    const fs = await import('fs/promises');
    const filename = `all_properties_${new Date().toISOString().split('T')[0]}.json`;
    
    await fs.writeFile(filename, JSON.stringify({
      metadata: {
        scrapedAt: new Date().toISOString(),
        totalProperties: allResults.length,
        ownerFinanceCount,
        cashDealCount,
        zipCodes: TARGETED_CASH_ZIPS
      },
      properties: allResults
    }, null, 2));
    
    console.log(`\n✅ Saved to ${filename}`);
  }

  console.log('\n✨ Complete!');
}

// Run
runBatchScraper().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});