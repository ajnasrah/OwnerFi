import * as dotenv from 'dotenv';
import { ApifyClient } from 'apify-client';

dotenv.config({ path: '.env.local' });

async function testApify() {
  console.log('\n🔍 TESTING APIFY CONNECTION\n');
  console.log('='.repeat(80));

  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    console.error('❌ APIFY_API_KEY not found in .env.local');
    process.exit(1);
  }

  console.log(`✅ APIFY_API_KEY found: ${apiKey.substring(0, 10)}...`);
  console.log('');

  try {
    const client = new ApifyClient({ token: apiKey });

    // Test 1: List user's actors
    console.log('📋 Test 1: Checking Apify account...');
    const user = await client.user('me').get();
    console.log(`✅ Connected as: ${user.username || 'Unknown'}`);
    console.log('');

    // Test 2: Check if the search actor exists
    console.log('📋 Test 2: Checking search actor (maxcopell/zillow-scraper)...');
    try {
      const actor = await client.actor('maxcopell/zillow-scraper').get();
      console.log(`✅ Actor found: ${actor.name}`);
      console.log(`   Version: ${actor.taggedBuilds?.latest || 'Unknown'}`);
      console.log('');
    } catch (error: any) {
      console.error('❌ Search actor not accessible');
      console.error(`   Error: ${error.message}`);
      console.log('');
    }

    // Test 3: Check detail scraper actor
    console.log('📋 Test 3: Checking detail scraper (maxcopell/zillow-detail-scraper)...');
    try {
      const actor = await client.actor('maxcopell/zillow-detail-scraper').get();
      console.log(`✅ Actor found: ${actor.name}`);
      console.log(`   Version: ${actor.taggedBuilds?.latest || 'Unknown'}`);
      console.log('');
    } catch (error: any) {
      console.error('❌ Detail scraper not accessible');
      console.error(`   Error: ${error.message}`);
      console.log('');
    }

    // Test 4: Try a minimal search run
    console.log('📋 Test 4: Testing minimal search run (1 result)...');
    const startTime = Date.now();

    const searchConfig = {
      searchUrls: [{
        url: 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-129.09672800572204%2C%22east%22%3A-50.522509255722056%2C%22south%22%3A-25.100328170509652%2C%22north%22%3A64.2375265423478%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A100000%2C%22max%22%3A750000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%22lot%22%3A%7B%22min%22%3Anull%2C%22max%22%3A435600%2C%22units%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%2214%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner+financing%5C%22+%2C+%5C%22seller+financing%5C%22+%2C+%5C%22owner+carry%5C%22+%2C+%5C%22seller+carry%5C%22+%2C+%5C%22financing+available%2Foffered%5C%22+%2C+%5C%22creative+financing%5C%22+%2C+%5C%22flexible+financing%5C%22%2C+%5C%22terms+available%5C%22%2C+%5C%22owner+terms%5C%22%22%7D%7D%2C%22isListVisible%22%3Atrue%7D'
      }],
      maxResults: 5,  // Just 5 for testing
      mode: 'pagination' as 'map' | 'pagination' | 'deep',
    };

    try {
      console.log('   Starting Apify run...');
      const run = await client.actor('maxcopell/zillow-scraper').call(searchConfig, {
        timeout: 120,  // 2 minute timeout
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (run.status === 'SUCCEEDED') {
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        console.log(`✅ Run succeeded in ${duration}s`);
        console.log(`   Found ${items.length} properties`);

        if (items.length > 0) {
          const sample: any = items[0];
          console.log(`\n   Sample property:`);
          console.log(`   Address: ${sample.address || 'N/A'}`);
          console.log(`   Price: ${sample.price || 'N/A'}`);
          console.log(`   URL: ${sample.detailUrl?.substring(0, 60)}...`);
        }
      } else {
        console.error(`❌ Run failed with status: ${run.status}`);
        console.log(`   Duration: ${duration}s`);
      }
    } catch (error: any) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`❌ Error running search: ${error.message}`);
      console.log(`   Duration: ${duration}s`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Apify connection test complete\n');

  } catch (error: any) {
    console.error(`\n❌ Failed to connect to Apify: ${error.message}\n`);
    process.exit(1);
  }
}

testApify()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
