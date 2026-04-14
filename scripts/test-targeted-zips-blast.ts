/**
 * One-time test: pull EVERY active listing in the 21 targeted zips that
 * matches the cash-deal filter ($60k–$150k, mp ≤ $55k, SFR only — NO
 * days-on-Zillow restriction), then blast every result to GHL.
 *
 * Differences from the daily cron (`src/app/api/v2/scraper/run`):
 *  - No dedupe against Firestore — sends everything, even properties
 *    already in the DB.
 *  - No filter/save/typesense steps — just Apify search → GHL webhook.
 *  - Uses the shared TARGETED_CASH_ZIPS so zip list stays in one place.
 *
 * Usage:
 *   npx tsx scripts/test-targeted-zips-blast.ts --dry-run    # print only
 *   npx tsx scripts/test-targeted-zips-blast.ts              # send to GHL
 *   npx tsx scripts/test-targeted-zips-blast.ts --limit=50   # cap results
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { runSearchScraper } from '../src/lib/scraper-v2/apify-client';
import { sendBatchToGHLWebhook, toGHLPayload } from '../src/lib/scraper-v2/ghl-webhook';
import { TARGETED_CASH_ZIPS, buildZipSearchUrl } from '../src/lib/scraper-v2/search-config';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const arg = process.argv.find(a => a.startsWith('--limit='));
  return arg ? parseInt(arg.split('=')[1], 10) : undefined;
})();
const ZIPS_OVERRIDE = (() => {
  const arg = process.argv.find(a => a.startsWith('--zips='));
  return arg ? arg.split('=')[1].split(',').map(z => z.trim()).filter(Boolean) : undefined;
})();

async function main() {
  const zips = ZIPS_OVERRIDE ?? TARGETED_CASH_ZIPS;
  console.log('='.repeat(60));
  console.log('TARGETED ZIPS — ONE-TIME GHL BLAST');
  console.log('='.repeat(60));
  console.log(`Zips: ${zips.length}${ZIPS_OVERRIDE ? ' (override)' : ''}`);
  console.log(`Dry run: ${DRY_RUN}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);

  const urls = zips.map(zip => buildZipSearchUrl(zip));

  console.log('\n[APIFY] Running search across all 21 zips...');
  const results = await runSearchScraper(urls, {
    maxResults: 2500,
    mode: 'pagination',
  });

  console.log(`[APIFY] Total results: ${results.length}`);

  // Zillow mapBounds bleed into neighboring zips — restrict to selected zips.
  const allowedZips = new Set(zips);
  const inTargetZips = results.filter(r => {
    const zip = String((r as any).zipcode ?? (r as any).addressZipcode ?? '');
    return zip && allowedZips.has(zip);
  });
  console.log(`[ZIP FILTER] In target zips: ${inTargetZips.length} (dropped ${results.length - inTargetZips.length})`);

  // Dedupe by zpid (some zips may overlap or return dupes)
  const byZpid = new Map<string, typeof inTargetZips[number]>();
  for (const r of inTargetZips) {
    const key = String(r.zpid ?? r.detailUrl ?? r.url ?? '');
    if (key && !byZpid.has(key)) byZpid.set(key, r);
  }
  let unique = Array.from(byZpid.values());
  console.log(`[DEDUPE] Unique listings: ${unique.length}`);

  if (LIMIT) unique = unique.slice(0, LIMIT);

  // Per-zip breakdown
  const byZip: Record<string, number> = {};
  for (const r of unique) {
    const zip = String((r as any).zipcode ?? (r as any).addressZipcode ?? 'unknown');
    byZip[zip] = (byZip[zip] || 0) + 1;
  }
  console.log('\n[PER-ZIP COUNTS]');
  Object.entries(byZip)
    .sort((a, b) => b[1] - a[1])
    .forEach(([zip, count]) => console.log(`  ${zip}: ${count}`));

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Sample payloads (first 3):');
    for (const r of unique.slice(0, 3)) {
      const payload = toGHLPayload({
        zpid: Number(r.zpid),
        streetAddress: r.streetAddress,
        city: r.city,
        state: r.state,
        zipcode: (r as any).zipcode,
        price: typeof r.price === 'string' ? parseInt(r.price, 10) : r.price,
        estimate: (r as any).zestimate,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        livingArea: r.livingArea,
        yearBuilt: r.yearBuilt,
        homeType: r.homeType,
        zillowUrl: r.detailUrl || r.url,
        imgSrc: r.imgSrc,
      });
      console.log(JSON.stringify(payload, null, 2));
    }
    console.log(`\n[DRY RUN] Would send ${unique.length} properties to GHL.`);
    return;
  }

  // Build GHL payloads
  const payloads = unique
    .filter(r => r.zpid)
    .map(r => toGHLPayload({
      zpid: Number(r.zpid),
      streetAddress: r.streetAddress,
      city: r.city,
      state: r.state,
      zipcode: (r as any).zipcode,
      price: typeof r.price === 'string' ? parseInt(r.price, 10) : r.price,
      estimate: (r as any).zestimate,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      livingArea: r.livingArea,
      yearBuilt: r.yearBuilt,
      homeType: r.homeType,
      zillowUrl: r.detailUrl || r.url,
      imgSrc: r.imgSrc,
    }));

  console.log(`\n[GHL] Sending ${payloads.length} properties...`);
  const result = await sendBatchToGHLWebhook(payloads, {
    delayMs: 100,
    onProgress: (sent, total) => {
      if (sent % 25 === 0 || sent === total) {
        console.log(`  Progress: ${sent}/${total}`);
      }
    },
  });

  console.log('\n' + '='.repeat(60));
  console.log(`[DONE] Sent: ${result.sent}, Failed: ${result.failed}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
