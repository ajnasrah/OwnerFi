/**
 * Cleanup: permanently delete properties from Firestore + Typesense where
 * homeStatus is SOLD, RECENTLY_SOLD, or FOR_RENT. These never revert and
 * shouldn't sit in the index.
 *
 * Usage:
 *   npx tsx scripts/cleanup-sold-properties.ts --dry-run
 *   npx tsx scripts/cleanup-sold-properties.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');
const PERMANENT_STATUSES = ['SOLD', 'RECENTLY_SOLD', 'FOR_RENT'];

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

async function main() {
  console.log(`\nCLEANUP SOLD/CLOSED PROPERTIES — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Firestore query — homeStatus 'in' supports up to 30 values, we have 3.
  const snap = await db.collection('properties')
    .where('homeStatus', 'in', PERMANENT_STATUSES)
    .get();

  console.log(`Firestore: found ${snap.size} properties with permanent-delete status`);
  const byStatus: Record<string, number> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snap.docs.forEach((d: any) => {
    const s = d.data().homeStatus;
    byStatus[s] = (byStatus[s] || 0) + 1;
  });
  Object.entries(byStatus).forEach(([s, n]) => console.log(`  ${s}: ${n}`));

  if (snap.size === 0) {
    console.log('Nothing to delete.');
    return;
  }

  if (DRY_RUN) {
    console.log(`\nFirst 20 samples:`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snap.docs.slice(0, 20).forEach((d: any) => {
      const data = d.data();
      console.log(`  [${data.homeStatus.padEnd(15)}] ${data.streetAddress || d.id}`);
    });
    console.log(`\nDRY RUN — would delete ${snap.size} from Firestore + Typesense\n`);
    return;
  }

  // Delete from Firestore in batches of 500
  const BATCH_LIMIT = 500;
  const docIds: string[] = snap.docs.map(d => d.id);
  let fsDeleted = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
    await batch.commit();
    fsDeleted += Math.min(BATCH_LIMIT, snap.docs.length - i);
    console.log(`  Firestore: deleted ${fsDeleted}/${snap.size}`);
  }

  // Delete from Typesense (concurrent, swallow 404s)
  let tsDeleted = 0;
  let tsMissing = 0;
  const CONCURRENCY = 20;
  for (let i = 0; i < docIds.length; i += CONCURRENCY) {
    const chunk = docIds.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (id) => {
      try {
        await ts.collections('properties').documents(id).delete();
        tsDeleted++;
      } catch (err: unknown) {
        const httpStatus = (err as { httpStatus?: number })?.httpStatus;
        if (httpStatus === 404) {
          tsMissing++;
        } else {
          console.error(`  TS delete ${id} failed:`, err);
        }
      }
    }));
  }

  console.log(`\nFirestore deleted: ${fsDeleted}`);
  console.log(`Typesense deleted: ${tsDeleted}  (${tsMissing} already gone)`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
