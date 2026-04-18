/**
 * Smoke test for buildAgentOutreachZipUrl.
 * Decodes the query state so we can visually verify filters.
 */

import { buildAgentOutreachZipUrl, TARGETED_CASH_ZIPS } from '../src/lib/scraper-v2/search-config';

function decode(url: string) {
  const m = url.match(/searchQueryState=(.+)$/);
  if (!m) throw new Error('no searchQueryState');
  return JSON.parse(decodeURIComponent(m[1]));
}

console.log(`Total target zips: ${TARGETED_CASH_ZIPS.length}\n`);

// Test 1: doz=1 (daily cron)
{
  const url = buildAgentOutreachZipUrl('38125', { dozDays: 1 });
  const qs = decode(url);
  console.log('--- doz=1 (daily cron) for zip 38125 ---');
  console.log('mapBounds    :', JSON.stringify(qs.mapBounds));
  console.log('filterState  :', JSON.stringify(qs.filterState));
  console.log('mf key set?  :', 'mf' in qs.filterState, '(should be false → MF included)');
  console.log('doz          :', qs.filterState.doz);
  console.log();
}

// Test 2: doz=7 (3-day backfill)
{
  const url = buildAgentOutreachZipUrl('40215', { dozDays: 7 });
  const qs = decode(url);
  console.log('--- doz=7 (3-day backfill) for zip 40215 Louisville ---');
  console.log('doz          :', qs.filterState.doz);
  console.log('price        :', qs.filterState.price);
  console.log();
}

// Test 3: no doz (all-time MF)
{
  const url = buildAgentOutreachZipUrl('44306');
  const qs = decode(url);
  console.log('--- no doz (all-active) for zip 44306 Akron ---');
  console.log('doz key set? :', 'doz' in qs.filterState, '(should be false → any time)');
  console.log('price        :', qs.filterState.price);
  console.log();
}

// Test 4: unknown zip should throw
try {
  buildAgentOutreachZipUrl('99999');
  console.log('❌ unknown zip did NOT throw');
} catch (e: any) {
  console.log('✅ unknown zip throws:', e.message);
}

// Verify all 59 targeted zips have centroids (no throws)
let ok = 0;
for (const z of TARGETED_CASH_ZIPS) {
  try {
    buildAgentOutreachZipUrl(z, { dozDays: 1 });
    ok++;
  } catch (e: any) {
    console.log(`❌ ${z}: ${e.message}`);
  }
}
console.log(`\n✅ All ${ok}/${TARGETED_CASH_ZIPS.length} zips resolve to a URL`);
