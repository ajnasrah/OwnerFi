/**
 * Rebuild Typesense Index
 *
 * 1. Drops and recreates the properties collection with new schema
 * 2. Re-syncs all properties from Firestore
 */

import { getAdminDb } from '../src/lib/firebase-admin';
import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '../src/lib/typesense/client';
import { propertiesSchema } from '../src/lib/typesense/schemas';
import { indexRawFirestoreProperty } from '../src/lib/typesense/sync';

async function main() {
  console.log('=== REBUILDING TYPESENSE INDEX ===\n');

  const client = getTypesenseAdminClient();
  if (!client) {
    console.error('❌ Typesense client not available. Check TYPESENSE_API_KEY env var.');
    process.exit(1);
  }

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ Firebase not initialized');
    process.exit(1);
  }

  // Step 1: Drop existing collection
  console.log('Step 1: Dropping existing collection...');
  try {
    await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES).delete();
    console.log('✓ Dropped existing collection');
  } catch (error: any) {
    if (error.httpStatus === 404) {
      console.log('✓ Collection did not exist, skipping drop');
    } else {
      console.error('⚠ Error dropping collection:', error.message);
    }
  }

  // Step 2: Create collection with new schema
  console.log('\nStep 2: Creating collection with new schema...');
  try {
    await client.collections().create(propertiesSchema);
    console.log('✓ Created collection with new schema');
    console.log('  Fields:', propertiesSchema.fields.map(f => f.name).join(', '));
  } catch (error: any) {
    console.error('❌ Failed to create collection:', error.message);
    process.exit(1);
  }

  // Step 3: Sync all properties from unified Firestore collection
  console.log('\nStep 3: Syncing properties from Firestore (unified collection)...');

  let totalSynced = 0;
  let totalFailed = 0;

  // Sync from unified properties collection
  console.log('\n--- Syncing properties (unified) ---');
  const properties = await db.collection('properties')
    .where('isActive', '==', true)
    .get();
  console.log(`Found ${properties.docs.length} active documents`);

  for (let i = 0; i < properties.docs.length; i++) {
    const doc = properties.docs[i];
    try {
      await indexRawFirestoreProperty(doc.id, doc.data(), 'properties');
      totalSynced++;
    } catch (error) {
      totalFailed++;
    }

    // Progress update every 100 docs
    if ((i + 1) % 100 === 0) {
      console.log(`  Progress: ${i + 1}/${properties.docs.length}`);
    }
  }
  console.log(`✓ properties: ${properties.docs.length} processed`);

  // Summary
  console.log('\n=== COMPLETE ===');
  console.log(`Total synced: ${totalSynced}`);
  console.log(`Total failed: ${totalFailed}`);

  // Verify by checking collection stats
  try {
    const collection = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES).retrieve();
    console.log(`\nTypesense collection now has ${collection.num_documents} documents`);
  } catch (error) {
    console.log('Could not retrieve collection stats');
  }
}

main().catch(console.error);
