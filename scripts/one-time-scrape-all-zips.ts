#!/usr/bin/env npx tsx
/**
 * One-time script to scrape ALL properties in target zip codes
 * WITHOUT days-on-market filter (gets all active listings)
 * 
 * USES IDENTICAL PIPELINE as cron job - just different time filter
 */

import * as dotenv from 'dotenv';
import { TARGETED_ZIP_URLS } from '../src/lib/scraper-v2/search-config';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { runSearchScraper, runDetailScraper, type ScrapedProperty } from '../src/lib/scraper-v2/apify-client';
import {
  runUnifiedFilter,
  logFilterResult,
  calculateFilterStats,
  logFilterStats,
  FilterResult,
} from '../src/lib/scraper-v2/unified-filter';
import {
  transformProperty,
  validateProperty,
  createUnifiedPropertyDoc,
} from '../src/lib/scraper-v2/property-transformer';
import { indexPropertiesBatch } from '../src/lib/typesense/sync';
import { UnifiedProperty } from '../src/lib/unified-property-schema';

dotenv.config({ path: '.env.local' });

/**
 * Remove doz filter from URL to get ALL listings (not just 1-day)
 */
function removeDozFilter(url: string): string {
  // Decode URL, remove doz parameter, re-encode
  const match = url.match(/searchQueryState=([^&]+)/);
  if (!match) return url;
  
  try {
    const decoded = decodeURIComponent(match[1]);
    const queryState = JSON.parse(decoded);
    
    // Remove days on Zillow filter
    if (queryState.filterState && queryState.filterState.doz) {
      delete queryState.filterState.doz;
    }
    
    const newEncoded = encodeURIComponent(JSON.stringify(queryState));
    return url.replace(/searchQueryState=[^&]+/, `searchQueryState=${newEncoded}`);
  } catch (error) {
    console.error('Error removing doz filter:', error);
    return url;
  }
}

async function runOneTimeScrape() {
  console.log('=== ONE-TIME SCRAPER: ALL PROPERTIES IN TARGET ZIPS ===\n');
  console.log('Target URLs:', TARGETED_ZIP_URLS.length);
  console.log('Using IDENTICAL URLs as cron job - just removing doz filter\n');

  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    throw new Error('APIFY_API_KEY is required');
  }

  // Get Firebase
  const { db } = getFirebaseAdmin();

  // Collect properties for Typesense indexing
  const typesenseProperties: UnifiedProperty[] = [];

  const allResults: any[] = [];
  let totalProperties = 0;
  let ownerFinanceCount = 0;
  let cashDealCount = 0;
  let transformSucceeded = 0;
  let transformFailed = 0;
  let validationFailed = 0;
  let duplicatesSkipped = 0;
  let filteredOut = 0;

  // Process each URL from the exact same list as cron job
  for (let i = 0; i < TARGETED_ZIP_URLS.length; i++) {
    const originalUrl = TARGETED_ZIP_URLS[i];
    const url = removeDozFilter(originalUrl); // Remove doz filter to get ALL listings
    
    // Extract zip code for logging
    const zipMatch = url.match(/(\d{5})/);
    const zip = zipMatch ? zipMatch[1] : `URL-${i+1}`;
    
    console.log(`\n[${i + 1}/${TARGETED_ZIP_URLS.length}] Processing ${zip}...`);
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
      
      // Process each property through IDENTICAL pipeline as cron
      let zipOwnerFinance = 0;
      let zipCashDeals = 0;
      
      for (const raw of properties) {
        totalProperties++;

        try {
          // STEP 1: Transform property (identical to cron)
          const property = transformProperty(raw, 'scraper-v2', 'one-time');
          transformSucceeded++;

          // STEP 2: Validate property (identical to cron)
          const validation = validateProperty(property);
          if (!validation.isValid) {
            console.log(`    ❌ Validation failed for ${property.zpid}: ${validation.errors.join(', ')}`);
            validationFailed++;
            continue;
          }

          // STEP 3: Check for duplicates (identical to cron)
          const docId = `zpid_${property.zpid}`;
          const existingDoc = await db.collection('properties').doc(docId).get();
          if (existingDoc.exists) {
            duplicatesSkipped++;
            continue;
          }

          // STEP 4: Run unified filter (identical to cron)
          const filterResult = runUnifiedFilter(
            property,
            property.description || '',
            property.listingRemarks || '',
            property.publicRemarks || ''
          );

          // STEP 5: Check if property passes either filter
          if (!filterResult.passesOwnerfinance && !filterResult.passesCashDeal) {
            filteredOut++;
            continue;
          }

          // STEP 6: Create unified document (identical to cron)
          const docData = createUnifiedPropertyDoc(property, filterResult);

          // STEP 7: Save to Firebase (identical to cron)
          await db.collection('properties').doc(docId).set(docData, { merge: true });

          // Count by type
          if (filterResult.passesOwnerfinance) {
            zipOwnerFinance++;
            ownerFinanceCount++;
          }
          if (filterResult.passesCashDeal) {
            zipCashDeals++;
            cashDealCount++;
          }

          // Add to Typesense batch
          typesenseProperties.push(docData as UnifiedProperty);

          // Add to results
          allResults.push({
            ...docData,
            searchZip: zip,
            scrapedAt: new Date().toISOString(),
            filterResult
          });

        } catch (error) {
          console.error(`    ❌ Error processing property:`, error);
          transformFailed++;
        }
      }
      
      console.log(`  📊 Owner Finance: ${zipOwnerFinance}, Cash Deals: ${zipCashDeals}`);
      console.log(`  📊 Processed: ${transformSucceeded}, Failed: ${transformFailed}, Filtered Out: ${filteredOut}`);

      // Small delay between requests
      if (i < TARGETED_ZIP_URLS.length - 1) {
        console.log('  Waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.error(`  ❌ Error scraping ${zip}:`, error);
    }
  }

  console.log('\n=== SCRAPING COMPLETE ===');
  console.log(`Total properties found: ${totalProperties}`);
  console.log(`Transform succeeded: ${transformSucceeded}`);
  console.log(`Transform failed: ${transformFailed}`);
  console.log(`Validation failed: ${validationFailed}`);
  console.log(`Duplicates skipped: ${duplicatesSkipped}`);
  console.log(`Filtered out: ${filteredOut}`);
  console.log(`Owner finance opportunities: ${ownerFinanceCount}`);
  console.log(`Cash deals (< 80% ARV): ${cashDealCount}`);

  // Index to Typesense if we have properties
  if (typesenseProperties.length > 0) {
    try {
      console.log(`\n[TYPESENSE] Indexing ${typesenseProperties.length} properties...`);
      await indexPropertiesBatch(typesenseProperties);
      console.log('✅ Typesense indexing complete');
    } catch (error) {
      console.error('❌ Typesense indexing failed:', error);
    }
  }

  // Save results to JSON file
  if (allResults.length > 0) {
    console.log('\nSaving results to file...');
    
    const fs = await import('fs/promises');
    const outputFile = `one_time_scrape_${new Date().toISOString().split('T')[0]}.json`;
    
    const output = {
      metadata: {
        scrapedAt: new Date().toISOString(),
        totalProperties: totalProperties,
        transformSucceeded,
        transformFailed,
        validationFailed,
        duplicatesSkipped,
        filteredOut,
        ownerFinanceCount,
        cashDealCount,
        urlsProcessed: TARGETED_ZIP_URLS.length,
        withoutDaysFilter: true,
        usesIdenticalPipeline: true
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