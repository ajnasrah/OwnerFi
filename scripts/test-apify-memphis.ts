/**
 * Quick test of Apify search with Memphis URL (known working)
 */

import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testApify() {
  console.log('🧪 Testing Apify with Memphis URL (known working)\n');

  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

  // Memphis search URL (original working)
  const memphisUrl = 'https://www.zillow.com/homes/for_sale/?category=SEMANTIC&searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-91.67713556830317%2C%22east%22%3A-89.44691095892817%2C%22south%22%3A34.04448627074044%2C%22north%22%3A36.477417577203184%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22max%22%3A500000%2C%22min%22%3A50000%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22doz%22%3A%7B%22value%22%3A%227%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A9%2C%22customRegionId%22%3A%225f8096924aX1-CR1i1r231i2qe0e_1276cg%22%2C%22pagination%22%3A%7B%7D%2C%22usersSearchTerm%22%3A%22%22%7D';

  console.log('Running Apify search for Memphis TN...\n');

  try {
    const run = await client.actor('maxcopell/zillow-scraper').call({
      searchUrls: [{ url: memphisUrl }],
      maxResults: 30,
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
        console.log(`   Phone: ${item.attributionInfo?.agentPhoneNumber || item.attributionInfo?.brokerPhoneNumber || 'N/A'}`);
      });
    } else {
      console.log('❌ No properties found! Apify might be having issues.');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

testApify();
