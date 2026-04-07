/**
 * Cleanup: Remove orphaned Typesense documents
 *
 * Deletes documents from Typesense that no longer exist in Firestore,
 * or exist but are inactive/invalid.
 *
 * Usage: npx tsx scripts/cleanup-typesense-orphans.ts
 * Dry run: npx tsx scripts/cleanup-typesense-orphans.ts --dry-run
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Typesense = require('typesense');

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.argv.includes('--dry-run');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    port: 443,
    protocol: 'https',
  }],
  apiKey: process.env.TYPESENSE_API_KEY || process.env.NEXT_PUBLIC_TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 10,
});

async function getAllTypesenseDocs(): Promise<Array<{ id: string; address: string; listPrice: number; dealType: string }>> {
  const docs: Array<{ id: string; address: string; listPrice: number; dealType: string }> = [];
  let page = 1;
  const perPage = 250;

  while (true) {
    const result = await typesenseClient.collections('properties').documents().search({
      q: '*',
      query_by: 'address',
      per_page: perPage,
      page,
    });

    if (!result.hits || result.hits.length === 0) break;

    for (const hit of result.hits) {
      const doc = hit.document;
      docs.push({
        id: doc.id,
        address: doc.address || '?',
        listPrice: doc.listPrice || 0,
        dealType: doc.dealType || '?',
      });
    }

    if (result.hits.length < perPage) break;
    page++;
  }

  return docs;
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('CLEANUP: Remove orphaned Typesense documents');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Get all Typesense docs
  console.log('Fetching all Typesense documents...');
  const tsDocs = await getAllTypesenseDocs();
  console.log(`Typesense documents: ${tsDocs.length}\n`);

  // Check each against Firestore
  console.log('Checking against Firestore...');
  const toRemove: Array<{ id: string; address: string; price: number; reason: string }> = [];

  // Batch Firestore lookups
  const BATCH_SIZE = 100;
  for (let i = 0; i < tsDocs.length; i += BATCH_SIZE) {
    const batch = tsDocs.slice(i, i + BATCH_SIZE);
    const docRefs = batch.map(d => db.collection('properties').doc(d.id));
    const snapshots = await db.getAll(...docRefs);

    for (let j = 0; j < snapshots.length; j++) {
      const snap = snapshots[j];
      const tsDoc = batch[j];

      if (!snap.exists) {
        toRemove.push({ id: tsDoc.id, address: tsDoc.address, price: tsDoc.listPrice, reason: 'Not in Firestore' });
        continue;
      }

      const data = snap.data();

      if (data.isActive === false) {
        toRemove.push({ id: tsDoc.id, address: tsDoc.address, price: tsDoc.listPrice, reason: 'Inactive in Firestore' });
        continue;
      }

      if (!data.isOwnerfinance && !data.isCashDeal) {
        toRemove.push({ id: tsDoc.id, address: tsDoc.address, price: tsDoc.listPrice, reason: 'No deal type' });
        continue;
      }

      const price = data.price || data.listPrice || 0;
      if (price < 10000) {
        toRemove.push({ id: tsDoc.id, address: tsDoc.address, price, reason: `Price too low ($${price})` });
        continue;
      }
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= tsDocs.length) {
      console.log(`  Checked ${Math.min(i + BATCH_SIZE, tsDocs.length)}/${tsDocs.length}`);
    }
  }

  console.log(`\nDocuments to remove from Typesense: ${toRemove.length}\n`);

  if (toRemove.length === 0) {
    console.log('Typesense is clean!');
    return;
  }

  // Group by reason
  const byReason = new Map<string, number>();
  for (const item of toRemove) {
    byReason.set(item.reason, (byReason.get(item.reason) || 0) + 1);
  }
  for (const [reason, count] of byReason) {
    console.log(`  ${reason}: ${count}`);
  }

  if (DRY_RUN) {
    console.log('\nSample:');
    for (const item of toRemove.slice(0, 10)) {
      console.log(`  ${item.id} — $${item.price.toLocaleString()} — ${item.reason}`);
    }
    console.log('\nDRY RUN — no changes.');
    return;
  }

  // Delete from Typesense
  console.log('\nDeleting from Typesense...');
  let deleted = 0;
  let failed = 0;
  for (const item of toRemove) {
    try {
      await typesenseClient.collections('properties').documents(item.id).delete();
      deleted++;
    } catch (err: any) {
      if (err.httpStatus !== 404) {
        failed++;
        console.error(`  Failed: ${item.id}:`, err.message);
      } else {
        deleted++; // Already gone
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('CLEANUP COMPLETE');
  console.log(`  Removed from Typesense: ${deleted}`);
  console.log(`  Failed: ${failed}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error).finally(() => process.exit(0));
