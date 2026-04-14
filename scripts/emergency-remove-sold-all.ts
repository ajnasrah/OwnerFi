/**
 * EMERGENCY (site-wide): scan the ENTIRE properties collection and remove
 * anything whose homeStatus is not an allowed active status.
 * Deactivates in Firestore + deletes from Typesense.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
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

  console.log('Streaming ALL properties collection...');

  const byStatus: Record<string, number> = {};
  const toDeactivate: Array<{ docId: string; status: string; isActive: boolean }> = [];
  let total = 0;

  // Stream the whole collection with pagination (10k+ docs)
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  const PAGE = 500;
  while (true) {
    let q = db.collection('properties').orderBy('__name__').limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    snap.forEach(doc => {
      total++;
      const d = doc.data();
      const status = String(d.homeStatus || '').toUpperCase().trim();
      byStatus[status || '(empty)'] = (byStatus[status || '(empty)'] || 0) + 1;
      if (status && !ALLOWED.has(status)) {
        toDeactivate.push({ docId: doc.id, status, isActive: !!d.isActive });
      }
    });
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }

  console.log(`\nTotal properties scanned: ${total}`);
  console.log('\nhomeStatus breakdown:');
  Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => console.log(`  ${s}: ${c}`));

  console.log(`\nNon-active (to deactivate): ${toDeactivate.length}`);
  const stillActive = toDeactivate.filter(p => p.isActive);
  console.log(`  …of which STILL flagged isActive=true (UI would show): ${stillActive.length}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No writes.');
    return;
  }

  // Firestore: fix any still flagged isActive=true
  if (stillActive.length > 0) {
    let batch = db.batch();
    let n = 0;
    for (const p of stillActive) {
      batch.update(db.collection('properties').doc(p.docId), {
        isActive: false,
        status: p.status.toLowerCase(),
        deactivatedAt: new Date(),
        deactivationReason: 'homeStatus_not_for_sale',
      });
      n++;
      if (n >= 400) { await batch.commit(); console.log(`  Firestore: +${n}`); batch = db.batch(); n = 0; }
    }
    if (n > 0) { await batch.commit(); console.log(`  Firestore: +${n}`); }
  }

  // Typesense: delete ALL non-active from Typesense (may still be indexed
  // even if Firestore says isActive=false — e.g. from my earlier scripts).
  let ok = 0, missing = 0, err = 0;
  console.log(`\nDeleting ${toDeactivate.length} from Typesense...`);
  for (const p of toDeactivate) {
    try {
      await typesense.collections('properties').documents(p.docId).delete();
      ok++;
    } catch (e: any) {
      if (e.httpStatus === 404) missing++; else { err++; console.error(`  TS err ${p.docId}: ${e.message}`); }
    }
  }
  console.log(`  Typesense: deleted=${ok}, not-present=${missing}, errors=${err}`);

  console.log('\n✓ Site-wide cleanup complete.');
}

main().catch(e => { console.error(e); process.exit(1); });
