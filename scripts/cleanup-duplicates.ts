import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function cleanupDuplicates() {
  console.log('=== Cleaning up duplicates in zillow_imports ===\n');

  const snapshot = await db.collection('zillow_imports').get();

  // Group by ZPID (more reliable than address)
  const zpidMap = new Map<string, Array<{ id: string; address: string; source: string; createdAt: Date | null; importedAt: Date | null }>>();

  snapshot.forEach(doc => {
    const d = doc.data();
    const zpid = String(d.zpid || '');

    if (!zpid) return; // Skip docs without ZPID

    if (!zpidMap.has(zpid)) {
      zpidMap.set(zpid, []);
    }

    zpidMap.get(zpid)!.push({
      id: doc.id,
      address: d.address || d.streetAddress || '(no address)',
      source: d.source || 'unknown',
      createdAt: d.createdAt?.toDate?.() || null,
      importedAt: d.importedAt?.toDate?.() || null,
    });
  });

  // Find duplicates
  const duplicatesToDelete: string[] = [];
  let duplicateZpidCount = 0;

  for (const [zpid, docs] of zpidMap) {
    if (docs.length > 1) {
      duplicateZpidCount++;

      // Sort: prefer agent_outreach > apify-zillow > CSV Import, then by date (oldest first)
      const sorted = docs.sort((a, b) => {
        // Priority order
        const priority = (source: string) => {
          if (source === 'agent_outreach') return 0;
          if (source === 'apify-zillow') return 1;
          if (source === 'CSV Import') return 2;
          return 3;
        };

        const pA = priority(a.source);
        const pB = priority(b.source);

        if (pA !== pB) return pA - pB;

        // If same priority, keep oldest
        const dateA = (a.createdAt || a.importedAt)?.getTime() || 0;
        const dateB = (b.createdAt || b.importedAt)?.getTime() || 0;
        return dateA - dateB;
      });

      // Keep first, delete rest
      console.log(`ZPID ${zpid} (${docs.length} copies):`);
      sorted.forEach((d, i) => {
        if (i === 0) {
          console.log(`  ✅ KEEP: ${d.id} | ${d.source} | ${d.address}`);
        } else {
          console.log(`  ❌ DELETE: ${d.id} | ${d.source} | ${d.address}`);
          duplicatesToDelete.push(d.id);
        }
      });
      console.log('');
    }
  }

  console.log(`\nFound ${duplicateZpidCount} ZPIDs with duplicates`);
  console.log(`Total documents to delete: ${duplicatesToDelete.length}`);

  // Also find and delete properties with empty addresses AND no ZPID
  const emptyAddressDocs: string[] = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    const address = (d.address || d.streetAddress || '').trim();
    const zpid = String(d.zpid || '').trim();

    if (!address && !zpid) {
      emptyAddressDocs.push(doc.id);
    }
  });

  console.log(`\nFound ${emptyAddressDocs.length} properties with NO address AND no ZPID`);

  // Delete in batches
  const allToDelete = [...duplicatesToDelete, ...emptyAddressDocs];

  if (allToDelete.length === 0) {
    console.log('\n✅ No duplicates to clean up!');
    return;
  }

  console.log(`\n🗑️  Deleting ${allToDelete.length} documents...`);

  const BATCH_SIZE = 400;
  let deleted = 0;

  for (let i = 0; i < allToDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = allToDelete.slice(i, i + BATCH_SIZE);

    for (const docId of slice) {
      batch.delete(db.collection('zillow_imports').doc(docId));
    }

    await batch.commit();
    deleted += slice.length;
    console.log(`   Deleted ${deleted}/${allToDelete.length}...`);
  }

  console.log(`\n✅ Done! Deleted ${deleted} duplicate/empty documents.`);

  // Final count
  const finalSnapshot = await db.collection('zillow_imports').get();
  console.log(`\nFinal zillow_imports count: ${finalSnapshot.size}`);
}

cleanupDuplicates().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
