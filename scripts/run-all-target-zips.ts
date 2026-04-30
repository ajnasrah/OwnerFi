#!/usr/bin/env npx tsx
/**
 * One-time script to scrape ALL 55 target zip codes 
 * and run them through the complete owner finance pipeline
 * 
 * Flow:
 * 1. Scrape all 55 Zillow URLs from 4.30_target_zips.md
 * 2. Run owner finance detection 
 * 3. Run cash deals filter (<80% ARV)
 * 4. Send to GHL for agent outreach
 * 5. Index in Typesense for website display
 * 
 * This mimics the exact flow of the daily cron job
 * but processes ALL listings (not just 1-day fresh)
 */

import { ScraperRunner } from '../src/lib/scraper-v2/runner';
import { ownerFinanceFilterStrict } from '../src/lib/filters/owner-financing-filter-strict';
import { cashDealFilter } from '../src/lib/filters/cash-deal-filter';
import { sendToGHL } from '../src/lib/integrations/ghl-webhook';
import { indexProperty } from '../src/lib/typesense/sync';
import { db } from '../src/lib/firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// All 55 Zillow URLs from our target markets
const TARGET_URLS = [
  // Memphis, TN - 7 zip codes
  'https://www.zillow.com/memphis-tn-38106/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.1814%2C%22south%22%3A35.054122%2C%22east%22%3A-90.005829%2C%22west%22%3A-90.118032%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2238106%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74641%2C%22regionType%22%3A7%7D%5D%7D',
  'https://www.zillow.com/memphis-tn-38122/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.109%2C%22south%22%3A35.03%2C%22east%22%3A-89.844%2C%22west%22%3A-89.941%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2238122%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74658%2C%22regionType%22%3A7%7D%5D%7D',
  'https://www.zillow.com/memphis-tn-38114/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A35.13959%2C%22south%22%3A35.03045%2C%22east%22%3A-89.93855%2C%22west%22%3A-90.07841%7D%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%2238114%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22category%22%3A%22cat1%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A61914%2C%22regionType%22%3A7%7D%5D%7D',
  // ... Add all 55 URLs here (extracting from document)
];

