#!/usr/bin/env npx tsx
/**
 * ONE-TIME SCRAPER: All Properties in Target Zips
 * 
 * Pulls ALL currently listed properties (no doz filter) from all 46 target zip codes
 * Uses the EXACT same pipeline as the daily cron job
 * Ensures proper flow through filters and database saves
 * 
 * Created: May 1, 2026
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
import { sendBatchToGHLWebhook, toGHLPayload } from '../src/lib/scraper-v2/ghl-webhook';

dotenv.config({ path: '.env.local' });

// Configuration
const BATCH_SIZE = 50; // Process in smaller batches to avoid memory issues
const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches

/**
 * Remove doz filter to get ALL active listings (not just recent)
 */
function removeDozFilter(url: string): string {
  const match = url.match(/searchQueryState=([^&]+)/);
  if (!match) return url;
  
  try {
    const decoded = decodeURIComponent(match[1]);
    const queryState = JSON.parse(decoded);
    
    // Remove doz (days on Zillow) filter to get ALL listings
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
 * Extract zip code from URL
 */
function extractZipFromUrl(url: string): string | null {
  const match = url.match(/(\d{5})/);
  return match ? match[1] : null;
}

async function runOneTimeTargetZipsScraper() {
  console.log('=== ONE-TIME TARGET ZIPS SCRAPER ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Target Zips: ${TARGETED_ZIP_URLS.length}`);
  console.log('');

  const { db } = getFirebaseAdmin();
  
  // Check GHL webhook configuration
  const GHL_WEBHOOK_URL = process.env.GHL_AGENT_OUTREACH_WEBHOOK_URL;
  if (!GHL_WEBHOOK_URL) {
    console.warn('⚠️  GHL_AGENT_OUTREACH_WEBHOOK_URL not configured - skipping GHL integration');
  }
  
  // Tracking metrics
  const metrics = {
    totalZips: TARGETED_ZIP_URLS.length,
    zipsProcessed: 0,
    totalFound: 0,
    newProperties: 0,
    duplicatesSkipped: 0,
    transformSucceeded: 0,
    validationFailed: 0,
    savedToDatabase: 0,
    ownerFinanceCount: 0,
    cashDealCount: 0,
    sentToGHL: 0,
    typesenseIndexed: 0,
    errors: [] as string[],
    zipResults: {} as Record<string, number>,
  };
  
  // Collections for batch processing
  const typesenseQueue: UnifiedProperty[] = [];
  const ghlQueue: any[] = [];

  try {
    // Process each ZIP code URL
    for (let i = 0; i < TARGETED_ZIP_URLS.length; i++) {
      const originalUrl = TARGETED_ZIP_URLS[i];
      const url = removeDozFilter(originalUrl); // Remove doz filter to get ALL listings
      const zipCode = extractZipFromUrl(url);
      
      console.log(`\n[${i + 1}/${TARGETED_ZIP_URLS.length}] Processing ZIP ${zipCode}...`);
      console.log(`URL: ${url.substring(0, 100)}...`);
      
      try {
        // STEP 1: Search for properties
        console.log('  🔍 Searching for properties...');
        const searchResults = await runSearchScraper([url], {
          maxResults: 500, // Get more since no doz filter
          mode: 'pagination'
        });
        
        const zipCount = searchResults.length;
        metrics.totalFound += zipCount;
        metrics.zipResults[zipCode || 'unknown'] = zipCount;
        
        console.log(`  ✅ Found ${zipCount} properties`);
        
        if (zipCount === 0) {
          console.log(`  📭 No properties found for ${zipCode}`);
          continue;
        }
        
        // STEP 2: Check for duplicates in database
        console.log('  🔄 Checking for duplicates...');
        const newProperties: ScrapedProperty[] = [];
        let duplicateCount = 0;
        
        for (const prop of searchResults) {
          const zpid = typeof prop.zpid === 'string' ? parseInt(prop.zpid, 10) : prop.zpid;
          if (!zpid) continue;
          
          const docId = `zpid_${zpid}`;
          const existingDoc = await db.collection('properties').doc(docId).get();
          
          if (!existingDoc.exists) {
            newProperties.push(prop);
          } else {
            duplicateCount++;
          }
        }
        
        metrics.duplicatesSkipped += duplicateCount;
        console.log(`  🆕 ${newProperties.length} new, ${duplicateCount} duplicates`);
        
        if (newProperties.length === 0) {
          console.log(`  ℹ️  All properties already in database`);
          continue;
        }
        
        // STEP 3: Get detailed information for new properties
        console.log(`  📋 Getting details for ${newProperties.length} properties...`);
        const propertyUrls = newProperties
          .map((p: any) => p.detailUrl || p.url)
          .filter((url: string) => url && url.includes('zillow.com'));
        
        let detailedProperties: ScrapedProperty[] = [];
        
        // Process in batches to avoid overwhelming Apify
        for (let j = 0; j < propertyUrls.length; j += BATCH_SIZE) {
          const batch = propertyUrls.slice(j, j + BATCH_SIZE);
          console.log(`    Batch ${Math.floor(j/BATCH_SIZE) + 1}/${Math.ceil(propertyUrls.length/BATCH_SIZE)}: ${batch.length} properties`);
          
          try {
            const batchDetails = await runDetailScraper(batch, { timeoutSecs: 300 });
            detailedProperties = detailedProperties.concat(batchDetails);
            
            // Small delay between batches
            if (j + BATCH_SIZE < propertyUrls.length) {
              await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
            }
          } catch (error: any) {
            console.error(`    ❌ Batch error: ${error.message}`);
            // Fall back to search results for this batch
            const batchZpids = batch.map(url => {
              const match = url.match(/(\d+)_zpid/);
              return match ? match[1] : null;
            }).filter(Boolean);
            
            const fallbackProps = newProperties.filter((p: any) => 
              batchZpids.includes(String(p.zpid))
            );
            detailedProperties = detailedProperties.concat(fallbackProps);
          }
        }
        
        console.log(`  ✅ Got details for ${detailedProperties.length} properties`);
        
        // STEP 4: Merge images from search results
        const searchByZpid = new Map();
        searchResults.forEach(prop => {
          if (prop.zpid) searchByZpid.set(String(prop.zpid), prop);
        });
        
        detailedProperties.forEach(prop => {
          if (!prop.imgSrc && prop.zpid) {
            const searchItem = searchByZpid.get(String(prop.zpid));
            if (searchItem?.imgSrc) {
              prop.imgSrc = searchItem.imgSrc;
            }
          }
        });
        
        // STEP 5: Process through unified pipeline (SAME AS DAILY CRON)
        console.log('  🔄 Processing through unified pipeline...');
        let zipOwnerFinance = 0;
        let zipCashDeal = 0;
        let zipSaved = 0;
        
        for (const raw of detailedProperties) {
          try {
            // Transform property (identical to cron)
            const property = transformProperty(raw, 'scraper-v2', 'one-time-all-zips');
            metrics.transformSucceeded++;
            
            // Validate property (identical to cron)
            const validation = validateProperty(property);
            if (!validation.valid) {
              metrics.validationFailed++;
              continue;
            }
            
            // Run unified filter (EXACT SAME as cron)
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
            
            // For GHL: Send properties that DON'T have owner finance keywords
            // We use GHL to ask agents if sellers might consider owner financing
            // Skip properties that already have owner finance keywords (we don't need to ask)
            if (GHL_WEBHOOK_URL && !filterResult.passesOwnerfinance) {
              const ghlPayload = toGHLPayload(property, filterResult);
              if (ghlPayload) {
                ghlQueue.push(ghlPayload);
              }
            }
            
            // Skip database save if no filters passed
            if (!filterResult.shouldSave) {
              continue;
            }
            
            // Count by filter type
            if (filterResult.isOwnerfinance) {
              zipOwnerFinance++;
              metrics.ownerFinanceCount++;
            }
            if (filterResult.isCashDeal) {
              zipCashDeal++;
              metrics.cashDealCount++;
            }
            
            // Create unified document (identical to cron)
            const docData = createUnifiedPropertyDoc(property, filterResult);
            
            // Save to Firebase (with retry logic)
            const docId = `zpid_${property.zpid}`;
            try {
              await db.collection('properties').doc(docId).set(docData, { merge: true });
              zipSaved++;
              metrics.savedToDatabase++;
              metrics.newProperties++;
              
              // Add to Typesense queue
              typesenseQueue.push(docData as UnifiedProperty);
              
            } catch (saveError: any) {
              console.error(`    ❌ Failed to save zpid_${property.zpid}: ${saveError.message}`);
              metrics.errors.push(`Save failed for zpid_${property.zpid}: ${saveError.message}`);
            }
            
          } catch (error: any) {
            console.error(`    ❌ Processing error: ${error.message}`);
            metrics.errors.push(`Processing error: ${error.message}`);
          }
        }
        
        console.log(`  📊 Results: ${zipSaved} saved (OF: ${zipOwnerFinance}, Cash: ${zipCashDeal})`);
        metrics.zipsProcessed++;
        
        // Batch index to Typesense
        if (typesenseQueue.length >= 100) {
          console.log(`  🔍 Indexing ${typesenseQueue.length} properties to Typesense...`);
          try {
            await indexPropertiesBatch(typesenseQueue);
            metrics.typesenseIndexed += typesenseQueue.length;
            typesenseQueue.length = 0; // Clear queue
          } catch (error: any) {
            console.error(`  ❌ Typesense error: ${error.message}`);
          }
        }
        
        // Batch send to GHL
        if (ghlQueue.length >= 50) {
          console.log(`  📤 Sending ${ghlQueue.length} properties to GHL...`);
          try {
            await sendBatchToGHLWebhook(ghlQueue);
            metrics.sentToGHL += ghlQueue.length;
            ghlQueue.length = 0; // Clear queue
          } catch (error: any) {
            console.error(`  ❌ GHL error: ${error.message}`);
          }
        }
        
        // Delay between zips to be respectful
        if (i < TARGETED_ZIP_URLS.length - 1) {
          console.log('  ⏳ Waiting before next zip...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error: any) {
        console.error(`  💥 Fatal error for ZIP ${zipCode}: ${error.message}`);
        metrics.errors.push(`Fatal error for ZIP ${zipCode}: ${error.message}`);
      }
    }
    
    // Process remaining items in queues
    if (typesenseQueue.length > 0) {
      console.log(`\n🔍 Indexing final ${typesenseQueue.length} properties to Typesense...`);
      try {
        await indexPropertiesBatch(typesenseQueue);
        metrics.typesenseIndexed += typesenseQueue.length;
      } catch (error: any) {
        console.error(`❌ Final Typesense error: ${error.message}`);
      }
    }
    
    if (ghlQueue.length > 0 && GHL_WEBHOOK_URL) {
      console.log(`📤 Sending final ${ghlQueue.length} properties to GHL...`);
      try {
        await sendBatchToGHLWebhook(ghlQueue);
        metrics.sentToGHL += ghlQueue.length;
      } catch (error: any) {
        console.error(`❌ Final GHL error: ${error.message}`);
      }
    }
    
  } catch (fatalError: any) {
    console.error('💀 FATAL ERROR:', fatalError);
    metrics.errors.push(`FATAL: ${fatalError.message}`);
  }
  
  // Generate final report
  console.log('\n' + '='.repeat(60));
  console.log('=== ONE-TIME SCRAPER COMPLETE ===');
  console.log('='.repeat(60));
  console.log(`\n📊 SUMMARY:`);
  console.log(`  Total Zips: ${metrics.totalZips}`);
  console.log(`  Zips Processed: ${metrics.zipsProcessed}`);
  console.log(`  Properties Found: ${metrics.totalFound}`);
  console.log(`  New Properties: ${metrics.newProperties}`);
  console.log(`  Duplicates Skipped: ${metrics.duplicatesSkipped}`);
  console.log(`  Transform Succeeded: ${metrics.transformSucceeded}`);
  console.log(`  Validation Failed: ${metrics.validationFailed}`);
  console.log(`  Saved to Database: ${metrics.savedToDatabase}`);
  console.log(`  Owner Finance: ${metrics.ownerFinanceCount}`);
  console.log(`  Cash Deals: ${metrics.cashDealCount}`);
  console.log(`  Typesense Indexed: ${metrics.typesenseIndexed}`);
  console.log(`  Sent to GHL: ${metrics.sentToGHL}`);
  
  if (metrics.errors.length > 0) {
    console.log(`\n❌ ERRORS (${metrics.errors.length}):`);
    metrics.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    if (metrics.errors.length > 10) {
      console.log(`  ... and ${metrics.errors.length - 10} more errors`);
    }
  }
  
  console.log(`\n📍 TOP PERFORMING ZIPS:`);
  const sortedZips = Object.entries(metrics.zipResults)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
  sortedZips.forEach(([zip, count]) => {
    console.log(`  ${zip}: ${count} properties`);
  });
  
  console.log(`\n📍 ZIPS WITH NO PROPERTIES:`);
  const emptyZips = Object.entries(metrics.zipResults)
    .filter(([,count]) => count === 0)
    .map(([zip]) => zip);
  if (emptyZips.length > 0) {
    console.log(`  ${emptyZips.join(', ')}`);
  } else {
    console.log(`  None - all zips have properties!`);
  }
  
  // Save report to file
  const reportFile = `one_time_scrape_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
  const fs = await import('fs/promises');
  await fs.writeFile(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    metrics,
    zipResults: metrics.zipResults,
  }, null, 2));
  
  console.log(`\n📁 Report saved to: ${reportFile}`);
  console.log('\n✨ One-time scraper completed successfully!');
  
  return metrics;
}

// Run the scraper
console.log('Starting one-time target zips scraper...\n');
runOneTimeTargetZipsScraper()
  .then(metrics => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💀 Script failed:', error);
    process.exit(1);
  });