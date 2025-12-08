import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function deleteBulkEntriesFromCollection(collectionName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`CHECKING ${collectionName.toUpperCase()} FOR BULK-ADDED ENTRIES`);
  console.log('='.repeat(80));

  const bulkEntries = await db.collection(collectionName)
    .where('agentNote', '==', 'Bulk processed - agent confirmed via GHL')
    .get();

  console.log(`\nFound ${bulkEntries.size} bulk-added entries in ${collectionName}`);

  if (bulkEntries.size > 0) {
    console.log(`🗑️  Deleting ${bulkEntries.size} bulk-added entries...`);

    let deleteCount = 0;

    // Delete one at a time to avoid batch size limits
    for (const doc of bulkEntries.docs) {
      await doc.ref.delete();
      deleteCount++;

      if (deleteCount % 50 === 0) {
        console.log(`   Deleted: ${deleteCount}/${bulkEntries.size}`);
      }
    }

    console.log(`\n✅ Deleted ${deleteCount} bulk entries from ${collectionName}`);
    return deleteCount;
  }

  return 0;
}

async function fixBulkAgentYes() {
  console.log('='.repeat(80));
  console.log('FIXING BULK-PROCESSED ENTRIES (Part 2 - Delete from collections)');
  console.log('='.repeat(80));

  // Delete from zillow_imports
  const zillowDeleted = await deleteBulkEntriesFromCollection('zillow_imports');

  // Delete from cash_deals
  const cashDeleted = await deleteBulkEntriesFromCollection('cash_deals');

  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ Bulk entries removed from zillow_imports: ${zillowDeleted}`);
  console.log(`✅ Bulk entries removed from cash_deals: ${cashDeleted}`);
  console.log('\n');
}

fixBulkAgentYes()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
