/**
 * Typesense reconciler: fixes drift between Firestore (source of truth)
 * and Typesense.
 *
 * For every Typesense doc, checks Firestore. Deletes the Typesense doc
 * if ANY of:
 *   - Firestore doc doesn't exist (orphan)
 *   - Firestore isActive === false
 *   - Firestore homeStatus is SOLD/RECENTLY_SOLD/FOR_RENT
 *
 * This is a belt-and-suspenders cleanup for Cloud Function sync failures
 * or scripts that directly wrote active=true into Typesense without
 * checking Firestore.
 *
 * Usage:
 *   npx tsx scripts/typesense-reconciler.ts --dry-run
 *   npx tsx scripts/typesense-reconciler.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');
const PERMANENT_STATUSES = new Set(['SOLD', 'RECENTLY_SOLD', 'FOR_RENT']);

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();
const ts = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST, port: 443, protocol: 'https' }],
  apiKey: process.env.TYPESENSE_API_KEY || process.env.NEXT_PUBLIC_TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 15,
});

interface DriftCandidate {
  id: string;
  address: string;
  tsActive: boolean;
  reason: string;
}

async function main() {
  console.log(`\nTYPESENSE RECONCILER — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Stream every active Typesense doc in pages
  const PAGE_SIZE = 250;
  let page = 1;
  const drift: DriftCandidate[] = [];
  let scanned = 0;

  while (true) {
    const res = await ts.collections('properties').documents().search({
      q: '*',
      filter_by: 'isActive:=true',
      per_page: PAGE_SIZE,
      page,
      include_fields: 'id,address,isActive,homeStatus',
    });

    const hits = res.hits || [];
    if (hits.length === 0) break;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = hits.map((h: any) => h.document.id as string);

    // Firestore has an `in` limit of 30 IDs — split into chunks
    for (let i = 0; i < ids.length; i += 30) {
      const chunk = ids.slice(i, i + 30);
      const snaps = await Promise.all(chunk.map(id => db.collection('properties').doc(id).get()));
      snaps.forEach((snap, idx) => {
        const id = chunk[idx];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hitDoc = hits.find((h: any) => h.document.id === id)?.document || {};
        if (!snap.exists) {
          drift.push({ id, address: hitDoc.address || '', tsActive: true, reason: 'Firestore doc missing' });
          return;
        }
        const data = snap.data() as Record<string, unknown> | undefined;
        if (!data) return;
        if (data.isActive === false) {
          drift.push({ id, address: hitDoc.address || String(data.streetAddress || ''), tsActive: true, reason: `FS isActive=false (status=${data.homeStatus || '?'})` });
          return;
        }
        const status = String(data.homeStatus || '').toUpperCase();
        if (PERMANENT_STATUSES.has(status)) {
          drift.push({ id, address: hitDoc.address || String(data.streetAddress || ''), tsActive: true, reason: `FS homeStatus=${status}` });
        }
      });
    }

    scanned += hits.length;
    if (hits.length < PAGE_SIZE) break;
    page++;
    if (page > 20) { console.log('⚠️  Stopped at 20 pages (5000 docs)'); break; }
  }

  console.log(`Scanned ${scanned} active Typesense docs`);
  console.log(`Drift found: ${drift.length}\n`);

  if (drift.length === 0) {
    console.log('Clean — no reconciliation needed.');
    return;
  }

  // Group reasons
  const byReason = new Map<string, number>();
  drift.forEach(d => {
    const key = d.reason.split('(')[0].trim();
    byReason.set(key, (byReason.get(key) || 0) + 1);
  });
  console.log('By reason:');
  byReason.forEach((n, r) => console.log(`  ${r}: ${n}`));

  console.log(`\nFirst 20 samples:`);
  drift.slice(0, 20).forEach(d => console.log(`  ${d.id.padEnd(18)}  ${d.reason.padEnd(40)}  ${d.address}`));

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would delete ${drift.length} from Typesense\n`);
    return;
  }

  let deleted = 0;
  let errors = 0;
  const CONCURRENCY = 20;
  for (let i = 0; i < drift.length; i += CONCURRENCY) {
    const chunk = drift.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (d) => {
      try {
        await ts.collections('properties').documents(d.id).delete();
        deleted++;
      } catch (err: unknown) {
        const httpStatus = (err as { httpStatus?: number })?.httpStatus;
        if (httpStatus !== 404) {
          errors++;
          console.error(`  TS delete ${d.id} failed:`, err);
        } else {
          deleted++;
        }
      }
    }));
    if ((i + CONCURRENCY) % 100 < CONCURRENCY) console.log(`  Progress: ${Math.min(i + CONCURRENCY, drift.length)}/${drift.length}`);
  }

  console.log(`\nTypesense deleted: ${deleted}  errors: ${errors}\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
