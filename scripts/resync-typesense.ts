/**
 * Full Typesense resync.
 *
 * Steps:
 *   1. Patch Typesense schema to add `dealTypes[]` field (idempotent — skips if present)
 *   2. Index every Firestore property that is `isActive===true` AND has a non-empty
 *      `dealTypes` array. (These are the docs a user's search should surface.)
 *   3. Optionally delete from Typesense any doc whose Firestore state is `isActive===false`.
 *
 * Usage:
 *   npx tsx scripts/resync-typesense.ts                    # dry run
 *   npx tsx scripts/resync-typesense.ts --apply            # sync schema + reindex
 *   npx tsx scripts/resync-typesense.ts --apply --purge    # also delete inactive/orphaned
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';
import { syncAllSchemas } from '../src/lib/typesense/schemas';
import { indexRawFirestoreProperty, deletePropertyFromIndex } from '../src/lib/typesense/sync';
import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '../src/lib/typesense/client';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const PURGE = process.argv.includes('--purge');

async function main() {
  console.log('='.repeat(70));
  console.log(`TYPESENSE RESYNC — ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  if (PURGE) console.log('Purge mode: will delete inactive/orphaned index entries');
  console.log('='.repeat(70));

  // 1) Patch schema
  if (APPLY) {
    console.log('\n[1/3] Syncing schema...');
    const result = await syncAllSchemas();
    console.log('  created:', result.created);
    console.log('  synced:', JSON.stringify(result.synced));
    if (result.errors.length) console.error('  errors:', result.errors);
  } else {
    console.log('\n[1/3] (dry run — skipping schema sync)');
  }

  // 2) Fetch Firestore properties; partition into eligible vs not
  console.log('\n[2/3] Fetching Firestore properties...');
  const snap = await db.collection('properties').get();
  console.log(`  fetched ${snap.size}`);

  const toIndex: Array<{ id: string; data: FirebaseFirestore.DocumentData }> = [];
  const toDelete: string[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const active = d.isActive !== false;
    const hasDealType = Array.isArray(d.dealTypes) && d.dealTypes.length > 0;
    if (active && hasDealType) {
      toIndex.push({ id: doc.id, data: d });
    } else {
      toDelete.push(doc.id);
    }
  }
  console.log(`  eligible for index: ${toIndex.length}`);
  console.log(`  not eligible (inactive or no dealTypes): ${toDelete.length}`);

  // 3) Get current Typesense inventory to see drift
  const client = getTypesenseAdminClient();
  if (!client) throw new Error('Typesense client not available');

  const host = process.env.TYPESENSE_HOST;
  const apiKey = process.env.TYPESENSE_ADMIN_API_KEY || process.env.TYPESENSE_API_KEY;
  const port = process.env.TYPESENSE_PORT || '443';
  const protocol = process.env.TYPESENSE_PROTOCOL || 'https';
  const tsIds = new Set<string>();
  let page = 1;
  while (true) {
    const url = `${protocol}://${host}:${port}/collections/${TYPESENSE_COLLECTIONS.PROPERTIES}/documents/search?q=*&per_page=250&page=${page}&include_fields=id`;
    const res = await fetch(url, { headers: { 'X-TYPESENSE-API-KEY': apiKey! } });
    if (!res.ok) break;
    const body: any = await res.json();
    const hits = body.hits || [];
    if (hits.length === 0) break;
    for (const h of hits) tsIds.add(h.document.id);
    if (hits.length < 250) break;
    page++;
    if (page > 500) break;
  }
  console.log(`  Typesense current count: ${tsIds.size}`);

  const willIndexNew = toIndex.filter(x => !tsIds.has(x.id)).length;
  const willIndexExisting = toIndex.length - willIndexNew;
  const orphansInIndex = [...tsIds].filter(id => !toIndex.find(x => x.id === id));
  console.log(`  of eligible: ${willIndexNew} new to index, ${willIndexExisting} will be re-indexed`);
  console.log(`  orphans in Typesense (not eligible in Firestore): ${orphansInIndex.length}`);

  if (!APPLY) {
    console.log('\n(DRY RUN — no writes)');
    return;
  }

  // 3) Index in batches of 50 (import endpoint would be faster but upsert gets clean per-doc handling)
  console.log('\n[3/3] Indexing eligible docs...');
  let ok = 0, fail = 0;
  const BATCH = 50;
  for (let i = 0; i < toIndex.length; i += BATCH) {
    const slice = toIndex.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(x =>
      indexRawFirestoreProperty(x.id, x.data, 'properties')
    ));
    const batchOK = results.filter(Boolean).length;
    ok += batchOK;
    fail += slice.length - batchOK;
    if ((i / BATCH) % 10 === 0 || i + BATCH >= toIndex.length) {
      console.log(`  batch ${Math.floor(i / BATCH) + 1}: ok=${batchOK}/${slice.length} (running ok=${ok}, fail=${fail})`);
    }
  }
  console.log(`\n✅ Indexed ${ok}/${toIndex.length} (${fail} failed)`);

  if (PURGE && orphansInIndex.length > 0) {
    console.log(`\nPurging ${orphansInIndex.length} orphans from Typesense...`);
    let purged = 0;
    for (const id of orphansInIndex) {
      const ok = await deletePropertyFromIndex(id);
      if (ok) purged++;
    }
    console.log(`✅ Purged ${purged}/${orphansInIndex.length}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
