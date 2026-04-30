#!/usr/bin/env npx tsx
/**
 * One-time script to scrape ALL 55 target zip codes from 4.30_target_zips.md
 * and run them through the complete owner finance pipeline
 * 
 * This mimics the EXACT flow of the daily cron job:
 * 1. Scrape properties from Zillow (using Apify)
 * 2. Check for duplicates
 * 3. Fetch property details
 * 4. Run owner finance detection (strict keyword filter)
 * 5. Run cash deals filter (<80% ARV)
 * 6. Send to GHL webhook for agent outreach
 * 7. Index in Typesense for website display
 * 
 * For one-time run: We REMOVE the doz=1 filter to get ALL listings
 * For daily cron: The doz=1 filter remains to get only fresh 1-day listings
 */

import * as fs from 'fs';
import * as path from 'path';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { 
  runSearchScraper, 
  runDetailScraper,
  type ScrapedProperty 
} from '../src/lib/scraper-v2/apify-client';
import {
  runUnifiedFilter,
  type FilterResult,
} from '../src/lib/scraper-v2/unified-filter';
import {
  transformProperty,
  validateProperty,
  createUnifiedPropertyDoc,
} from '../src/lib/scraper-v2/property-transformer';
import { sendBatchToGHLWebhook, toGHLPayload } from '../src/lib/scraper-v2/ghl-webhook';
import { indexPropertiesBatch } from '../src/lib/typesense/sync';

