import * as dotenv from 'dotenv';
import { ApifyClient } from 'apify-client';

dotenv.config({ path: '.env.local' });

const apiKey = process.env.APIFY_API_KEY;
console.log('APIFY_API_KEY set:', apiKey ? 'YES (length: ' + apiKey.length + ')' : 'NO');

if (!apiKey) {
  console.log('No API key - cannot test');
  process.exit(1);
}

const client = new ApifyClient({ token: apiKey });

async function test() {
  console.log('\n=== TESTING APIFY CONNECTION ===\n');

  // Check account info
  try {
    const user = await client.user().get();
    console.log('Account:', user.username);
    console.log('Plan:', (user as any).plan?.id || 'unknown');
  } catch (e: any) {
    console.log('Could not get user info:', e.message);
  }

  // Check recent runs
  console.log('\n=== RECENT ACTOR RUNS (last 10) ===');
  try {
    const runs = await client.runs().list({ limit: 10, desc: true });

    if (runs.items.length === 0) {
      console.log('No recent runs found');
    } else {
      runs.items.forEach((run, i) => {
        const startDate = run.startedAt ? new Date(run.startedAt).toISOString() : 'unknown';
        console.log((i + 1) + '. ' + run.actId);
        console.log('   Status: ' + run.status);
        console.log('   Started: ' + startDate);
        if (run.stats) {
          console.log('   Items: ' + ((run.stats as any).outputItems || 'unknown'));
        }
      });
    }
  } catch (e: any) {
    console.log('Error listing runs:', e.message);
  }

  // Check if zillow scrapers exist
  console.log('\n=== CHECKING ZILLOW SCRAPERS ===');
  try {
    const searchScraper = await client.actor('maxcopell/zillow-scraper').get();
    console.log('Search scraper (maxcopell/zillow-scraper):', searchScraper ? 'FOUND' : 'NOT FOUND');
  } catch (e: any) {
    console.log('Search scraper error:', e.message);
  }

  try {
    const detailScraper = await client.actor('maxcopell/zillow-detail-scraper').get();
    console.log('Detail scraper (maxcopell/zillow-detail-scraper):', detailScraper ? 'FOUND' : 'NOT FOUND');
  } catch (e: any) {
    console.log('Detail scraper error:', e.message);
  }
}

test()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
