import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const APIFY_TOKEN = process.env.APIFY_API_KEY!;

async function verifyOwnerFinance() {
  console.log('=== VERIFYING OWNER FINANCE IN DESCRIPTIONS ===\n');

  // Get 5 URLs from the search results
  const searchRes = await fetch(
    `https://api.apify.com/v2/datasets/9i1qNYmg5zsel8m0W/items?token=${APIFY_TOKEN}&limit=5`
  );
  const searchItems = await searchRes.json();

  const urls = searchItems.map((item: any) => item.detailUrl).filter(Boolean);

  console.log(`Fetching full details for ${urls.length} properties...\n`);

  // Use detail scraper to get descriptions
  const client = new ApifyClient({ token: APIFY_TOKEN });

  const run = await client.actor('maxcopell/zillow-detail-scraper').call({
    startUrls: urls.slice(0, 3).map((url: string) => ({ url })),
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  console.log(`Got ${items.length} detailed results:\n`);

  const ownerFinanceKeywords = [
    'owner financing', 'seller financing', 'owner carry', 'seller carry',
    'creative financing', 'flexible financing', 'terms available', 'owner terms',
    'rent to own', 'lease option', 'lease purchase', 'land contract',
    'contract for deed', 'owner will finance', 'seller will finance'
  ];

  for (const item of items) {
    const prop = item as any;
    const desc = (prop.description || prop.homeDescription || '').toLowerCase();

    console.log(`Address: ${prop.address || prop.streetAddress || 'N/A'}`);
    console.log(`Price: $${prop.price?.toLocaleString() || 'N/A'}`);
    console.log(`Status: ${prop.homeStatus || prop.listingStatus || 'N/A'}`);

    // Check for owner finance keywords
    const foundKeywords: string[] = [];
    for (const kw of ownerFinanceKeywords) {
      if (desc.includes(kw)) {
        foundKeywords.push(kw);
      }
    }

    if (foundKeywords.length > 0) {
      console.log(`✅ OWNER FINANCE KEYWORDS: ${foundKeywords.join(', ')}`);
    } else {
      console.log(`❌ NO OWNER FINANCE KEYWORDS FOUND`);
      console.log(`   Description preview: ${desc.substring(0, 200)}...`);
    }
    console.log('---\n');
  }
}

verifyOwnerFinance().catch(console.error);
