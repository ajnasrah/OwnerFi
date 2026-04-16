import * as dotenv from 'dotenv';
import { ApifyClient } from 'apify-client';

dotenv.config({ path: '.env.local' });

const DETAIL_ACTOR = 'maxcopell/zillow-detail-scraper';
const URL = 'https://www.zillow.com/homedetails/668-Vinson-Rd-Hernando-MS-38632/313810057_zpid/';

async function main() {
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

  console.log(`Re-scraping: ${URL}\n`);

  const run = await client.actor(DETAIL_ACTOR).start({
    startUrls: [{ url: URL }],
  });
  console.log(`Run started: ${run.id}`);

  const finished = await client.run(run.id).waitForFinish({ waitSecs: 300 });
  console.log(`Run finished: ${finished.status}\n`);

  if (finished.status !== 'SUCCEEDED') {
    console.error('Run failed');
    process.exit(1);
  }

  const { items } = await client.dataset(finished.defaultDatasetId).listItems();
  console.log(`Got ${items.length} items\n`);

  for (const raw of items as any[]) {
    console.log('=== Pricing fields ===');
    console.log('price:', raw.price);
    console.log('listPrice:', raw.listPrice);
    console.log('zestimate:', raw.zestimate);
    console.log('homeValue:', raw.homeValue);
    console.log('estimate:', raw.estimate);
    console.log('rentZestimate:', raw.rentZestimate);
    console.log('hideZestimate:', raw.hideZestimate);
    console.log('homeValues:', JSON.stringify(raw.homeValues));
    console.log('zestimateHighPercent:', raw.zestimateHighPercent);
    console.log('zestimateLowPercent:', raw.zestimateLowPercent);
    console.log('\n=== Status / type ===');
    console.log('homeStatus:', raw.homeStatus);
    console.log('homeType:', raw.homeType);
    console.log('\n=== Address ===');
    console.log('streetAddress:', raw.streetAddress || raw.address);
    console.log('city/state/zip:', raw.city, raw.state, raw.zipcode);
    console.log('\n=== resoFacts.priceHistory[0] ===');
    if (Array.isArray(raw.priceHistory)) {
      console.log(raw.priceHistory.slice(0, 3));
    }
    console.log('\n=== Raw keys ===');
    console.log(Object.keys(raw).sort().join(', '));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
