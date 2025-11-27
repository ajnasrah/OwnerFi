import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

dotenv.config({ path: '.env.local' });

const FAILED_URLS = [
  'https://www.zillow.com/homedetails/346-S-Marina-St-Prescott-AZ-86303/8162371_zpid/',
  'https://www.zillow.com/homedetails/5390-Us-Highway-441-SE-Okeechobee-FL-34974/43694091_zpid/',
  'https://www.zillow.com/homedetails/30417-N-42nd-Pl-Cave-Creek-AZ-85331/8023652_zpid/',
];

async function checkFailed() {
  console.log('=== CHECKING FAILED PROPERTIES ===\n');

  const client = new ApifyClient({ token: process.env.APIFY_API_KEY! });

  for (const url of FAILED_URLS) {
    console.log(`Checking: ${url}\n`);

    try {
      const run = await client.actor('maxcopell/zillow-scraper').call({
        startUrls: [{ url }],
        maxItems: 1,
      });

      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      if (items.length > 0) {
        const prop = items[0] as any;
        const desc = prop.description || '';

        console.log('Description:');
        console.log(desc.substring(0, 500));
        console.log('...\n');

        const result = hasStrictOwnerFinancing(desc);
        console.log('Filter result:', result.passes ? '✅ PASS' : '❌ FAIL');
        console.log('Matched keywords:', result.matchedKeywords.join(', ') || 'none');

        // Look for any financing-related words
        const lowerDesc = desc.toLowerCase();
        const words = ['owner', 'seller', 'financing', 'finance', 'carry', 'terms', 'creative', 'flexible'];
        const found = words.filter(w => lowerDesc.includes(w));
        console.log('Financing words found:', found.join(', ') || 'none');
        console.log('\n---\n');
      }
    } catch (e: any) {
      console.log('Error fetching:', e.message);
    }
  }
}

checkFailed();
