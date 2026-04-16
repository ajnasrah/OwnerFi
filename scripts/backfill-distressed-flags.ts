/**
 * BACKFILL: Re-detect auction/foreclosure/bank-owned flags for every active
 * property by re-scraping via Apify and applying the strengthened detector.
 *
 * Usage:
 *   npx tsx scripts/backfill-distressed-flags.ts          # dry run
 *   npx tsx scripts/backfill-distressed-flags.ts --write  # apply changes
 *
 * Cost: ~$0.004/property × 5,300 = ~$21 in Apify credits.
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { ApifyClient } from 'apify-client';
import { detectListingSubType } from '../src/lib/scraper-v2/property-transformer';

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();
const DETAIL_ACTOR = 'maxcopell/zillow-detail-scraper';
const BATCH_SIZE = 100;
const WRITE = process.argv.includes('--write');

interface Diff {
  id: string;
  url: string;
  address: string;
  before: { isAuction?: boolean; isForeclosure?: boolean; isBankOwned?: boolean; listingSubType?: string };
  after:  { isAuction: boolean;  isForeclosure: boolean;  isBankOwned: boolean;  listingSubType: string };
  keystoneHomeStatus?: string;
}

async function main() {
  console.log(`MODE: ${WRITE ? 'WRITE (will modify Firestore)' : 'DRY RUN'}\n`);

  const snap = await db.collection('properties').where('isActive', '==', true).get();
  console.log(`Active properties: ${snap.size}`);

  const props = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      url: data.url || (data.hdpUrl?.startsWith('http') ? data.hdpUrl : `https://www.zillow.com${data.hdpUrl || ''}`),
      address: data.fullAddress || data.streetAddress || d.id,
      isAuction: data.isAuction,
      isForeclosure: data.isForeclosure,
      isBankOwned: data.isBankOwned,
      listingSubType: data.listingSubType,
    };
  }).filter(p => p.url && p.url.includes('zillow.com'));

  console.log(`Valid Zillow URLs: ${props.length}\n`);

  const client = new ApifyClient({ token: process.env.APIFY_API_KEY });
  const diffs: Diff[] = [];
  const stats = {
    scanned: 0,
    apifyMissed: 0,
    unchanged: 0,
    upgraded: 0,
    downgraded: 0,
    fixed: 0,
    errors: 0,
  };

  for (let i = 0; i < props.length; i += BATCH_SIZE) {
    const batch = props.slice(i, i + BATCH_SIZE);
    console.log(`\n[Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(props.length / BATCH_SIZE)}] Scraping ${batch.length} properties...`);

    let items: any[] = [];
    try {
      const run = await client.actor(DETAIL_ACTOR).start({
        startUrls: batch.map(p => ({ url: p.url })),
      });
      const finished = await client.run(run.id).waitForFinish({ waitSecs: 600 });
      if (finished.status !== 'SUCCEEDED') {
        console.error(`  Batch failed: ${finished.status}`);
        stats.errors += batch.length;
        continue;
      }
      const { items: results } = await client.dataset(finished.defaultDatasetId).listItems({ clean: false, limit: 1000 });
      items = results;
    } catch (e: any) {
      console.error(`  Batch error: ${e.message}`);
      stats.errors += batch.length;
      continue;
    }

    // Map zpid → result
    const byZpid = new Map<string, any>();
    for (const item of items) {
      const zpid = String((item as any).zpid || (item as any).id || '');
      if (zpid) byZpid.set(zpid, item);
    }

    let writeBatch = db.batch();
    let writes = 0;

    for (const prop of batch) {
      stats.scanned++;
      const zpid = prop.id.replace('zpid_', '');
      const raw = byZpid.get(zpid);
      if (!raw) { stats.apifyMissed++; continue; }

      const detected = detectListingSubType(raw);
      const sameAuction = (prop.isAuction === true) === detected.isAuction;
      const sameForeclosure = (prop.isForeclosure === true) === detected.isForeclosure;
      const sameBank = (prop.isBankOwned === true) === detected.isBankOwned;

      if (sameAuction && sameForeclosure && sameBank) {
        stats.unchanged++;
        continue;
      }

      const upgraded =
        (!prop.isAuction && detected.isAuction) ||
        (!prop.isForeclosure && detected.isForeclosure) ||
        (!prop.isBankOwned && detected.isBankOwned);
      const downgraded =
        (prop.isAuction && !detected.isAuction) ||
        (prop.isForeclosure && !detected.isForeclosure) ||
        (prop.isBankOwned && !detected.isBankOwned);
      if (upgraded) stats.upgraded++;
      if (downgraded) stats.downgraded++;

      diffs.push({
        id: prop.id,
        url: prop.url,
        address: prop.address,
        before: {
          isAuction: prop.isAuction,
          isForeclosure: prop.isForeclosure,
          isBankOwned: prop.isBankOwned,
          listingSubType: prop.listingSubType,
        },
        after: detected,
        keystoneHomeStatus: raw.keystoneHomeStatus,
      });

      if (WRITE) {
        const update: Record<string, unknown> = {
          isAuction: detected.isAuction,
          isForeclosure: detected.isForeclosure,
          isBankOwned: detected.isBankOwned,
          listingSubType: detected.listingSubType,
          ...(raw.keystoneHomeStatus ? { keystoneHomeStatus: raw.keystoneHomeStatus } : {}),
          distressedBackfilledAt: new Date(),
        };
        // If it became distressed, strip owner-finance tagging
        if (detected.isAuction || detected.isForeclosure || detected.isBankOwned) {
          update.isOwnerfinance = false;
          update.dealTypes = admin.firestore.FieldValue.arrayRemove('owner_finance');
        }
        const ref = db.collection('properties').doc(prop.id);
        writeBatch.update(ref, update);
        writes++;
        stats.fixed++;
        if (writes >= 400) {
          await writeBatch.commit();
          writeBatch = db.batch();
          writes = 0;
        }
      }
    }

    if (WRITE && writes > 0) await writeBatch.commit();
    console.log(`  Batch done. Running totals: scanned=${stats.scanned}, upgraded=${stats.upgraded}, downgraded=${stats.downgraded}, missed=${stats.apifyMissed}`);
  }

  console.log('\n========== SUMMARY ==========');
  console.log(JSON.stringify(stats, null, 2));

  console.log('\n========== SAMPLE DIFFS (first 30) ==========');
  for (const d of diffs.slice(0, 30)) {
    const before = `auction=${d.before.isAuction ?? '?'}/foreclose=${d.before.isForeclosure ?? '?'}/bank=${d.before.isBankOwned ?? '?'}`;
    const after = `auction=${d.after.isAuction}/foreclose=${d.after.isForeclosure}/bank=${d.after.isBankOwned}`;
    console.log(`  ${d.id}  ${d.address}`);
    console.log(`    BEFORE: ${before}  (was: "${d.before.listingSubType || ''}")`);
    console.log(`    AFTER:  ${after}  → "${d.after.listingSubType}"   keystone=${d.keystoneHomeStatus || ''}`);
  }
  if (diffs.length > 30) console.log(`  ... and ${diffs.length - 30} more`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