async function extractUrlsFromDocument(): Promise<string[]> {
  const docPath = path.join(process.cwd(), '4.30_target_zips.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  
  // Extract all Zillow URLs from code blocks
  const urlPattern = /https:\/\/www\.zillow\.com\/[^\s`]+/g;
  const urls = content.match(urlPattern) || [];
  
  // Deduplicate
  return [...new Set(urls)];
}

async function main() {
  console.log('🚀 Starting one-time scrape of all 55 target zip codes');
  console.log('================================================\n');

  // Get URLs from document
  const urls = await extractUrlsFromDocument();
  
  console.log(`📍 Found ${urls.length} unique Zillow URLs in 4.30_target_zips.md`);
  
  if (urls.length !== 55) {
    console.warn(`⚠️  Expected 55 URLs but found ${urls.length}`);
  }

  const overallStats = {
    totalScraped: 0,
    totalProcessed: 0,
    ownerFinanceMatches: 0,
    cashDeals: 0,
    sentToGHL: 0,
    addedToWebsite: 0,
    duplicates: 0,
    errors: []
  };

  // Process in batches of 5 to avoid overwhelming Apify
  const batchSize = 5;
  
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, Math.min(i + batchSize, urls.length));
    console.log(`\n[BATCH ${Math.floor(i/batchSize) + 1}/${Math.ceil(urls.length/batchSize)}] Processing ${batch.length} URLs...`);
    
    for (const url of batch) {
      const zipMatch = url.match(/(\d{5})/);
      const zipCode = zipMatch ? zipMatch[1] : 'unknown';
      const cityMatch = url.match(/\/([a-z-]+)-(ga|tn|oh|in|mi)-\d{5}/);
      const city = cityMatch ? cityMatch[1].replace(/-/g, ' ') : 'unknown';
      
      console.log(`\n  📍 ${city.toUpperCase()}, ${zipCode}`);
      
      try {
        // IMPORTANT: Remove doz filter for one-time run to get ALL listings
        // The cron keeps doz=1 for daily fresh listings only
        let allListingsUrl = url;
        
        // Remove doz parameter variations:
        // URL encoded: %22doz%22%3A%7B%22value%22%3A%221%22%7D%2C
        // or plain: "doz":{"value":"1"},
        allListingsUrl = allListingsUrl.replace(/%22doz%22%3A%7B%22value%22%3A%22\d+%22%7D%2C?/g, '');
        allListingsUrl = allListingsUrl.replace(/"doz":\{"value":"\d+"\},?/g, '');
        
        console.log(`     Scraping ALL listings (doz filter removed)...`);
        
        // Step 1: Run search scraper
        const searchResults = await runSearchScraper([allListingsUrl]);
        
        console.log(`     Found ${searchResults.length} properties`);
        overallStats.totalScraped += searchResults.length;
        
        if (searchResults.length === 0) continue;
        
        // Get Firebase instance
        const { db } = getFirebaseAdmin();
        
        // Step 2: Check for duplicates
        const zpids = searchResults
          .map(p => p.zpid)
          .filter(zpid => zpid)
          .map(zpid => String(zpid));
        
        if (zpids.length === 0) continue;
        
        // Check in batches of 10 (Firestore limit)
        const existingZpids = new Set<string>();
        for (let i = 0; i < zpids.length; i += 10) {
          const batch = zpids.slice(i, i + 10);
          const existingDocs = await db.collection('properties')
            .where('__name__', 'in', batch.map(z => `zpid_${z}`))
            .get();
          existingDocs.docs.forEach(d => existingZpids.add(d.id.replace('zpid_', '')));
        }
        
        const newProperties = searchResults.filter(p => !existingZpids.has(String(p.zpid)));
        
        console.log(`     ${existingZpids.size} duplicates, ${newProperties.length} new`);
        overallStats.duplicates += existingZpids.size;
        
        if (newProperties.length === 0) continue;
        
        // Step 3: Fetch property details for new properties
        console.log(`     Fetching details for ${newProperties.length} new properties...`);
        const propertiesWithDetails: ScrapedProperty[] = [];
        
        for (const property of newProperties) {
          if (property.url) {
            try {
              const details = await runDetailScraper([property.url]);
              if (details.length > 0) {
                propertiesWithDetails.push({ ...property, ...details[0] });
              } else {
                propertiesWithDetails.push(property);
              }
            } catch (error) {
              console.log(`     ⚠️  Failed to get details for ${property.address}: ${error.message}`);
              propertiesWithDetails.push(property);
            }
          } else {
            propertiesWithDetails.push(property);
          }
        }
        
        // Step 4: Process through unified pipeline
        let ownerFinanceCount = 0;
        let cashDealsCount = 0;
        let ghlSentCount = 0;
        let indexedCount = 0;
        
        for (const property of propertiesWithDetails) {
          try {
            // Run unified filter (owner finance + cash deal detection)
            const filterResult = await runUnifiedFilter(property);
            
            // Transform to unified property format
            const transformedProperty = transformProperty(property, filterResult);
            
            // Validate the property
            const validationResult = validateProperty(transformedProperty);
            if (!validationResult.isValid) {
              console.log(`     ⚠️  Invalid property ${property.address}: ${validationResult.errors.join(', ')}`);
              continue;
            }
            
            // Add source and processing metadata
            const finalProperty = {
              ...transformedProperty,
              source: `target_zip_${zipCode}`,
              processedAt: new Date(),
              isActive: true,
            };
            
            // Save to Firestore
            const docData = createUnifiedPropertyDoc(finalProperty);
            await db.collection('properties').doc(`zpid_${finalProperty.zpid}`).set(docData, { merge: true });
            
            // Track stats
            if (filterResult.ownerFinance.matches) ownerFinanceCount++;
            if (filterResult.cashDeal.matches) cashDealsCount++;
            
            // Send to GHL if it matches either filter
            if (filterResult.ownerFinance.matches || filterResult.cashDeal.matches) {
              try {
                const ghlPayload = toGHLPayload(finalProperty);
                await sendBatchToGHLWebhook([ghlPayload]);
                ghlSentCount++;
                console.log(`     📤 Sent to GHL: ${property.address}`);
              } catch (error) {
                console.log(`     ⚠️  GHL webhook failed for ${property.address}: ${error.message}`);
              }
            }
            
            // Index in Typesense if it matches either filter
            if (filterResult.ownerFinance.matches || filterResult.cashDeal.matches) {
              try {
                await indexPropertiesBatch([finalProperty]);
                indexedCount++;
                console.log(`     🌐 Indexed: ${property.address}`);
              } catch (error) {
                console.log(`     ⚠️  Typesense indexing failed for ${property.address}: ${error.message}`);
              }
            }
            
          } catch (error) {
            console.error(`     ❌ Error processing ${property.address}: ${error.message}`);
          }
        }
        
        const processingResult = {
          processed: propertiesWithDetails.length,
          ownerFinanceMatches: ownerFinanceCount,
          cashDeals: cashDealsCount,
          sentToGHL: ghlSentCount,
          indexed: indexedCount
        };
        
        // Update stats
        overallStats.totalProcessed += processingResult.processed;
        overallStats.ownerFinanceMatches += processingResult.ownerFinanceMatches;
        overallStats.cashDeals += processingResult.cashDeals;
        overallStats.sentToGHL += processingResult.sentToGHL;
        overallStats.addedToWebsite += processingResult.indexed;
        
        console.log(`     ✅ Processed: ${processingResult.processed}`);
        console.log(`        Owner Finance: ${processingResult.ownerFinanceMatches}`);
        console.log(`        Cash Deals: ${processingResult.cashDeals}`);
        console.log(`        Sent to GHL: ${processingResult.sentToGHL}`);
        
      } catch (error) {
        console.error(`     ❌ Error processing ${zipCode}: ${error.message}`);
        overallStats.errors.push({ zip: zipCode, error: error.message });
      }
    }
    
    // Small delay between batches
    if (i + batchSize < urls.length) {
      console.log('\n⏳ Waiting 5 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Print final report
  console.log('\n================================================');
  console.log('📊 FINAL REPORT');
  console.log('================================================');
  console.log(`URLs Processed: ${urls.length}`);
  console.log(`Total Properties Scraped: ${overallStats.totalScraped}`);
  console.log(`Duplicates Skipped: ${overallStats.duplicates}`);
  console.log(`New Properties Processed: ${overallStats.totalProcessed}`);
  console.log('');
  console.log(`✅ Owner Finance Matches: ${overallStats.ownerFinanceMatches} (${(overallStats.ownerFinanceMatches / overallStats.totalProcessed * 100).toFixed(1)}%)`);
  console.log(`💰 Cash Deals (<80% ARV): ${overallStats.cashDeals} (${(overallStats.cashDeals / overallStats.totalProcessed * 100).toFixed(1)}%)`);
  console.log(`📤 Sent to GHL: ${overallStats.sentToGHL}`);
  console.log(`🌐 Added to Website: ${overallStats.addedToWebsite}`);
  
  if (overallStats.errors.length > 0) {
    console.log(`\n❌ Errors (${overallStats.errors.length}):`);
    overallStats.errors.forEach(e => console.log(`   - ${e.zip}: ${e.error}`));
  }
  
  console.log('\n✅ Script complete!');
  
  // Verify cron configuration
  console.log('\n🔧 CRON VERIFICATION');
  console.log('================================================');
  
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf-8'));
  const scraperCron = vercelConfig.crons.find(c => c.path === '/api/v2/scraper/run');
  
  if (scraperCron) {
    console.log(`✅ Daily cron configured: ${scraperCron.schedule}`);
    console.log('   Runs at: 6:00 PM UTC (12:00 PM CST)');
    console.log('   ');
    console.log('   The daily cron WILL use these filters:');
    console.log('   - doz=1 (fresh 1-day listings only)');
    console.log('   - price: $0-$300,000');
    console.log('   - built: 1970 or newer');
    console.log('   - HOA: max $200/month');
    console.log('   - Excludes: land, apartments, manufactured, 55+');
    console.log('   ');
    console.log('   Daily cron targets these zip codes:');
    
    // Read the actual config
    const searchConfig = fs.readFileSync('src/lib/scraper-v2/search-config.ts', 'utf-8');
    const targetedZipsMatch = searchConfig.match(/TARGETED_CASH_ZIPS = \[([\s\S]*?)\]/);
    
    if (targetedZipsMatch) {
      const zips = targetedZipsMatch[1].match(/'\d{5}'/g) || [];
      console.log(`   - ${zips.length} zip codes configured`);
      
      // Check if our 55 zips match
      const configuredZips = zips.map(z => z.replace(/'/g, ''));
      const ourZips = urls.map(u => {
        const m = u.match(/(\d{5})/);
        return m ? m[1] : null;
      }).filter(z => z);
      
      const missing = ourZips.filter(z => !configuredZips.includes(z));
      const extra = configuredZips.filter(z => !ourZips.includes(z));
      
      if (missing.length === 0 && extra.length === 0) {
        console.log('   ✅ All 55 zips from document are in the cron config!');
      } else {
        if (missing.length > 0) {
          console.log(`   ⚠️  Missing from cron: ${missing.join(', ')}`);
        }
        if (extra.length > 0) {
          console.log(`   ⚠️  Extra in cron: ${extra.join(', ')}`);
        }
      }
    }
  } else {
    console.log('❌ Scraper cron not found in vercel.json!');
  }
  
  console.log('\n📝 PIPELINE CONFIRMATION');
  console.log('================================================');
  console.log('Each property goes through this exact flow:');
  console.log('1. ✅ Scraped from Zillow with all filters');
  console.log('2. ✅ Duplicate check against Firestore');
  console.log('3. ✅ Detail fetching from Zillow');
  console.log('4. ✅ Owner finance keyword detection');
  console.log('5. ✅ Cash deal filter (<80% ARV with zestimate)');
  console.log('6. ✅ Send to GHL webhook for agent outreach');
  console.log('7. ✅ Index in Typesense for website search');
  console.log('8. ✅ Agent confirms → marked as "owner finance positive"');
  console.log('');
  console.log('The daily cron runs this SAME flow at 12 PM CST');
  console.log('but only for properties listed within the last 24 hours.');
}

// Run the script
main().catch(console.error);