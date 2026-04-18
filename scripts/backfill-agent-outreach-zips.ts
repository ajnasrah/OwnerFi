/**
 * Backfill agent_outreach_queue by running a fresh Zillow scrape across
 * every TARGETED_CASH_ZIPS zip (one URL per zip via buildAgentOutreachZipUrl).
 *
 * Two common modes:
 *   --doz 7          catch up on listings posted in last N days (1|7|14|30|90)
 *   --only-mf        include ONLY multi-family listings (no doz filter by default)
 *
 * Schema matches src/app/api/cron/run-agent-outreach-scraper/route.ts so the
 * existing hourly process-agent-outreach-queue cron drains identically.
 *
 * Gates: pass --dry-run to preview, or --confirm to actually enqueue.
 * A non-dry run writes to agent_outreach_queue → outbound SMS via GHL.
 *
 * Examples:
 *   # preview last-7-day catch-up across 59 zips (all property types)
 *   npx tsx scripts/backfill-agent-outreach-zips.ts --doz 7 --dry-run
 *
 *   # actually enqueue last 7 days
 *   npx tsx scripts/backfill-agent-outreach-zips.ts --doz 7 --confirm
 *
 *   # preview every currently-active multi-family listing in the 59 zips
 *   npx tsx scripts/backfill-agent-outreach-zips.ts --only-mf --dry-run
 *
 *   # actually enqueue it
 *   npx tsx scripts/backfill-agent-outreach-zips.ts --only-mf --confirm
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { ApifyClient } from 'apify-client';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { TARGETED_CASH_ZIPS, buildAgentOutreachZipUrl } from '../src/lib/scraper-v2/search-config';
import { hasStrictOwnerfinancing } from '../src/lib/owner-financing-filter-strict';
import { hasNegativeKeywords } from '../src/lib/negative-keywords';
import { normalizePhone, isValidPhone } from '../src/lib/phone-utils';

/**
 * Apify's default `listItems()` pulls the full dataset as one JSON blob.
 * With big detail responses this exceeds Node's max string length (~512MB)
 * and throws ERR_STRING_TOO_LONG. Paginate in fixed-size pages instead.
 */
