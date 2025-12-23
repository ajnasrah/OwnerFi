/**
 * Script to clean PENDING, SOLD, FOR_RENT properties from database
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

const BAD_STATUSES = ['PENDING', 'SOLD', 'RECENTLY_SOLD', 'FOR_RENT', 'OTHER'];

async function cleanDatabase() {
  const collections = ['zillow_imports', 'properties'];
  let totalDeleted = 0;

  for (const collName of collections) {
    console.log(`\n=== Checking ${collName} ===`);
    const snap = await db.collection(collName).get();

    const statusCounts: Record<string, number> = {};
    const badDocs: Array<{ id: string; status: string; address: string }> = [];

    snap.docs.forEach(doc => {
      const data = doc.data();
      const status = (data.homeStatus || 'NO_STATUS').toUpperCase();
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      if (BAD_STATUSES.includes(status)) {
        badDocs.push({
          id: doc.id,
          status,
          address: data.fullAddress || data.streetAddress || data.address || 'Unknown'
        });
      }
    });

    console.log(`Total: ${snap.size}`);
    console.log('Status breakdown:');
    Object.entries(statusCounts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .forEach(([s, c]) => {
        const isBad = BAD_STATUSES.includes(s) ? ' ❌' : '';
        console.log(`  ${s}: ${c}${isBad}`);
      });

    if (badDocs.length > 0) {
      console.log(`\n🗑️  BAD PROPERTIES TO DELETE: ${badDocs.length}`);
      badDocs.slice(0, 10).forEach(d => {
        console.log(`  - ${d.status}: ${d.address}`);
      });
      if (badDocs.length > 10) console.log(`  ... and ${badDocs.length - 10} more`);

      // Delete in batches of 500
      console.log(`\nDeleting ${badDocs.length} bad properties...`);
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of badDocs) {
        batch.delete(db.collection(collName).doc(doc.id));
        batchCount++;

        if (batchCount >= 500) {
          await batch.commit();
          console.log(`  Committed batch of ${batchCount}`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        console.log(`  Committed final batch of ${batchCount}`);
      }

      console.log(`✅ DELETED ${badDocs.length} properties from ${collName}`);
      totalDeleted += badDocs.length;
    } else {
      console.log(`\n✅ No bad properties found in ${collName}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`🎉 Total deleted: ${totalDeleted} properties`);
  console.log(`========================================`);
}

cleanDatabase()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
