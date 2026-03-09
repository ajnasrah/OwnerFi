/**
 * Run user's custom regional search and find active properties NOT in our database
 * Filters: under $300K, single family only, built 1930+
 *
 * Usage: npx tsx scripts/find-missing-local-v2.ts
 */

const admin = require('firebase-admin');
const { ApifyClient } = require('apify-client');
require('dotenv').config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

const SEARCH_URL = 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-95.09388361517817%2C%22east%22%3A-86.03016291205317%2C%22south%22%3A29.642489219132873%2C%22north%22%3A40.532398383186695%7D%2C%22mapZoom%22%3A7%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22pmf%22%3A%7B%22value%22%3Atrue%7D%2C%22pf%22%3A%7B%22value%22%3Atrue%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%7D%2C%22isListVisible%22%3Atrue%2C%22customRegionId%22%3A%22982d669a94X1-CR1xukwe2r25ifv_17b6s0%22%7D';

async function main() {
  console.log('=== Finding Missing Local Properties ===');
  console.log('Filters: <$300K | Single Family | Built 1930+');
  console.log('Region: Custom (wider AR/TN/MS/LA area)\n');

  // Step 1: Run Apify search
  console.log('[STEP 1] Running Apify search scraper...');
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

  const searchInput = {
    searchUrls: [{ url: SEARCH_URL }],
    maxResults: 10000,
    mode: 'pagination' as const,
  };

  const run = await client.actor('maxcopell/zillow-scraper').call(searchInput, {
    waitSecs: 900,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`[SEARCH] Found ${items.length} total properties on Zillow\n`);

  if (items.length === 0) {
    console.log('No properties found. Exiting.');
    process.exit(0);
  }

  // Step 2: Filter by yearBuilt >= 1930 (where available)
  const filtered = items.filter((p: any) => {
    const yearBuilt = p.yearBuilt || 0;
    // If yearBuilt is known and < 1930, skip
    if (yearBuilt > 0 && yearBuilt < 1930) return false;
    return true;
  });

  console.log(`[FILTER] After yearBuilt filter: ${filtered.length} properties (removed ${items.length - filtered.length} pre-1930)`);

  // Step 3: Check which ones we already have
  console.log('[STEP 2] Checking against database...');

  const zpids = filtered
    .map((p: any) => p.zpid)
    .filter((z: any) => z != null)
    .map((z: any) => typeof z === 'string' ? parseInt(z, 10) : z);

  const uniqueZpids = [...new Set(zpids)] as number[];
  console.log(`Unique ZPIDs to check: ${uniqueZpids.length}`);

  const existingZpids = new Set<number>();

  for (let i = 0; i < uniqueZpids.length; i += 100) {
    const batch = uniqueZpids.slice(i, i + 100);
    const docRefs = batch.map((z: number) => db.collection('properties').doc(`zpid_${z}`));
    const snapshots = await db.getAll(...docRefs);
    snapshots.forEach((snap: any, idx: number) => {
      if (snap.exists) existingZpids.add(batch[idx]);
    });
    if (i % 1000 === 0 && i > 0) console.log(`  Checked ${i}/${uniqueZpids.length}...`);
  }

  console.log(`Already in database: ${existingZpids.size}`);

  const missing = filtered.filter((p: any) => {
    const zpid = typeof p.zpid === 'string' ? parseInt(p.zpid, 10) : p.zpid;
    return zpid && !existingZpids.has(zpid);
  });

  // Group by state
  const byState: Record<string, number> = {};
  missing.forEach((p: any) => {
    const addr = p.address || '';
    // Try to extract state from address (last part before zip)
    const parts = addr.split(',');
    let state = 'Unknown';
    if (parts.length >= 2) {
      const stateZip = parts[parts.length - 1].trim();
      const stateMatch = stateZip.match(/^([A-Z]{2})/);
      if (stateMatch) state = stateMatch[1];
    }
    byState[state] = (byState[state] || 0) + 1;
  });

  // Price buckets
  const priceBuckets = { under50: 0, '50_100': 0, '100_150': 0, '150_200': 0, '200_250': 0, '250_300': 0, zero: 0 };
  missing.forEach((p: any) => {
    const price = typeof p.price === 'string' ? parseInt(p.price.replace(/[^0-9]/g, ''), 10) : (p.price || 0);
    if (price === 0) priceBuckets.zero++;
    else if (price < 50000) priceBuckets.under50++;
    else if (price < 100000) priceBuckets['50_100']++;
    else if (price < 150000) priceBuckets['100_150']++;
    else if (price < 200000) priceBuckets['150_200']++;
    else if (price < 250000) priceBuckets['200_250']++;
    else priceBuckets['250_300']++;
  });

  console.log(`\n========================================`);
  console.log(`RESULTS`);
  console.log(`========================================`);
  console.log(`Total on Zillow: ${items.length}`);
  console.log(`Already in DB: ${existingZpids.size}`);
  console.log(`MISSING: ${missing.length}`);
  console.log(`\nBy State:`);
  Object.entries(byState).sort((a, b) => b[1] - a[1]).forEach(([state, count]) => {
    console.log(`  ${state}: ${count}`);
  });
  console.log(`\nBy Price Range:`);
  console.log(`  $0 (coming soon/auction): ${priceBuckets.zero}`);
  console.log(`  Under $50K: ${priceBuckets.under50}`);
  console.log(`  $50K-$100K: ${priceBuckets['50_100']}`);
  console.log(`  $100K-$150K: ${priceBuckets['100_150']}`);
  console.log(`  $150K-$200K: ${priceBuckets['150_200']}`);
  console.log(`  $200K-$250K: ${priceBuckets['200_250']}`);
  console.log(`  $250K-$300K: ${priceBuckets['250_300']}`);

  // With zestimate
  const withZest = missing.filter((p: any) => p.zestimate && p.zestimate > 0);
  const under80 = withZest.filter((p: any) => {
    const price = typeof p.price === 'string' ? parseInt(p.price.replace(/[^0-9]/g, ''), 10) : (p.price || 0);
    return price > 0 && price < p.zestimate * 0.8;
  });
  console.log(`\nWith Zestimate: ${withZest.length}`);
  console.log(`Under 80% Zestimate (potential cash deals): ${under80.length}`);

  console.log(`\n========================================`);

  process.exit(0);
}

main().catch((e: any) => { console.error('FATAL:', e.message); process.exit(1); });
