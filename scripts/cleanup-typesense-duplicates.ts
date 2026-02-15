/**
 * Cleanup Typesense Duplicate Documents
 *
 * The daily scraper and backfill script were indexing properties with numeric-only IDs
 * (e.g., "123456") while the Cloud Function uses "zpid_123456". This created duplicates.
 *
 * This script:
 * 1. Finds all documents with numeric-only IDs (no zpid_ prefix)
 * 2. Checks if a zpid_ prefixed version exists
 * 3. Deletes the numeric-only duplicate
 *
 * Safe to run multiple times - idempotent.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import Typesense from 'typesense';

const tsClient = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST || '', port: 443, protocol: 'https' }],
  apiKey: process.env.TYPESENSE_API_KEY || '',
  connectionTimeoutSeconds: 10,
});

async function main() {
  console.log('='.repeat(60));
  console.log('TYPESENSE DUPLICATE CLEANUP');
  console.log('Removing numeric-only ID duplicates (e.g., "123456")');
  console.log('Keeping zpid_ prefixed versions (e.g., "zpid_123456")');
  console.log('='.repeat(60));

  // Get total count first
  const collection = await tsClient.collections('properties').retrieve();
  console.log(`\nTotal Typesense documents: ${collection.num_documents}`);

  // Search for ALL documents in pages
  let page = 1;
  const perPage = 250;
  let numericOnlyDocs: { id: string; zpid: string; address: string }[] = [];
  let totalScanned = 0;

  console.log('\nScanning for numeric-only IDs...');

  while (true) {
    const results = await tsClient.collections('properties').documents().search({
      q: '*',
      per_page: perPage,
      page,
      include_fields: 'id,zpid,address,city,state',
    });

    if (!results.hits || results.hits.length === 0) break;

    for (const hit of results.hits) {
      const doc = hit.document as any;
      totalScanned++;

      // Check if this document has a numeric-only ID (no zpid_ prefix)
      if (doc.id && !doc.id.startsWith('zpid_') && /^\d+$/.test(doc.id)) {
        numericOnlyDocs.push({
          id: doc.id,
          zpid: doc.zpid || doc.id,
          address: `${doc.address || '?'}, ${doc.city || '?'}, ${doc.state || '?'}`,
        });
      }
    }

    if (results.hits.length < perPage) break;
    page++;

    if (page % 10 === 0) {
      console.log(`  Scanned ${totalScanned} documents, found ${numericOnlyDocs.length} numeric-only IDs...`);
    }
  }

  console.log(`\nScan complete: ${totalScanned} total documents scanned`);
  console.log(`Found ${numericOnlyDocs.length} documents with numeric-only IDs`);

  if (numericOnlyDocs.length === 0) {
    console.log('\nNo duplicates to clean up!');
    return;
  }

  // Check which ones have a zpid_ prefixed counterpart
  let duplicatesDeleted = 0;
  let orphansUpdated = 0;
  let errors = 0;

  console.log('\nProcessing numeric-only documents...\n');

  for (const doc of numericOnlyDocs) {
    const zpidPrefixedId = `zpid_${doc.zpid}`;

    try {
      // Check if the zpid_ prefixed version exists
      try {
        await tsClient.collections('properties').documents(zpidPrefixedId).retrieve();

        // zpid_ version EXISTS → this numeric-only doc is a duplicate, delete it
        await tsClient.collections('properties').documents(doc.id).delete();
        duplicatesDeleted++;

        if (duplicatesDeleted <= 10) {
          console.log(`  DELETED duplicate: id=${doc.id} (zpid_${doc.zpid} exists) | ${doc.address}`);
        } else if (duplicatesDeleted % 50 === 0) {
          console.log(`  ... deleted ${duplicatesDeleted} duplicates so far`);
        }
      } catch (err: any) {
        if (err.httpStatus === 404) {
          // zpid_ version does NOT exist → this is an orphan from the scraper
          // Re-index it with the correct zpid_ prefix ID
          const fullDoc = await tsClient.collections('properties').documents(doc.id).retrieve() as any;

          // Create new doc with zpid_ prefix
          const updatedDoc = { ...fullDoc, id: zpidPrefixedId };
          await tsClient.collections('properties').documents().upsert(updatedDoc);

          // Delete the old numeric-only doc
          await tsClient.collections('properties').documents(doc.id).delete();
          orphansUpdated++;

          if (orphansUpdated <= 10) {
            console.log(`  MIGRATED: ${doc.id} → ${zpidPrefixedId} | ${doc.address}`);
          }
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      errors++;
      if (errors <= 5) {
        console.error(`  ERROR processing ${doc.id}:`, err.message || err);
      }
    }
  }

  // Final stats
  console.log('\n' + '='.repeat(60));
  console.log('CLEANUP COMPLETE');
  console.log('='.repeat(60));
  console.log(`  Duplicates deleted: ${duplicatesDeleted}`);
  console.log(`  Orphans migrated (re-indexed with zpid_ prefix): ${orphansUpdated}`);
  console.log(`  Errors: ${errors}`);

  // Verify final count
  const finalCollection = await tsClient.collections('properties').retrieve();
  console.log(`\n  Before: ${collection.num_documents} documents`);
  console.log(`  After:  ${finalCollection.num_documents} documents`);
  console.log(`  Removed: ${collection.num_documents - finalCollection.num_documents} net documents`);
}

main().catch(console.error);
