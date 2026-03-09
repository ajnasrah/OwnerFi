/**
 * Run regional search and find active properties NOT in our database
 * Filters: under $300K, single family only, built 1930+
 *
 * Usage: npx tsx scripts/find-missing-local.ts
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

// Regional search URL modified: price max $300K, single family only, no doz limit (all active)
// Based on the existing regional bounds (AR/TN area)
const SEARCH_URL = 'https://www.zillow.com/homes/for_sale/?searchQueryState=' + encodeURIComponent(JSON.stringify({
  isMapVisible: true,
  mapBounds: {
    west: -93.00098810736567,
    east: -88.12305841986567,
    south: 33.303923989315145,
    north: 37.189660587627294,
  },
  mapZoom: 9,
  filterState: {
    sort: { value: "globalrelevanceex" },
    nc: { value: false },
    price: { max: 300000, min: 0 },
    "55plus": { value: "e" },
    // No doz filter - get ALL active listings
    pf: { value: true },
    pmf: { value: true },
    // Single family only
    con: { value: false },  // exclude condos
    apa: { value: false },  // exclude apartments
    manu: { value: false }, // exclude manufactured
    land: { value: false }, // exclude land
    tow: { value: false },  // exclude townhouses
    mf: { value: false },   // exclude multi-family
  },
  isListVisible: true,
  customRegionId: "f6068695e6X1-CRor2wysttztwe_tcbal",
  pagination: {},
  usersSearchTerm: "",
}));

async function main() {
  console.log('=== Finding Missing Local Properties ===');
  console.log('Filters: <$300K | Single Family | Built 1930+');
  console.log('Region: AR/TN area\n');

  // Step 1: Run Apify search
  console.log('[STEP 1] Running Apify search scraper...');
  const client = new ApifyClient({ token: process.env.APIFY_API_KEY });

  const searchInput = {
    searchUrls: [{ url: SEARCH_URL }],
    maxResults: 5000,
    mode: 'pagination' as const,
  };

  const run = await client.actor('maxcopell/zillow-scraper').call(searchInput, {
    waitSecs: 600,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`[SEARCH] Found ${items.length} total properties on Zillow\n`);

  if (items.length === 0) {
    console.log('No properties found. Exiting.');
    process.exit(0);
  }

  // Step 2: Filter by yearBuilt >= 1930 and single family
  const filtered = items.filter((p: any) => {
    const yearBuilt = p.yearBuilt || 0;
    const homeType = (p.homeType || '').toUpperCase();
    const price = typeof p.price === 'string' ? parseInt(p.price.replace(/[^0-9]/g, ''), 10) : (p.price || 0);

    // Must be 1930+
    if (yearBuilt > 0 && yearBuilt < 1930) return false;

    // Must be single family (or unknown - search results may not have homeType)
    if (homeType && homeType !== 'SINGLE_FAMILY' && homeType !== 'HOUSE') return false;

    // Price under 300K (double check)
    if (price > 300000) return false;

    return true;
  });

  console.log(`[FILTER] After yearBuilt/homeType filter: ${filtered.length} properties`);

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
  }

  console.log(`Already in database: ${existingZpids.size}`);

  // Step 4: Show missing properties
  const missing = filtered.filter((p: any) => {
    const zpid = typeof p.zpid === 'string' ? parseInt(p.zpid, 10) : p.zpid;
    return zpid && !existingZpids.has(zpid);
  });

  console.log(`\n========================================`);
  console.log(`MISSING FROM DATABASE: ${missing.length}`);
  console.log(`========================================\n`);

  if (missing.length === 0) {
    console.log('All matching properties are already in the database!');
    process.exit(0);
  }

  // Sort by price
  missing.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));

  // Print summary
  console.log('Address                                    | Price      | Year | Beds/Bath | Zestimate');
  console.log('-'.repeat(95));

  missing.forEach((p: any) => {
    const addr = (p.address || p.streetAddress || 'Unknown').substring(0, 42).padEnd(42);
    const price = ('$' + (p.price || 0).toLocaleString()).padEnd(10);
    const year = String(p.yearBuilt || '?').padEnd(4);
    const beds = `${p.bedrooms || '?'}/${p.bathrooms || '?'}`.padEnd(9);
    const zest = p.zestimate ? '$' + p.zestimate.toLocaleString() : 'N/A';
    console.log(`${addr} | ${price} | ${year} | ${beds} | ${zest}`);
  });

  // Stats
  const withZestimate = missing.filter((p: any) => p.zestimate && p.zestimate > 0);
  const under80pct = withZestimate.filter((p: any) => p.price < p.zestimate * 0.8);

  console.log(`\n--- Stats ---`);
  console.log(`Total missing: ${missing.length}`);
  console.log(`With Zestimate: ${withZestimate.length}`);
  console.log(`Under 80% of Zestimate (cash deals): ${under80pct.length}`);
  console.log(`Average price: $${Math.round(missing.reduce((s: number, p: any) => s + (p.price || 0), 0) / missing.length).toLocaleString()}`);

  process.exit(0);
}

main().catch((e: any) => { console.error('FATAL:', e.message); process.exit(1); });
