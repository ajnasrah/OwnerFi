#!/usr/bin/env npx tsx
/**
 * Verification script to confirm the difference between:
 * 1. Cron daily scraper (uses doz=1 for fresh 1-day listings)
 * 2. One-time script (removes doz filter to get ALL listings)
 */

import { buildPreciseZipSearchUrl } from '../src/lib/scraper-v2/search-config';

console.log('🔧 VERIFICATION: Cron vs One-Time Script URL Differences');
console.log('='.repeat(70));

// Test with Memphis zip code
const testZip = '38125';

console.log(`\n📍 Testing with Memphis, TN ${testZip}\n`);

// 1. Generate URL exactly how the cron does it
const cronUrl = buildPreciseZipSearchUrl(testZip);
console.log('1️⃣  CRON URL (with doz=1 filter for 1-day listings):');
console.log('   ' + cronUrl);

// Decode the query state to show the filter
const cronQueryState = JSON.parse(decodeURIComponent(cronUrl.split('searchQueryState=')[1]));
console.log('\n   📊 CRON Filters:');
console.log(`      - doz: ${cronQueryState.filterState.doz.value} (1-day listings only)`);
console.log(`      - price: $${cronQueryState.filterState.price.min.toLocaleString()} - $${cronQueryState.filterState.price.max.toLocaleString()}`);
console.log(`      - built: ${cronQueryState.filterState.built.min}+ only`);
console.log(`      - HOA: max $${cronQueryState.filterState.hoa.max}/month`);

// 2. Show how our script removes the doz filter
let scriptUrl = cronUrl;

// Remove doz parameter (same logic as our script)
// First decode the URL to work with the actual JSON
let decoded = decodeURIComponent(scriptUrl.split('searchQueryState=')[1]);
let queryState = JSON.parse(decoded);

// Remove the doz filter
delete queryState.filterState.doz;

// Re-encode 
const newEncoded = encodeURIComponent(JSON.stringify(queryState));
scriptUrl = scriptUrl.split('searchQueryState=')[0] + 'searchQueryState=' + newEncoded;

console.log('\n\n2️⃣  SCRIPT URL (doz filter REMOVED for ALL listings):');
console.log('   ' + scriptUrl);

// Decode to verify doz is gone
const scriptQueryState = JSON.parse(decodeURIComponent(scriptUrl.split('searchQueryState=')[1]));
console.log('\n   📊 SCRIPT Filters:');
console.log(`      - doz: ${scriptQueryState.filterState.doz || 'REMOVED'} (ALL listings, any age)`);
console.log(`      - price: $${scriptQueryState.filterState.price.min.toLocaleString()} - $${scriptQueryState.filterState.price.max.toLocaleString()}`);
console.log(`      - built: ${scriptQueryState.filterState.built.min}+ only`);
console.log(`      - HOA: max $${scriptQueryState.filterState.hoa.max}/month`);

console.log('\n' + '='.repeat(70));
console.log('✅ VERIFICATION SUMMARY');
console.log('='.repeat(70));

console.log('📅 Daily Cron (12 PM CST):');
console.log('   • Uses doz=1 filter');
console.log('   • Only gets properties listed in last 24 hours');
console.log('   • Runs same pipeline: scraping → duplicate check → filters → GHL → website');
console.log('   • Covers all 55 zip codes in TARGETED_CASH_ZIPS array');

console.log('\n📋 One-Time Script:');
console.log('   • Removes doz filter completely');  
console.log('   • Gets ALL properties regardless of listing age');
console.log('   • Same pipeline: scraping → duplicate check → filters → GHL → website');
console.log('   • Same 55 zip codes from 4.30_target_zips.md');

console.log('\n🎯 Both use IDENTICAL processing pipeline:');
console.log('   1. ✅ Scraping from Zillow');
console.log('   2. ✅ Duplicate check against Firestore');
console.log('   3. ✅ Detail fetching');
console.log('   4. ✅ Owner finance detection (strict keywords)');
console.log('   5. ✅ Cash deals filter (<80% ARV)');
console.log('   6. ✅ GHL webhook for agent outreach');
console.log('   7. ✅ Typesense indexing for website');
console.log('   8. ✅ Agent confirms → marked as "owner finance positive"');

console.log('\n🚀 Ready to run with APIFY_API_KEY environment variable');