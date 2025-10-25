
import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new ApifyClient({ token: process.env.APIFY_API_KEY });
const testUrl = 'https://www.zillow.com/homedetails/102-N-Cedar-St-Celeste-TX-75423/116137149_zpid/';
const input = { startUrls: [{ url: testUrl }] };
const run = await client.actor('maxcopell/zillow-detail-scraper').call(input);
const { items } = await client.dataset(run.defaultDatasetId).listItems({ clean: false, limit: 1 });

console.log(JSON.stringify(items[0], null, 2));
