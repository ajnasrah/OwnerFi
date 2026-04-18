/**
 * Diagnostic: run the search scraper on ONE zip URL (doz=7) and count
 * what comes back. Tells us whether Apify is respecting the filters
 * or returning everything regardless.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { ApifyClient } from 'apify-client';
import { buildAgentOutreachZipUrl } from '../src/lib/scraper-v2/search-config';

async function main() {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) throw new Error('APIFY_API_KEY missing');
  const client = new ApifyClient({ token: apiKey });

  const zip = process.argv[2] || '38125';
  const dozRaw = process.argv[3];
  const doz = dozRaw ? Number(dozRaw) : undefined;
  const url = buildAgentOutreachZipUrl(
    zip,
    doz !== undefined ? { dozDays: doz as 1 | 7 | 14 | 30 | 90 } : {}
  );

  console.log(`zip: ${zip}`);
  console.log(`doz: ${doz ?? '(any)'}`);
  console.log(`URL length: ${url.length}`);
  console.log(`URL: ${url}\n`);

  const started = Date.now();
  console.log('⏳ starting search actor (maxcopell/zillow-scraper)...');
  const run = await client.actor('maxcopell/zillow-scraper').call({
    searchUrls: [{ url }],
    maxResults: 500,
    mode: 'pagination',
  });
  console.log(`✅ actor run finished in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`   defaultDatasetId: ${run.defaultDatasetId}`);

  // Just get the first page (500) to see what we got
  const page = await client.dataset(run.defaultDatasetId).listItems({ limit: 500 });
  console.log(`\n📦 items returned: ${page.items.length} (total in dataset: ${page.total})`);

  // Show top-level structure of first 3 items
  for (let i = 0; i < Math.min(3, page.items.length); i++) {
    const it = page.items[i] as any;
    console.log(`\n--- item ${i} ---`);
    console.log(`  zpid       : ${it.zpid}`);
    console.log(`  address    : ${it.address}`);
    console.log(`  city/zip   : ${it.city} ${it.addressZipcode || it.zipcode}`);
    console.log(`  price      : ${it.price || it.unformattedPrice}`);
    console.log(`  homeType   : ${it.hdpData?.homeInfo?.homeType || it.homeType}`);
    console.log(`  listedOn   : ${it.variableData?.text || it.listingStatus || '?'}`);
    console.log(`  daysOnZillow: ${it.hdpData?.homeInfo?.daysOnZillow ?? it.daysOnZillow ?? '?'}`);
    console.log(`  keys       : ${Object.keys(it).slice(0, 25).join(', ')}`);
  }

  // If > 1 item, histogram by daysOnZillow
  if (page.items.length > 1) {
    const buckets = { '0-1': 0, '2-7': 0, '8-14': 0, '15-30': 0, '>30': 0, unknown: 0 };
    for (const it of page.items as any[]) {
      const d = it.hdpData?.homeInfo?.daysOnZillow ?? it.daysOnZillow;
      if (d === undefined || d === null) buckets.unknown++;
      else if (d <= 1) buckets['0-1']++;
      else if (d <= 7) buckets['2-7']++;
      else if (d <= 14) buckets['8-14']++;
      else if (d <= 30) buckets['15-30']++;
      else buckets['>30']++;
    }
    console.log(`\n📊 daysOnZillow histogram:`);
    for (const [k, v] of Object.entries(buckets)) console.log(`   ${k.padEnd(10)} : ${v}`);
  }

  // Also histogram by zipcode to see if bbox bleed is happening
  const zipHist: Record<string, number> = {};
  for (const it of page.items as any[]) {
    const z = it.addressZipcode || it.zipcode || it.hdpData?.homeInfo?.zipcode || '?';
    zipHist[z] = (zipHist[z] || 0) + 1;
  }
  console.log(`\n📊 zipcode histogram (top 10):`);
  const top = Object.entries(zipHist).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [z, n] of top) console.log(`   ${z.padEnd(6)} : ${n}`);

  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
