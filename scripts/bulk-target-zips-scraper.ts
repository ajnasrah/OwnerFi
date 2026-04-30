#!/usr/bin/env npx tsx
/**
 * BULK Target Zips Scraper - Efficient Version
 * 
 * Collects ALL target ZIP URLs into batches for efficient processing
 * Uses IDENTICAL pipeline as cron job with correct filter parameters
 */

import * as dotenv from 'dotenv';
import { TARGETED_ZIP_URLS } from '../src/lib/scraper-v2/search-config';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { runSearchScraper, runDetailScraper, type ScrapedProperty } from '../src/lib/scraper-v2/apify-client';
import {
  runUnifiedFilter,
  logFilterResult,
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
  const match = url.match(/searchQueryState=([^&]+)/);
  if (!match) return url;
  
  try {
    const decoded = decodeURIComponent(match[1]);
    const queryState = JSON.parse(decoded);
    
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

async function runBulkTargetZipsScraper() {
  console.log('=== BULK TARGET ZIPS SCRAPER ===\n');
  console.log(`Processing ${TARGETED_ZIP_URLS.length} target ZIP URLs in efficient batches\n`);

  const { db } = getFirebaseAdmin();
  
  // Metrics
  let totalPropertiesFound = 0;
  let newPropertiesProcessed = 0;
  let ownerFinanceCount = 0;
  let cashDealCount = 0;
  let transformSucceeded = 0;
  let validationFailed = 0;
  let duplicatesSkipped = 0;
  let savedToDatabase = 0;
  
  const typesenseProperties: UnifiedProperty[] = [];
  const allResults: any[] = [];

  try {
    // STEP 1: Prepare all URLs (remove doz filter from each)
    console.log('[STEP 1] Preparing URLs...');
    const processedUrls = TARGETED_ZIP_URLS.map(url => removeDozFilter(url));
    console.log(`✅ Prepared ${processedUrls.length} URLs\n`);

    // STEP 2: Run search scraper on ALL URLs at once (efficient!)
    console.log('[STEP 2] Running bulk search across all target zips...');
    const allSearchResults = await runSearchScraper(processedUrls, {
      maxResults: 200, // 200 per URL, but will be distributed
      mode: 'pagination'
    });
    
    totalPropertiesFound = allSearchResults.length;
    console.log(`✅ Found ${totalPropertiesFound} total properties across all zips\n`);

    if (totalPropertiesFound === 0) {
      console.log('No properties found. Exiting.');
      return;
    }

    // STEP 3: Check duplicates BEFORE detail scraping (save costs)
    console.log('[STEP 3] Checking for duplicates...');
    const newProperties: ScrapedProperty[] = [];
    const existingZpids = new Set<number>();
    
    for (const prop of allSearchResults) {
      const zpid = typeof prop.zpid === 'string' ? parseInt(prop.zpid, 10) : prop.zpid;
      if (!zpid) continue;
      
      const docId = `zpid_${zpid}`;
      const existingDoc = await db.collection('properties').doc(docId).get();
      if (existingDoc.exists) {
        existingZpids.add(zpid);
        duplicatesSkipped++;
      } else {
        newProperties.push(prop);
      }
    }
    
    newPropertiesProcessed = newProperties.length;
    console.log(`✅ Found ${newPropertiesProcessed} new properties (${duplicatesSkipped} duplicates skipped)\n`);

    if (newPropertiesProcessed === 0) {
      console.log('All properties already exist in database. Exiting.');
      return;
    }

    // STEP 4: Get details for NEW properties only (efficient!)
    console.log('[STEP 4] Getting property details for new properties...');
    const propertyUrls = newProperties
      .map((p: any) => p.detailUrl || p.url)
      .filter((url: string) => url && url.includes('zillow.com'));
      
    console.log(`Getting details for ${propertyUrls.length} properties...`);
    
    let detailedProperties: ScrapedProperty[] = [];
    if (propertyUrls.length > 0) {
      try {
        detailedProperties = await runDetailScraper(propertyUrls, { timeoutSecs: 600 });
        console.log(`✅ Got ${detailedProperties.length} detailed properties\n`);
      } catch (detailError: any) {
        console.error(`❌ Detail scraper error: ${detailError}`);
        detailedProperties = newProperties; // Fallback to search results
      }
    }

    // STEP 5: Merge images from search to details
    console.log('[STEP 5] Merging search and detail data...');
    const searchByZpid = new Map();
    for (const prop of allSearchResults) {
      if (prop.zpid) searchByZpid.set(String(prop.zpid), prop);
    }
    
    let imagesMerged = 0;
    for (const prop of detailedProperties) {
      if (!prop.imgSrc && prop.zpid) {
        const searchItem = searchByZpid.get(String(prop.zpid));
        if (searchItem?.imgSrc) {
          prop.imgSrc = searchItem.imgSrc;
          imagesMerged++;
        }
      }
    }
    console.log(`✅ Merged images for ${imagesMerged} properties\n`);
    
    // STEP 6: Process through unified pipeline (IDENTICAL to cron)
    console.log('[STEP 6] Processing through unified pipeline...');
    
    for (const raw of detailedProperties) {
      try {
        // Transform property (identical to cron)
        const property = transformProperty(raw, 'scraper-v2', 'bulk-target-zips');
        transformSucceeded++;

        // Validate property (identical to cron) 
        const validation = validateProperty(property);
        if (!validation.valid) {
          console.log(`    ❌ Validation failed for ${property.zpid}: ${validation.reason}`);
          validationFailed++;
          continue;
        }

        // Run unified filter (IDENTICAL parameters to cron)
        const filterResult = runUnifiedFilter(
          property.description,
          property.price,
          property.estimate,
          property.homeType,
          {
            isAuction: property.isAuction,
            isForeclosure: property.isForeclosure,
            isBankOwned: property.isBankOwned,
          }
        );

        // Log result (identical to cron)
        logFilterResult(property.fullAddress, filterResult, property.price, property.estimate);

        // Skip if no filters passed (identical to cron)
        if (!filterResult.shouldSave) {
          continue;
        }

        // Count by filter type
        if (filterResult.isOwnerfinance) {
          ownerFinanceCount++;
        }
        if (filterResult.isCashDeal) {
          cashDealCount++;
        }

        // Create unified document (identical to cron)
        const docData = createUnifiedPropertyDoc(property, filterResult);

        // Save to Firebase (identical to cron)
        const docId = `zpid_${property.zpid}`;
        await db.collection('properties').doc(docId).set(docData, { merge: true });
        savedToDatabase++;

        // Add to Typesense batch (identical to cron)
        typesenseProperties.push(docData as UnifiedProperty);

        // Add to results
        allResults.push({
          zpid: property.zpid,
          address: property.fullAddress,
          price: property.price,
          estimate: property.estimate,
          ownerFinance: filterResult.isOwnerfinance,
          cashDeal: filterResult.isCashDeal,
          ownerFinanceKeywords: filterResult.ownerFinanceKeywords,
          cashDealReason: filterResult.cashDealReason,
          discountPercentage: filterResult.discountPercentage,
          scrapedAt: new Date().toISOString()
        });

      } catch (error) {
        console.error(`    ❌ Error processing property:`, error);
      }
    }

    console.log(`✅ Pipeline processing complete\n`);

    // STEP 7: Index to Typesense (identical to cron)
    if (typesenseProperties.length > 0) {
      console.log('[STEP 7] Indexing to Typesense...');
      try {
        await indexPropertiesBatch(typesenseProperties);
        console.log(`✅ Indexed ${typesenseProperties.length} properties to Typesense\n`);
      } catch (error) {
        console.error('❌ Typesense indexing failed:', error);
      }
    }

    // STEP 8: Save results to JSON
    if (allResults.length > 0) {
      console.log('[STEP 8] Saving results...');
      const fs = await import('fs/promises');
      const outputFile = `bulk_target_zips_${new Date().toISOString().split('T')[0]}.json`;
      
      const output = {
        metadata: {
          scrapedAt: new Date().toISOString(),
          totalUrlsProcessed: TARGETED_ZIP_URLS.length,
          totalPropertiesFound,
          newPropertiesProcessed,
          duplicatesSkipped,
          transformSucceeded,
          validationFailed,
          savedToDatabase,
          ownerFinanceCount,
          cashDealCount,
          typesenseIndexed: typesenseProperties.length
        },
        properties: allResults
      };
      
      await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
      console.log(`✅ Results saved to ${outputFile}\n`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }

  // Final summary
  console.log('=== BULK SCRAPING COMPLETE ===');
  console.log(`📊 Total Properties Found: ${totalPropertiesFound}`);
  console.log(`📊 New Properties: ${newPropertiesProcessed}`);
  console.log(`📊 Duplicates Skipped: ${duplicatesSkipped}`);
  console.log(`📊 Transform Succeeded: ${transformSucceeded}`);
  console.log(`📊 Validation Failed: ${validationFailed}`);
  console.log(`📊 Saved to Database: ${savedToDatabase}`);
  console.log(`📊 Owner Finance Properties: ${ownerFinanceCount}`);
  console.log(`📊 Cash Deal Properties: ${cashDealCount}`);
  console.log(`📊 Typesense Indexed: ${typesenseProperties.length}`);
  console.log('\n✨ Bulk target zips scraper completed successfully!');
}

// Run the bulk scraper
runBulkTargetZipsScraper().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});