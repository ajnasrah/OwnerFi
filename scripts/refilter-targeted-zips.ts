/**
 * Refilter all properties in the 59 targeted zips. Applies the current
 * `runUnifiedFilter` to each stored description and syncs corrected
 * `isOwnerfinance` / `isCashDeal` flags to Firestore + Typesense.
 *
 * Why: historical saves used earlier, less strict filter revisions.
 * Running the current filter fixes any stale flags (e.g. properties
 * flagged OF even though the description says "No owner financing").
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { runUnifiedFilter } from '../src/lib/scraper-v2/unified-filter';
import { TARGETED_CASH_ZIPS } from '../src/lib/scraper-v2/search-config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

const DRY_RUN = process.argv.includes('--dry-run');
const OF_ONLY = process.argv.includes('--of-only');

const typesense = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

async function main() {
  const { db } = getFirebaseAdmin();

  const chunks: string[][] = [];
  for (let i = 0; i < TARGETED_CASH_ZIPS.length; i += 30) {
    chunks.push(TARGETED_CASH_ZIPS.slice(i, i + 30));
  }

  let total = 0;
  const changes: Array<{
    docId: string; zpid: string; zip: string; address: string;
    wasOF: boolean; wasCash: boolean;
    isOF: boolean; isCash: boolean;
  }> = [];

  for (const chunk of chunks) {
    const snap = await db.collection('properties').where('zipCode', 'in', chunk).get();
    snap.forEach(doc => {
      total++;
      const d = doc.data();
      const wasOF = !!d.isOwnerfinance;
      const wasCash = !!d.isCashDeal;

      const result = runUnifiedFilter(
        d.description || '',
        d.listPrice ?? d.price,
        d.zestimate ?? d.estimate,
        d.propertyType || d.homeType,
        { isAuction: d.isAuction, isForeclosure: d.isForeclosure, isBankOwned: d.isBankOwned }
      );

      // When --of-only, only count OF flag changes, preserve cash flag as-is
      const newOF = result.isOwnerfinance;
      const newCash = OF_ONLY ? wasCash : result.isCashDeal;

      if (newOF !== wasOF || newCash !== wasCash) {
        changes.push({
          docId: doc.id,
          zpid: d.zpid || doc.id.replace('zpid_', ''),
          zip: d.zipCode || '',
          address: d.streetAddress || d.fullAddress || '',
          wasOF, wasCash,
          isOF: newOF, isCash: newCash,
        });
      }
    });
  }

  console.log(`Total scanned: ${total}`);
  console.log(`Changes needed: ${changes.length}\n`);

  // Categorize
  const ofLost = changes.filter(c => c.wasOF && !c.isOF);
  const ofGained = changes.filter(c => !c.wasOF && c.isOF);
  const cashLost = changes.filter(c => c.wasCash && !c.isCash);
  const cashGained = changes.filter(c => !c.wasCash && c.isCash);

  console.log(`OF un-flagged (false positives fixed): ${ofLost.length}`);
  ofLost.forEach(c => console.log(`  ${c.zpid} | ${c.address} (${c.zip})`));
  console.log(`\nOF newly flagged (false negatives fixed): ${ofGained.length}`);
  ofGained.forEach(c => console.log(`  ${c.zpid} | ${c.address} (${c.zip})`));
  console.log(`\nCash un-flagged: ${cashLost.length}`);
  console.log(`Cash newly flagged: ${cashGained.length}`);

  if (DRY_RUN || changes.length === 0) {
    console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}No writes performed.`);
    return;
  }

  // Apply writes in batches
  console.log('\nApplying updates to Firestore + Typesense...');
  let batch = db.batch();
  let batchCount = 0;
  const BATCH_LIMIT = 400;

  for (const c of changes) {
    const ref = db.collection('properties').doc(c.docId);
    const newDealTypes: string[] = [];
    if (c.isOF) newDealTypes.push('owner_finance');
    if (c.isCash) newDealTypes.push('cash_deal');

    batch.update(ref, {
      isOwnerfinance: c.isOF,
      isCashDeal: c.isCash,
      dealTypes: newDealTypes,
      refilteredAt: new Date(),
    });
    batchCount++;

    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      console.log(`  Firestore: committed ${batchCount}`);
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) { await batch.commit(); console.log(`  Firestore: final commit ${batchCount}`); }

  // Typesense updates
  let tsOK = 0, tsFail = 0;
  for (const c of changes) {
    try {
      const dealType = c.isOF && c.isCash ? 'both' : c.isOF ? 'owner_finance' : c.isCash ? 'cash_deal' : null;
      if (dealType === null) {
        // Property no longer qualifies — remove from Typesense
        try {
          await typesense.collections('properties').documents(c.docId).delete();
          tsOK++;
        } catch (e: any) {
          if (e.httpStatus === 404) { tsOK++; } else { throw e; }
        }
      } else {
        await typesense.collections('properties').documents(c.docId).update({ dealType });
        tsOK++;
      }
    } catch (e: any) {
      tsFail++;
      console.error(`  Typesense error for ${c.docId}: ${e.message}`);
    }
  }
  console.log(`  Typesense: ${tsOK} updated, ${tsFail} failed`);

  console.log('\n✓ Refilter complete.');
}

main().catch(e => { console.error(e); process.exit(1); });
