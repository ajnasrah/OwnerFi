/**
 * Backfill: Detect auction / foreclosure / bank-owned status on existing properties.
 *
 * Runs through all properties flagged `suspiciousDiscount=true` (price < 50%
 * of Zestimate) — these are the highest-risk candidates for being
 * miscategorized as standard asking-price listings when they are actually
 * auction starting bids or foreclosure filing prices.
 *
 * For each candidate, re-fetches the listing via Apify's Zillow detail
 * scraper, reads `listing_sub_type.{is_forAuction, is_foreclosure,
 * is_bankOwned}` plus `hdpTypeDimension`, and writes the flags to Firestore
 * + Typesense. Also strips `isOwnerfinance` + `dealTypes=owner_finance` for
 * any property confirmed to be distressed.
 *
 * Does NOT delete anything — flags + downgrades only.
 *
 * Usage:
 *   npx tsx scripts/backfill-auction-flags.ts --dry-run
 *   npx tsx scripts/backfill-auction-flags.ts
 *
 * Scope flags:
 *   --all            re-check every property (slow/expensive — use with care)
 *   --limit=N        cap the number of properties processed (default 500)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ApifyClient } = require('apify-client');

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');
const ALL = process.argv.includes('--all');
const LIMIT = (() => {
  const arg = process.argv.find(a => a.startsWith('--limit='));
  return arg ? parseInt(arg.split('=')[1], 10) : 500;
})();

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();

const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

const apifyClient = new ApifyClient({ token: process.env.APIFY_API_KEY });
const DETAIL_ACTOR = 'maxcopell/zillow-detail-scraper';

// Mirror of detectListingSubType from property-transformer.ts.
// Kept in sync manually — if that helper grows, update here too.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectListingSubType(raw: any) {
  const sub = raw?.listing_sub_type || raw?.listingSubType || {};
  const hdp = String(raw?.hdpTypeDimension || '').toLowerCase();
  const status = String(raw?.homeStatus || '').toUpperCase();

  const isAuction =
    Boolean(sub.is_forAuction) || Boolean(sub.isForAuction) ||
    hdp.includes('auction') || status === 'FOR_AUCTION';

  const isBankOwned =
    Boolean(sub.is_bankOwned) || Boolean(sub.isBankOwned) ||
    /bank\s*owned|\breo\b/.test(hdp);

  const isForeclosure =
    Boolean(sub.is_foreclosure) || Boolean(sub.isForeclosure) ||
    hdp.includes('foreclosure') ||
    status === 'FORECLOSED' || status === 'FORECLOSURE' || status === 'PRE_FORECLOSURE';

  let listingSubType = '';
  if (isAuction) listingSubType = 'Auction';
  else if (isBankOwned) listingSubType = 'Bank Owned';
  else if (isForeclosure) listingSubType = 'Foreclosure';

  return { isAuction, isForeclosure, isBankOwned, listingSubType };
}

interface Candidate {
  id: string;
  zpid: string;
  url: string;
  address: string;
  price: number;
  estimate: number;
}

async function loadCandidates(): Promise<Candidate[]> {
  let snapshot;
  if (ALL) {
    snapshot = await db.collection('properties')
      .where('isActive', '==', true)
      .limit(LIMIT)
      .get();
  } else {
    snapshot = await db.collection('properties')
      .where('suspiciousDiscount', '==', true)
      .limit(LIMIT)
      .get();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return snapshot.docs.map((doc: any) => {
    const data = doc.data();
    const zpid = String(data.zpid || '').replace(/^zpid_/, '');
    const url = data.url && String(data.url).startsWith('http')
      ? data.url
      : `https://www.zillow.com/homedetails/${zpid}_zpid/`;
    return {
      id: doc.id,
      zpid,
      url,
      address: data.streetAddress || data.fullAddress || doc.id,
      price: data.price || 0,
      estimate: data.estimate || 0,
    };
  }).filter((c: Candidate) => c.zpid && c.url);
}

async function rescrapeBatch(candidates: Candidate[]) {
  if (candidates.length === 0) return [];
  console.log(`  Apify: scraping ${candidates.length} URLs via ${DETAIL_ACTOR}...`);
  const run = await apifyClient.actor(DETAIL_ACTOR).start({
    startUrls: candidates.map(c => ({ url: c.url })),
  });
  const finished = await apifyClient.run(run.id).waitForFinish({ waitSecs: 600 });
  if (finished.status !== 'SUCCEEDED') {
    throw new Error(`Apify run failed: ${finished.status}`);
  }
  const { items } = await apifyClient.dataset(finished.defaultDatasetId).listItems();
  return items;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BACKFILL: auction / foreclosure / bank-owned flags`);
  console.log(`Mode:     ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Scope:    ${ALL ? `all active (limit ${LIMIT})` : `suspiciousDiscount=true (limit ${LIMIT})`}`);
  console.log(`${'='.repeat(60)}\n`);

  const candidates = await loadCandidates();
  console.log(`Loaded ${candidates.length} candidates from Firestore\n`);
  if (candidates.length === 0) return;

  // Batch by 100 to stay under Apify per-run sizes / timeouts
  const BATCH_SIZE = 100;
  let flaggedCount = 0;
  let unchangedCount = 0;
  let errors = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(candidates.length / BATCH_SIZE)}:`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let items: any[] = [];
    try {
      items = await rescrapeBatch(batch);
    } catch (err) {
      console.error(`  Apify batch failed:`, err);
      errors += batch.length;
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byZpid = new Map<string, any>();
    for (const item of items) {
      const zpid = String(item.zpid || '').replace(/^zpid_/, '');
      if (zpid) byZpid.set(zpid, item);
    }

    const firestoreBatch = db.batch();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typesenseUpdates: any[] = [];

    for (const c of batch) {
      const raw = byZpid.get(c.zpid);
      if (!raw) {
        console.log(`  [?] ${c.address} — no Apify result`);
        continue;
      }

      const flags = detectListingSubType(raw);
      const isDistressed = flags.isAuction || flags.isForeclosure || flags.isBankOwned;

      if (!isDistressed) {
        unchangedCount++;
        continue;
      }

      flaggedCount++;
      console.log(`  [!] ${c.address} — ${flags.listingSubType} (price $${c.price.toLocaleString()}, zest $${c.estimate.toLocaleString()})`);

      if (DRY_RUN) continue;

      // Firestore update: set flags and strip owner_finance classification
      // (distressed listings are never owner-finance by definition).
      const docRef = db.collection('properties').doc(c.id);
      const update: Record<string, unknown> = {
        isAuction: flags.isAuction,
        isForeclosure: flags.isForeclosure,
        isBankOwned: flags.isBankOwned,
        listingSubType: flags.listingSubType,
        backfilledAt: new Date(),
      };

      // Strip owner_finance tagging on confirmed distressed listings
      update.isOwnerfinance = false;
      update.dealTypes = admin.firestore.FieldValue.arrayRemove('owner_finance');

      firestoreBatch.update(docRef, update);

      typesenseUpdates.push({
        id: c.id,
        isAuction: flags.isAuction,
        isForeclosure: flags.isForeclosure,
        isBankOwned: flags.isBankOwned,
        listingSubType: flags.listingSubType,
      });
    }

    if (!DRY_RUN) {
      try {
        await firestoreBatch.commit();
      } catch (err) {
        console.error(`  Firestore batch commit failed:`, err);
        errors += batch.length;
        continue;
      }

      // Typesense upserts (per-document; collection supports partial update via import upsert action)
      if (typesenseUpdates.length > 0) {
        try {
          const jsonl = typesenseUpdates.map(u => JSON.stringify(u)).join('\n');
          await typesenseClient.collections('properties').documents().import(
            jsonl,
            { action: 'update' }
          );
        } catch (err) {
          console.error(`  Typesense update failed:`, err);
        }
      }
    }

    // Rate-limit pause between Apify batches
    if (i + BATCH_SIZE < candidates.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Flagged distressed: ${flaggedCount}`);
  console.log(`Unchanged:          ${unchangedCount}`);
  console.log(`Errors:             ${errors}`);
  console.log(`Mode:               ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
