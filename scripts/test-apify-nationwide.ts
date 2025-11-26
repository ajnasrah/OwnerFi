/**
 * Test nationwide search URL formats
 */

import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testApify() {
  console.log('🧪 Testing Nationwide Search URLs\n');

  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

  // Format 1: Basic US search sorted by newest, last 7 days
  const basicUSUrl = 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-124.848974%2C%22east%22%3A-66.885444%2C%22south%22%3A24.396308%2C%22north%22%3A49.384358%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22days%22%7D%2C%22price%22%3A%7B%22min%22%3A50000%2C%22max%22%3A500000%7D%2C%22beds%22%3A%7B%22min%22%3A2%7D%2C%22baths%22%3A%7B%22min%22%3A1%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%2C%22sf%22%3A%7B%22value%22%3Atrue%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A4%7D';

  console.log('Testing basic US search...\n');

  try {
    const run = await client.actor('maxcopell/zillow-scraper').call({
      searchUrls: [{ url: basicUSUrl }],
      maxResults: 50,
      mode: 'pagination',
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`✅ Found ${items.length} properties\n`);

    if (items.length > 0) {
      // Count by state
      const byState: Record<string, number> = {};
      items.forEach((item: any) => {
        const state = item.addressState || 'Unknown';
        byState[state] = (byState[state] || 0) + 1;
      });

      console.log('Properties by state:');
      Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([state, count]) => {
        console.log(`   ${state}: ${count}`);
      });

      console.log('\nSample properties:');
      items.slice(0, 5).forEach((item: any, i: number) => {
        console.log(`\n${i + 1}. ${item.address || 'N/A'}`);
        console.log(`   Price: $${item.price?.toLocaleString() || 'N/A'}`);
        console.log(`   State: ${item.addressState || 'N/A'}`);
        console.log(`   ZPID: ${item.zpid || 'N/A'}`);
      });
    } else {
      console.log('❌ No properties found!');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

testApify();
