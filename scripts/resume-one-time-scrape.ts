#!/usr/bin/env npx tsx
/**
 * RESUME One-time script to scrape remaining empty zip codes
 * 
 * This script continues where the previous one-time script left off
 * by focusing only on zip codes with 0 properties currently
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

/**
 * Check if zip code needs processing (has 0 properties)
 */
async function checkZipNeedsProcessing(db: any, zipCode: string): Promise<boolean> {
  try {
    const snapshot = await db.collection('properties')
      .where('zipCode', '==', zipCode)
      .count()
      .get();
    
    return snapshot.data().count === 0;
  } catch (error) {
    console.error(`Error checking zip ${zipCode}:`, error);
    return true; // Process on error to be safe
  }
}

async function resumeOneTimeScrape() {
  console.log('=== RESUME ONE-TIME SCRAPER: EMPTY ZIP CODES ONLY ===\n');
  
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    throw new Error('APIFY_API_KEY is required');
  }

  const { db } = getFirebaseAdmin();

  // First, identify empty zip codes
  console.log('Identifying empty zip codes...');
  const emptyZipUrls: { url: string; zip: string }[] = [];
  
  for (const url of TARGETED_ZIP_URLS) {
    const zipMatch = url.match(/(\d{5})/);
    const zip = zipMatch ? zipMatch[1] : null;
    
    if (!zip) {
      console.log(`❌ Could not extract zip from URL: ${url.substring(0, 50)}...`);
      continue;
    }
    
    const needsProcessing = await checkZipNeedsProcessing(db, zip);
    if (needsProcessing) {
      emptyZipUrls.push({ url, zip });
      console.log(`✅ ${zip} - EMPTY (will process)`);
    } else {
      console.log(`⏭️  ${zip} - HAS DATA (skipping)`);
    }
  }
  
  console.log(`\nFound ${emptyZipUrls.length} empty zip codes to process`);
  console.log(`Skipped ${TARGETED_ZIP_URLS.length - emptyZipUrls.length} zip codes that already have data`);
  
  if (emptyZipUrls.length === 0) {
    console.log('🎉 All zip codes already have data! No work to do.');
    return;
  }

  // Process empty zip codes
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

  for (let i = 0; i < emptyZipUrls.length; i++) {
    const { url: originalUrl, zip } = emptyZipUrls[i];
    const url = removeDozFilter(originalUrl);
    
    console.log(`\n[${i + 1}/${emptyZipUrls.length}] Processing ${zip}...`);
    console.log(`  URL: ${url.substring(0, 100)}...`);

    try {
      // STEP 1: Get basic property list
      const searchResults = await runSearchScraper([url], {
        maxResults: 300, // Increase for empty zips
        mode: 'pagination'
      });
      
      console.log(`  ✅ Found ${searchResults.length} search results`);
      
      if (searchResults.length === 0) {
        console.log(`  📭 No properties found for ${zip}`);
        continue;
      }

      // STEP 2: Check for duplicates
      const newProperties = [];
      const existingZpids = new Set();
      
      for (const prop of searchResults) {
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
      
      console.log(`  🆕 New properties to process: ${newProperties.length} (${existingZpids.size} duplicates skipped)`);
      
      if (newProperties.length === 0) {
        console.log(`  ℹ️  All properties already exist for ${zip}`);
        continue;
      }

      // STEP 3: Get full property details
      const propertyUrls = newProperties
        .map((p: any) => p.detailUrl || p.url)
        .filter((url: string) => url && url.includes('zillow.com'));
        
      console.log(`  📋 Getting details for ${propertyUrls.length} new properties...`);
      
      let detailedProperties: ScrapedProperty[] = [];
      if (propertyUrls.length > 0) {
        try {
          detailedProperties = await runDetailScraper(propertyUrls, { timeoutSecs: 300 });
          console.log(`  ✅ Got ${detailedProperties.length} detailed properties`);
        } catch (detailError: any) {
          console.error(`  ❌ Detail scraper error: ${detailError.message}`);
          detailedProperties = newProperties;
        }
      }

      // STEP 4: Merge images from search to details
      const searchByZpid = new Map();
      for (const prop of searchResults) {
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
      console.log(`  🖼️  Merged images for ${imagesMerged} properties`);
      
      // STEP 5: Process each property
      let zipOwnerFinance = 0;
      let zipCashDeals = 0;
      
      for (const raw of detailedProperties) {
        totalProperties++;

        try {
          const property = transformProperty(raw, 'scraper-v2', 'resume-one-time');
          transformSucceeded++;

          const validation = validateProperty(property);
          if (!validation.valid) {
            console.log(`    ❌ Validation failed for ${property.zpid}: ${validation.reason}`);
            validationFailed++;
            continue;
          }

          const docId = `zpid_${property.zpid}`;
          const existingDoc = await db.collection('properties').doc(docId).get();
          if (existingDoc.exists) {
            duplicatesSkipped++;
            continue;
          }

          const filterResult = runUnifiedFilter(
            property,
            property.description || '',
            property.listingRemarks || '',
            property.publicRemarks || ''
          );

          if (!filterResult.passesOwnerfinance && !filterResult.passesCashDeal) {
            filteredOut++;
            continue;
          }

          const docData = createUnifiedPropertyDoc(property, filterResult);
          await db.collection('properties').doc(docId).set(docData, { merge: true });

          if (filterResult.passesOwnerfinance) {
            zipOwnerFinance++;
            ownerFinanceCount++;
          }
          if (filterResult.passesCashDeal) {
            zipCashDeals++;
            cashDealCount++;
          }

          typesenseProperties.push(docData as UnifiedProperty);

          allResults.push({
            zpid: property.zpid,
            searchZip: zip,
            scrapedAt: new Date().toISOString(),
            ownerFinance: filterResult.passesOwnerfinance,
            cashDeal: filterResult.passesCashDeal,
            filterResult: {
              ownerFinanceKeywords: filterResult.ownerFinanceKeywords,
              cashDealReason: filterResult.cashDealReason,
              discountPercentage: filterResult.discountPercentage
            }
          });

        } catch (error) {
          console.error(`    ❌ Error processing property:`, error);
          transformFailed++;
        }
      }
      
      console.log(`  📊 Owner Finance: ${zipOwnerFinance}, Cash Deals: ${zipCashDeals}`);

      // Delay between zips to be respectful
      if (i < emptyZipUrls.length - 1) {
        console.log('  ⏳ Waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

    } catch (error) {
      console.error(`  💥 Error scraping ${zip}:`, error);
    }
  }

  console.log('\n=== RESUME SCRAPING COMPLETE ===');
  console.log(`Empty zips processed: ${emptyZipUrls.length}`);
  console.log(`Total properties found: ${totalProperties}`);
  console.log(`Transform succeeded: ${transformSucceeded}`);
  console.log(`Transform failed: ${transformFailed}`);
  console.log(`Validation failed: ${validationFailed}`);
  console.log(`Duplicates skipped: ${duplicatesSkipped}`);
  console.log(`Filtered out: ${filteredOut}`);
  console.log(`Owner finance opportunities: ${ownerFinanceCount}`);
  console.log(`Cash deals (< 80% ARV): ${cashDealCount}`);

  // Index to Typesense
  if (typesenseProperties.length > 0) {
    try {
      console.log(`\n[TYPESENSE] Indexing ${typesenseProperties.length} properties...`);
      await indexPropertiesBatch(typesenseProperties);
      console.log('✅ Typesense indexing complete');
    } catch (error) {
      console.error('❌ Typesense indexing failed:', error);
    }
  }

  // Save results
  if (allResults.length > 0) {
    console.log('\n📁 Saving results to file...');
    
    const fs = await import('fs/promises');
    const outputFile = `resume_scrape_${new Date().toISOString().split('T')[0]}.json`;
    
    const output = {
      metadata: {
        scrapedAt: new Date().toISOString(),
        emptyZipsProcessed: emptyZipUrls.length,
        emptyZips: emptyZipUrls.map(z => z.zip),
        totalProperties: totalProperties,
        transformSucceeded,
        transformFailed,
        validationFailed,
        duplicatesSkipped,
        filteredOut,
        ownerFinanceCount,
        cashDealCount,
        resumeRun: true
      },
      properties: allResults
    };
    
    await fs.writeFile(outputFile, JSON.stringify(output, null, 2));
    console.log(`✅ Results saved to ${outputFile}`);
  }

  console.log('\n✨ Resume script complete!');
}

// Run the script
resumeOneTimeScrape().catch(error => {
  console.error('💀 Fatal error:', error);
  process.exit(1);
});