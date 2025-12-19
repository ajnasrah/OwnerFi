/**
 * COMPREHENSIVE DUPLICATE CLEANUP
 *
 * Cleans up:
 * 1. Cross-collection duplicates (property in both zillow_imports AND cash_houses)
 * 2. Duplicates within zillow_imports
 * 3. Duplicates within cash_houses
 *
 * Strategy: Keep the property in zillow_imports (primary), delete from cash_houses
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

// Set to true to actually delete, false for dry run
const DRY_RUN = process.argv.includes('--dry-run');

async function cleanupAllDuplicates() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(DRY_RUN ? '🔍 DRY RUN MODE - No deletions will occur' : '🗑️  LIVE MODE - Will delete duplicates');
  console.log(`${'='.repeat(60)}\n`);

  // Get ALL documents from both collections
  console.log('Fetching all documents...');
  const [importsSnap, cashSnap] = await Promise.all([
    db.collection('zillow_imports').get(),
    db.collection('cash_houses').get()
  ]);

  console.log(`zillow_imports: ${importsSnap.size} documents`);
  console.log(`cash_houses: ${cashSnap.size} documents`);
  console.log(`Total: ${importsSnap.size + cashSnap.size} documents\n`);

  // Build ZPID map
  const zpidMap = new Map<number, {
    inImports: { docId: string; address: string; createdAt: Date | null }[];
    inCash: { docId: string; address: string; createdAt: Date | null }[];
  }>();

  // Process zillow_imports
  for (const doc of importsSnap.docs) {
    const data = doc.data();
    const zpid = Number(data.zpid);
    if (!zpid) continue;

    if (!zpidMap.has(zpid)) {
      zpidMap.set(zpid, { inImports: [], inCash: [] });
    }
    zpidMap.get(zpid)!.inImports.push({
      docId: doc.id,
      address: data.fullAddress || data.address || 'Unknown',
      createdAt: data.createdAt?.toDate?.() || null
    });
  }

  // Process cash_houses
  for (const doc of cashSnap.docs) {
    const data = doc.data();
    const zpid = Number(data.zpid);
    if (!zpid) continue;

    if (!zpidMap.has(zpid)) {
      zpidMap.set(zpid, { inImports: [], inCash: [] });
    }
    zpidMap.get(zpid)!.inCash.push({
      docId: doc.id,
      address: data.fullAddress || data.address || 'Unknown',
      createdAt: data.createdAt?.toDate?.() || null
    });
  }

  // Identify duplicates to delete
  const toDeleteFromImports: string[] = [];
  const toDeleteFromCash: string[] = [];

  let crossCollectionCount = 0;
  let withinImportsCount = 0;
  let withinCashCount = 0;

  for (const [zpid, entries] of zpidMap) {
    const { inImports, inCash } = entries;

    // 1. Cross-collection duplicates: property in BOTH collections
    if (inImports.length > 0 && inCash.length > 0) {
      crossCollectionCount++;
      // Keep ALL in zillow_imports, delete ALL from cash_houses
      for (const doc of inCash) {
        toDeleteFromCash.push(doc.docId);
      }
    }

    // 2. Duplicates within zillow_imports: keep oldest, delete rest
    if (inImports.length > 1) {
      withinImportsCount++;
      // Sort by createdAt (oldest first)
      const sorted = [...inImports].sort((a, b) => {
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;
        return dateA - dateB;
      });
      // Keep first, delete rest
      for (let i = 1; i < sorted.length; i++) {
        toDeleteFromImports.push(sorted[i].docId);
      }
    }

    // 3. Duplicates within cash_houses: keep oldest, delete rest
    // (But if cross-collection, they're already marked for deletion)
    if (inCash.length > 1 && inImports.length === 0) {
      withinCashCount++;
      // Sort by createdAt (oldest first)
      const sorted = [...inCash].sort((a, b) => {
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;
        return dateA - dateB;
      });
      // Keep first, delete rest
      for (let i = 1; i < sorted.length; i++) {
        toDeleteFromCash.push(sorted[i].docId);
      }
    }
  }

  // Deduplicate the delete lists (in case of overlaps)
  const uniqueImportsDeletes = [...new Set(toDeleteFromImports)];
  const uniqueCashDeletes = [...new Set(toDeleteFromCash)];

  console.log('=== ANALYSIS ===\n');
  console.log(`Cross-collection duplicates (in both): ${crossCollectionCount}`);
  console.log(`Duplicates within zillow_imports: ${withinImportsCount}`);
  console.log(`Duplicates within cash_houses (unique): ${withinCashCount}`);
  console.log('');
  console.log(`Documents to delete from zillow_imports: ${uniqueImportsDeletes.length}`);
  console.log(`Documents to delete from cash_houses: ${uniqueCashDeletes.length}`);
  console.log(`Total documents to delete: ${uniqueImportsDeletes.length + uniqueCashDeletes.length}`);
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN - No changes made.');
    console.log('   Run with --live flag to actually delete.\n');

    // Show sample of what would be deleted
    if (uniqueCashDeletes.length > 0) {
      console.log('Sample cross-collection deletions from cash_houses (first 10):');
      for (let i = 0; i < Math.min(10, uniqueCashDeletes.length); i++) {
        console.log(`  - ${uniqueCashDeletes[i]}`);
      }
    }
    return;
  }

  // Actually delete
  console.log('🗑️  Starting deletion...\n');

  const BATCH_SIZE = 400;

  // Delete from zillow_imports
  if (uniqueImportsDeletes.length > 0) {
    console.log(`Deleting ${uniqueImportsDeletes.length} from zillow_imports...`);
    let deleted = 0;
    for (let i = 0; i < uniqueImportsDeletes.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const slice = uniqueImportsDeletes.slice(i, i + BATCH_SIZE);
      for (const docId of slice) {
        batch.delete(db.collection('zillow_imports').doc(docId));
      }
      await batch.commit();
      deleted += slice.length;
      console.log(`  Deleted ${deleted}/${uniqueImportsDeletes.length}`);
    }
  }

  // Delete from cash_houses
  if (uniqueCashDeletes.length > 0) {
    console.log(`\nDeleting ${uniqueCashDeletes.length} from cash_houses...`);
    let deleted = 0;
    for (let i = 0; i < uniqueCashDeletes.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const slice = uniqueCashDeletes.slice(i, i + BATCH_SIZE);
      for (const docId of slice) {
        batch.delete(db.collection('cash_houses').doc(docId));
      }
      await batch.commit();
      deleted += slice.length;
      console.log(`  Deleted ${deleted}/${uniqueCashDeletes.length}`);
    }
  }

  // Final counts
  const [finalImports, finalCash] = await Promise.all([
    db.collection('zillow_imports').get(),
    db.collection('cash_houses').get()
  ]);

  console.log('\n=== FINAL COUNTS ===');
  console.log(`zillow_imports: ${importsSnap.size} → ${finalImports.size} (deleted ${importsSnap.size - finalImports.size})`);
  console.log(`cash_houses: ${cashSnap.size} → ${finalCash.size} (deleted ${cashSnap.size - finalCash.size})`);
  console.log(`\n✅ Cleanup complete!`);
}

cleanupAllDuplicates()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
