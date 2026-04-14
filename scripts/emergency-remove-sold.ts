/**
 * EMERGENCY: my earlier `index-newly-flagged-of.ts` + backfill scripts
 * hardcoded `isActive: true, status: 'active'` when pushing to Typesense
 * without checking each property's Zillow `homeStatus`. This resurrected
 * SOLD/PENDING properties into the public UI.
 *
 * This script:
 *   1. Scans every property in the 59 target zips
 *   2. For each, reads Firestore `homeStatus`
 *   3. If status is anything other than FOR_SALE/FOR_AUCTION/FORECLOSURE/FORECLOSED/PRE_FORECLOSURE:
 *      - Set isActive=false in Firestore
 *      - Delete from Typesense
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { TARGETED_CASH_ZIPS } from '../src/lib/scraper-v2/search-config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

const DRY_RUN = process.argv.includes('--dry-run');

const typesense = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

const ALLOWED = new Set([
  'FOR_SALE', 'FOR SALE',
  'FOR_AUCTION', 'FORECLOSURE', 'FORECLOSED', 'PRE_FORECLOSURE',
]);

async function main() {
  const { db } = getFirebaseAdmin();
  const chunks: string[][] = [];
  for (let i = 0; i < TARGETED_CASH_ZIPS.length; i += 30) {
    chunks.push(TARGETED_CASH_ZIPS.slice(i, i + 30));
  }

  const byStatus: Record<string, number> = {};
  const toDeactivate: Array<{ docId: string; status: string; zpid: string; address: string; zip: string }> = [];

  for (const chunk of chunks) {
    const snap = await db.collection('properties').where('zipCode', 'in', chunk).get();
    snap.forEach(doc => {
      const d = doc.data();
      const status = String(d.homeStatus || '').toUpperCase().trim();
      byStatus[status || '(empty)'] = (byStatus[status || '(empty)'] || 0) + 1;

      // If status is known and NOT an allowed-active status → deactivate
      if (status && !ALLOWED.has(status)) {
        toDeactivate.push({
          docId: doc.id,
          status,
          zpid: d.zpid || doc.id.replace('zpid_', ''),
          address: d.streetAddress || d.fullAddress || '',
          zip: d.zipCode || '',
        });
      }
    });
  }

  console.log('homeStatus breakdown across 59 zips:');
  Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => console.log(`  ${s}: ${c}`));

  console.log(`\nTo deactivate + remove from Typesense: ${toDeactivate.length}`);
  if (toDeactivate.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  // Show sample
  toDeactivate.slice(0, 10).forEach(p => console.log(`  ${p.status} | ${p.zpid} | ${p.address} (${p.zip})`));
  if (toDeactivate.length > 10) console.log(`  …and ${toDeactivate.length - 10} more`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No writes performed.');
    return;
  }

  // Firestore batch updates
  let batch = db.batch();
  let count = 0;
  for (const p of toDeactivate) {
    batch.update(db.collection('properties').doc(p.docId), {
      isActive: false,
      status: p.status.toLowerCase(),
      deactivatedAt: new Date(),
      deactivationReason: 'homeStatus_not_for_sale',
    });
    count++;
    if (count >= 400) { await batch.commit(); console.log(`  Firestore: +${count}`); batch = db.batch(); count = 0; }
  }
  if (count > 0) { await batch.commit(); console.log(`  Firestore: +${count}`); }

  // Typesense deletes
  let tsOK = 0, tsMissing = 0, tsErr = 0;
  for (const p of toDeactivate) {
    try {
      await typesense.collections('properties').documents(p.docId).delete();
      tsOK++;
    } catch (e: any) {
      if (e.httpStatus === 404) tsMissing++;
      else { tsErr++; console.error(`  TS error ${p.docId}: ${e.message}`); }
    }
  }
  console.log(`  Typesense: deleted=${tsOK}, not-present=${tsMissing}, errors=${tsErr}`);

  console.log('\n✓ Emergency cleanup complete.');
}

main().catch(e => { console.error(e); process.exit(1); });