async function fetchAllDatasetItems(
  client: ApifyClient,
  datasetId: string,
  pageSize = 500
): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  while (true) {
    const page = await client.dataset(datasetId).listItems({ limit: pageSize, offset });
    if (page.items.length === 0) break;
    all.push(...page.items);
    if (page.items.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

type Cli = {
  dryRun: boolean;
  confirm: boolean;
  dozDays?: 1 | 7 | 14 | 30 | 90;
  onlyMultiFamily: boolean;
  maxPerZip: number;
  detailCap: number;
};

function parseArgs(): Cli {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const dozStr = get('--doz');
  let dozDays: Cli['dozDays'];
  if (dozStr) {
    const n = Number(dozStr);
    if (![1, 7, 14, 30, 90].includes(n)) {
      throw new Error(`--doz must be one of 1,7,14,30,90 — got ${dozStr}`);
    }
    dozDays = n as Cli['dozDays'];
  }
  return {
    dryRun: argv.includes('--dry-run'),
    confirm: argv.includes('--confirm'),
    dozDays,
    onlyMultiFamily: argv.includes('--only-mf'),
    maxPerZip: Number(get('--max-per-zip') ?? 40),
    detailCap: Number(get('--detail-cap') ?? 500),
  };
}

async function main() {
  const cli = parseArgs();
  if (!cli.dryRun && !cli.confirm) {
    console.error('Refusing to run: pass --dry-run to preview, or --confirm to actually enqueue.');
    console.error('Flags: [--doz N] [--only-mf] [--max-per-zip N] [--detail-cap N]');
    process.exit(1);
  }

  console.log(`\n=== agent-outreach backfill ===`);
  console.log(`mode             : ${cli.dryRun ? 'DRY RUN' : 'CONFIRMED (will write)'}`);
  console.log(`doz (days)       : ${cli.dozDays ?? 'any'}`);
  console.log(`only multi-family: ${cli.onlyMultiFamily}`);
  console.log(`max per zip      : ${cli.maxPerZip}`);
  console.log(`detail cap       : ${cli.detailCap}`);
  console.log(`zips             : ${TARGETED_CASH_ZIPS.length}\n`);

  const apifyToken = process.env.APIFY_API_KEY;
  if (!apifyToken) throw new Error('APIFY_API_KEY missing');
  const client = new ApifyClient({ token: apifyToken });
  const { db } = getFirebaseAdmin();

  const dozOpt = cli.dozDays !== undefined ? { dozDays: cli.dozDays } : {};
  const searchUrls = TARGETED_CASH_ZIPS.map(zip => buildAgentOutreachZipUrl(zip, dozOpt));

  console.log(`🔍 Step 1: search scraper (${searchUrls.length} urls)...`);
  const searchRun = await client.actor('maxcopell/zillow-scraper').call({
    searchUrls: searchUrls.map(url => ({ url })),
    maxResults: cli.maxPerZip * searchUrls.length,
    mode: 'pagination',
  });
  const searchItems = await fetchAllDatasetItems(client, searchRun.defaultDatasetId);
  console.log(`   search returned ${searchItems.length} listings`);

  // Zillow bbox bleed: each zip URL returns neighbor-zip listings too. Pre-filter
  // by addressZipcode against our 59-zip set BEFORE the expensive detail scrape.
  const targetZipSet = new Set(TARGETED_CASH_ZIPS);
  const discovered: { url: string; zpid: string; imgSrc?: string; zipcode: string; homeType?: string }[] = [];
  let outOfZipDropped = 0;
  for (const item of searchItems as any[]) {
    const url = item.detailUrl;
    const zpid = String(item.zpid || '');
    const zipcode = String(item.addressZipcode || item.zipcode || item.hdpData?.homeInfo?.zipcode || '');
    const homeType = item.hdpData?.homeInfo?.homeType || item.homeType;
    if (!url || !zpid || !url.includes('zillow.com')) continue;
    if (!targetZipSet.has(zipcode)) { outOfZipDropped++; continue; }
    discovered.push({ url, zpid, imgSrc: item.imgSrc, zipcode, homeType });
  }
  console.log(`   after zip prefilter: ${discovered.length} kept, ${outOfZipDropped} dropped (bbox bleed)`);

  // For --only-mf, drop non-MF before detail-scrape too (search result has homeType)
  let preFilterList = discovered;
  if (cli.onlyMultiFamily) {
    const before = preFilterList.length;
    preFilterList = preFilterList.filter(d => String(d.homeType || '').toUpperCase() === 'MULTI_FAMILY');
    console.log(`   after --only-mf prefilter: ${preFilterList.length} kept, ${before - preFilterList.length} dropped`);
  }

  const existingZpids = new Set<string>();
  const allZpids = preFilterList.map(p => p.zpid);
  for (let i = 0; i < allZpids.length; i += 10) {
    const batch = allZpids.slice(i, i + 10);
    if (batch.length === 0) continue;
    const [queueSnap, propsSnap] = await Promise.all([
      db.collection('agent_outreach_queue').where('zpid', 'in', batch).select().get(),
      db.collection('properties').where('zpid', 'in', batch).select().get(),
    ]);
    queueSnap.docs.forEach(d => existingZpids.add(d.data().zpid || d.id));
    propsSnap.docs.forEach(d => existingZpids.add(String(d.data().zpid)));
  }
  console.log(`   already in system (queue or properties): ${existingZpids.size}`);

  const newDiscovered = preFilterList.filter(p => !existingZpids.has(p.zpid));
  const urlsToDetail = newDiscovered.slice(0, cli.detailCap).map(p => p.url);
  const searchByZpid = new Map<string, any>();
  for (const item of searchItems as any[]) {
    if (item.zpid) searchByZpid.set(String(item.zpid), item);
  }
  console.log(`   net-new to detail-scrape: ${urlsToDetail.length}`);

  if (urlsToDetail.length === 0) {
    console.log('\n✅ nothing to enqueue.');
    process.exit(0);
  }

  console.log(`\n🔍 Step 2: detail scraper (${urlsToDetail.length} urls)...`);
  const detailRun = await client.actor('maxcopell/zillow-detail-scraper').call({
    startUrls: urlsToDetail.map(url => ({ url })),
  });
  const detailItems = await fetchAllDatasetItems(client, detailRun.defaultDatasetId);
  console.log(`   detail returned ${detailItems.length} listings`);

  const stats = {
    total: detailItems.length,
    added: 0,
    cashDeals: 0,
    potentialOwnerfinance: 0,
    noAgent: 0,
    hasOwnerfinance: 0,
    negativeKeywords: 0,
    outsideTargetZips: 0,
    notMultiFamily: 0,
  };
  const byZip: Record<string, number> = {};

  let batch = db.batch();
  let batchCount = 0;

  for (const item of detailItems as any[]) {
    const property = item;

    let url = property.addressOrUrlFromInput || property.url;
    if (!url && property.hdpUrl) url = `https://www.zillow.com${property.hdpUrl}`;
    const zpid = String(property.zpid || '');
    if (!url || !zpid) continue;

    const agentPhone = property.attributionInfo?.agentPhoneNumber
      || property.agentPhoneNumber
      || property.contactRecipients?.[0]?.phoneNumber
      || property.attributionInfo?.brokerPhoneNumber
      || property.brokerPhoneNumber;
    if (!agentPhone || !isValidPhone(agentPhone)) { stats.noAgent++; continue; }

    const description = property.description || '';
    const streetAddr = property.streetAddress || property.address?.streetAddress || '';
    const city = property.city || property.address?.city || '';
    const state = property.state || property.address?.state || '';

    if (hasStrictOwnerfinancing(description).passes) { stats.hasOwnerfinance++; continue; }
    if (hasNegativeKeywords(description).hasNegative) { stats.negativeKeywords++; continue; }

    const zipCode = property.zipcode || property.address?.zipcode || '';
    if (!zipCode || !TARGETED_CASH_ZIPS.includes(zipCode)) { stats.outsideTargetZips++; continue; }

    const rawHomeType = String(property.homeType || '').toUpperCase();
    if (cli.onlyMultiFamily && rawHomeType !== 'MULTI_FAMILY') {
      stats.notMultiFamily++;
      continue;
    }

    const price = property.price || 0;
    const zestimate = property.zestimate || 0;

    let dealType: 'cash_deal' | 'potential_owner_finance' = 'potential_owner_finance';
    if (zestimate > 0 && price > 0 && (price / zestimate) < 0.80) {
      dealType = 'cash_deal';
      stats.cashDeals++;
    } else {
      stats.potentialOwnerfinance++;
    }

    const agentName = property.attributionInfo?.agentName
      || property.agentName
      || property.contactRecipients?.[0]?.displayName
      || 'Agent';

    const imgSrc = property.imgSrc || searchByZpid.get(zpid)?.imgSrc || null;
    const phoneNormalized = normalizePhone(agentPhone);
    const addressNormalized = streetAddr.toLowerCase().trim()
      .replace(/[#,\.]/g, '').replace(/\s+/g, ' ');

    if (!cli.dryRun) {
      const docRef = db.collection('agent_outreach_queue').doc();
      batch.set(docRef, {
        zpid,
        url,
        address: streetAddr,
        city,
        state,
        zipCode,
        price,
        zestimate,
        priceToZestimateRatio: zestimate > 0 ? price / zestimate : null,
        beds: property.bedrooms || 0,
        baths: property.bathrooms || 0,
        squareFeet: property.livingArea || 0,
        propertyType: rawHomeType || 'SINGLE_FAMILY',
        agentName,
        agentPhone,
        agentEmail: property.attributionInfo?.agentEmail || null,
        imgSrc,
        phoneNormalized,
        addressNormalized,
        dealType,
        status: 'pending',
        source: `agent_outreach_backfill${cli.onlyMultiFamily ? '_mf' : cli.dozDays ? `_doz${cli.dozDays}` : ''}`,
        addedAt: new Date(),
      });
      batchCount++;
    }
    stats.added++;
    byZip[zipCode] = (byZip[zipCode] || 0) + 1;

    if (batchCount >= 400) {
      await batch.commit();
      console.log(`   committed ${batchCount}`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0 && !cli.dryRun) {
    await batch.commit();
    console.log(`   committed final ${batchCount}`);
  }

  console.log(`\n=== DONE ===`);
  console.log(`total detailed        : ${stats.total}`);
  console.log(`enqueued              : ${stats.added}${cli.dryRun ? ' (DRY RUN — nothing written)' : ''}`);
  console.log(`  cash_deal           : ${stats.cashDeals}`);
  console.log(`  potential_of        : ${stats.potentialOwnerfinance}`);
  console.log(`skipped:`);
  console.log(`  no agent / phone    : ${stats.noAgent}`);
  console.log(`  has OF keywords     : ${stats.hasOwnerfinance}`);
  console.log(`  negative keywords   : ${stats.negativeKeywords}`);
  console.log(`  outside target zips : ${stats.outsideTargetZips}`);
  if (cli.onlyMultiFamily) {
    console.log(`  not multi-family    : ${stats.notMultiFamily}`);
  }

  const top = Object.entries(byZip).sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (top.length > 0) {
    console.log(`\ntop zips:`);
    for (const [z, n] of top) console.log(`  ${z} : ${n}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
