/**
 * Quick test of Apify search
 */

import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testApify() {
  console.log('🧪 Testing Apify Zillow Scraper\n');

  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

  // Test 1: Original working search (owner finance nationwide)
  const ownerFinanceUrl = 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-123.82329050572206%2C%22east%22%3A-55.795946755722056%2C%22south%22%3A-18.62001504632672%2C%22north%22%3A61.02913536475284%7D%2C%22mapZoom%22%3A4%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A750000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A3750%7D%2C%22beds%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22baths%22%3A%7B%22min%22%3A1%2C%22max%22%3Anull%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22lot%22%3A%7B%22min%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner%20financing%5C%22%20%2C%20%5C%22seller%20financing%5C%22%20%2C%20%5C%22owner%20carry%5C%22%20%2C%20%5C%22seller%20carry%5C%22%20%2C%20%5C%22financing%20available%2Foffered%5C%22%20%2C%20%5C%22creative%20financing%5C%22%20%2C%20%5C%22flexible%20financing%5C%22%2C%20%5C%22terms%20available%5C%22%2C%20%5C%22owner%20terms%5C%22%22%7D%7D%2C%22isListVisible%22%3Atrue%7D';

  // Test 2: Simple nationwide search without owner financing keyword filter
  const simpleNationwideUrl = 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-123.82329050572206%2C%22east%22%3A-55.795946755722056%2C%22south%22%3A-18.62001504632672%2C%22north%22%3A61.02913536475284%7D%2C%22mapZoom%22%3A4%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22days%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22beds%22%3A%7B%22min%22%3A2%7D%2C%22baths%22%3A%7B%22min%22%3A1%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%7D%2C%22isListVisible%22%3Atrue%7D';

  // Test 3: Memphis search (original working)
  const memphisUrl = 'https://www.zillow.com/homes/for_sale/?category=SEMANTIC&searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-91.67713556830317%2C%22east%22%3A-89.44691095892817%2C%22south%22%3A34.04448627074044%2C%22north%22%3A36.477417577203184%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22max%22%3A500000%2C%22min%22%3A50000%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A9%2C%22customRegionId%22%3A%225f8096924aX1-CR1i1r231i2qe0e_1276cg%22%2C%22pagination%22%3A%7B%7D%2C%22usersSearchTerm%22%3A%22%22%7D';

  console.log('Testing simple nationwide search (sorted by newest)...\n');

  try {
    const run = await client.actor('maxcopell/zillow-scraper').call({
      searchUrls: [{ url: simpleNationwideUrl }],
      maxResults: 50,
      mode: 'pagination',
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`✅ Found ${items.length} properties\n`);

    if (items.length > 0) {
      console.log('Sample properties:');
      items.slice(0, 5).forEach((item: any, i: number) => {
        console.log(`\n${i + 1}. ${item.address || 'N/A'}`);
        console.log(`   Price: $${item.price?.toLocaleString() || 'N/A'}`);
        console.log(`   URL: ${item.detailUrl ? 'Yes' : 'No'}`);
        console.log(`   ZPID: ${item.zpid || 'N/A'}`);
        console.log(`   Agent: ${item.attributionInfo?.agentName || 'N/A'}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

testApify();
