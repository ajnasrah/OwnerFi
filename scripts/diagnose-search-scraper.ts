import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

/**
 * Diagnose Search Scraper Issues
 */
async function diagnose() {
  console.log('\n🔍 SEARCH SCRAPER DIAGNOSIS\n');
  console.log('='.repeat(80));

  console.log('\n📋 ISSUE FOUND: FUNCTION_INVOCATION_TIMEOUT\n');

  console.log('The search scraper is configured to:');
  console.log('  1. Run Apify search for up to 500 properties');
  console.log('  2. For EACH property, query Firestore TWICE:');
  console.log('     - Check if URL exists in scraper_queue');
  console.log('     - Check if URL exists in zillow_imports');
  console.log('  3. Add new URLs to queue\n');

  console.log('⚠️  PROBLEM: With 500 properties, this means:');
  console.log('   - 1,000 database queries in a loop');
  console.log('   - Sequential, not batched');
  console.log('   - Exceeds 300 second (5 minute) timeout\n');

  console.log('='.repeat(80));
  console.log('\n🔧 SOLUTION OPTIONS:\n');

  console.log('Option 1: OPTIMIZE THE SEARCH SCRAPER (RECOMMENDED)');
  console.log('  - Batch fetch existing URLs from both collections');
  console.log('  - Compare in memory instead of 1000 queries');
  console.log('  - Should complete in <60 seconds\n');

  console.log('Option 2: REDUCE maxResults');
  console.log('  - Change from 500 to 100 properties per run');
  console.log('  - Less thorough but should work with current code\n');

  console.log('Option 3: REMOVE DUPLICATE CHECKS');
  console.log('  - Just add all to queue');
  console.log('  - Let queue processor handle duplicates');
  console.log('  - Fastest but may waste resources\n');

  console.log('='.repeat(80));
  console.log('\n📊 CURRENT SEARCH SCRAPER CONFIG:\n');

  console.log('Search URL: National Zillow search');
  console.log('Filters:');
  console.log('  - Price: $100,000 - $750,000');
  console.log('  - Beds: 1+');
  console.log('  - Baths: 1+');
  console.log('  - Listed: Last 14 days');
  console.log('  - Keywords: "owner financing", "seller financing", etc.');
  console.log('  - Mode: pagination');
  console.log('  - Max Results: 500\n');

  console.log('Schedule: Monday & Thursday @ 9 AM');
  console.log('Expected: ~300-500 new properties per run\n');

  console.log('='.repeat(80));
  console.log('\n🎯 ROOT CAUSE:\n');

  console.log('The cron IS running on schedule, but:');
  console.log('  ❌ It times out before completing');
  console.log('  ❌ No properties get added to queue');
  console.log('  ❌ No error is logged (silent failure)');
  console.log('  ❌ This has been happening for ~7 days\n');

  console.log('Last successful run was likely Nov 16 when you saw 254 properties');
  console.log('added over 3 days (Nov 14-16). Since then, all runs have timed out.\n');

  console.log('='.repeat(80));
  console.log('\n💡 NEXT STEPS:\n');

  console.log('1. Fix the search scraper code to batch queries');
  console.log('2. Test locally or with smaller maxResults');
  console.log('3. Deploy and monitor next scheduled run\n');

  console.log('Would you like me to:');
  console.log('  A) Optimize the search scraper code (batch queries)');
  console.log('  B) Reduce maxResults to 100 (quick fix)');
  console.log('  C) Both (optimize + safety limit)\n');
}

diagnose()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