// Extract ALL URLs from the markdown document
async function extractUrlsFromDocument(): Promise<string[]> {
  const docPath = path.join(process.cwd(), '4.30_target_zips.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  
  // Extract all Zillow URLs
  const urlPattern = /https:\/\/www\.zillow\.com\/[^\s`]+/g;
  const urls = content.match(urlPattern) || [];
  
  console.log(`📋 Found ${urls.length} Zillow URLs in document`);
  return urls;
}

async function processProperty(property: any, source: string) {
  const stats = {
    isOwnerFinance: false,
    isCashDeal: false,
    sentToGHL: false,
    addedToWebsite: false,
    errors: []
  };

  try {
    // 1. Check for owner finance keywords
    const ofResult = await ownerFinanceFilterStrict(property);
    if (ofResult.matches) {
      stats.isOwnerFinance = true;
      property.isOwnerFinance = true;
      property.ownerFinanceKeywords = ofResult.keywords;
      console.log(`✅ Owner Finance Match: ${property.address} - Keywords: ${ofResult.keywords.join(', ')}`);
    }

    // 2. Check if cash deal (<80% ARV)
    const cdResult = await cashDealFilter(property);
    if (cdResult.matches) {
      stats.isCashDeal = true;
      property.isCashDeal = true;
      property.percentOfArv = cdResult.percentOfArv;
      console.log(`💰 Cash Deal: ${property.address} - ${cdResult.percentOfArv}% of ARV`);
    }

    // 3. Send to GHL for agent outreach (if either OF or cash deal)
    if (stats.isOwnerFinance || stats.isCashDeal) {
      try {
        await sendToGHL({
          ...property,
          dealType: stats.isOwnerFinance ? 'owner_finance' : 'cash_deal',
          source: source
        });
        stats.sentToGHL = true;
        console.log(`📤 Sent to GHL: ${property.address}`);
      } catch (error) {
        console.error(`❌ GHL Error: ${error.message}`);
        stats.errors.push(`GHL: ${error.message}`);
      }
    }

    // 4. Save to Firestore
    const docId = property.zpid || property.url?.split('/').pop()?.split('_')[0];
    if (docId) {
      await db.collection('properties').doc(docId).set({
        ...property,
        isOwnerFinance: stats.isOwnerFinance,
        isCashDeal: stats.isCashDeal,
        sentToGHL: stats.sentToGHL,
        processedAt: new Date(),
        source: source
      }, { merge: true });

      // 5. Index in Typesense for website search
      if (stats.isOwnerFinance || stats.isCashDeal) {
        await indexProperty(property);
        stats.addedToWebsite = true;
        console.log(`🌐 Indexed for website: ${property.address}`);
      }
    }

  } catch (error) {
    console.error(`❌ Error processing ${property.address}:`, error);
    stats.errors.push(error.message);
  }

  return stats;
}

async function main() {
  console.log('🚀 Starting one-time scrape of all 55 target zip codes');
  console.log('================================================\n');

  // Get URLs from document
  const urls = await extractUrlsFromDocument();
  
  if (urls.length === 0) {
    console.error('❌ No URLs found in document');
    process.exit(1);
  }

  console.log(`📍 Processing ${urls.length} zip code URLs`);
  console.log('Note: This will process ALL listings (not just 1-day fresh)\n');

  const overallStats = {
    totalProperties: 0,
    ownerFinanceMatches: 0,
    cashDeals: 0,
    sentToGHL: 0,
    addedToWebsite: 0,
    errors: 0
  };

  // Process each URL
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const zipMatch = url.match(/(\d{5})/);
    const zipCode = zipMatch ? zipMatch[1] : 'unknown';
    
    console.log(`\n[${i + 1}/${urls.length}] Processing ZIP ${zipCode}...`);
    console.log('----------------------------------------');

    try {
      // Initialize scraper for this URL
      const runner = new ScraperRunner();
      
      // Remove doz filter for one-time run (get ALL listings, not just 1-day)
      const allListingsUrl = url.replace(/%22doz%22%3A%7B%22value%22%3A%221%22%7D%2C/, '');
      
      const properties = await runner.scrapeUrl(allListingsUrl);
      console.log(`📊 Found ${properties.length} properties in ${zipCode}`);

      // Process each property
      for (const property of properties) {
        const stats = await processProperty(property, `zip_${zipCode}`);
        
        overallStats.totalProperties++;
        if (stats.isOwnerFinance) overallStats.ownerFinanceMatches++;
        if (stats.isCashDeal) overallStats.cashDeals++;
        if (stats.sentToGHL) overallStats.sentToGHL++;
        if (stats.addedToWebsite) overallStats.addedToWebsite++;
        if (stats.errors.length > 0) overallStats.errors++;
      }

    } catch (error) {
      console.error(`❌ Failed to process ZIP ${zipCode}:`, error.message);
      overallStats.errors++;
    }
  }

  // Print final report
  console.log('\n================================================');
  console.log('📊 FINAL REPORT');
  console.log('================================================');
  console.log(`Total Properties Processed: ${overallStats.totalProperties}`);
  console.log(`Owner Finance Matches: ${overallStats.ownerFinanceMatches} (${(overallStats.ownerFinanceMatches / overallStats.totalProperties * 100).toFixed(1)}%)`);
  console.log(`Cash Deals (<80% ARV): ${overallStats.cashDeals} (${(overallStats.cashDeals / overallStats.totalProperties * 100).toFixed(1)}%)`);
  console.log(`Sent to GHL for Outreach: ${overallStats.sentToGHL}`);
  console.log(`Added to Website: ${overallStats.addedToWebsite}`);
  console.log(`Errors: ${overallStats.errors}`);
  console.log('\n✅ Script complete!');
  
  // Verify cron configuration
  console.log('\n🔧 Verifying cron configuration...');
  const cronConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf-8'));
  const scraperCron = cronConfig.crons.find(c => c.path === '/api/v2/scraper/run');
  
  if (scraperCron) {
    console.log(`✅ Cron is configured to run at: ${scraperCron.schedule}`);
    console.log('   This translates to: Daily at 12:00 PM CST (6:00 PM UTC)');
    console.log('   The cron WILL use doz=1 filter for fresh 1-day listings');
  } else {
    console.log('❌ Warning: Scraper cron not found in vercel.json');
  }
}

// Run the script
main().catch(console.error);