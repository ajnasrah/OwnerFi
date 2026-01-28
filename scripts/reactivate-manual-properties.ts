/**
 * Reactivate manually added properties that were incorrectly deactivated
 * These properties were verified by humans, so they should remain active
 * regardless of whether Zillow description contains owner financing keywords
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

// Manual sources that indicate human verification
const MANUAL_SOURCES = ['manual-add-v2', 'manual-add', 'admin-upload', 'manual', 'bookmarklet'];

async function reactivateManualProperties() {
  console.log('\n=== Reactivating Manually Added Properties ===\n');

  // Find all inactive properties from manual sources
  const inactiveManual: Array<{ id: string; address: string; source: string; reason: string }> = [];

  for (const source of MANUAL_SOURCES) {
    const snapshot = await db.collection('properties')
      .where('source', '==', source)
      .where('isActive', '==', false)
      .get();

    snapshot.docs.forEach((doc: { id: string; data: () => Record<string, unknown> }) => {
      const data = doc.data();
      inactiveManual.push({
        id: doc.id,
        address: String(data.fullAddress || data.address || 'Unknown'),
        source: String(data.source),
        reason: String(data.offMarketReason || 'Unknown'),
      });
    });
  }

  console.log(`Found ${inactiveManual.length} inactive manually-added properties:\n`);

  if (inactiveManual.length === 0) {
    console.log('No properties to reactivate.');
    return;
  }

  // Show what we're going to reactivate
  inactiveManual.forEach(p => {
    console.log(`  - ${p.address}`);
    console.log(`    Source: ${p.source}, Reason: ${p.reason}`);
  });

  console.log('\n--- Reactivating... ---\n');

  // Reactivate in batches
  const batch = db.batch();
  let count = 0;

  for (const prop of inactiveManual) {
    const docRef = db.collection('properties').doc(prop.id);
    batch.update(docRef, {
      isActive: true,
      isOwnerFinance: true,
      offMarketReason: null,
      reactivatedAt: new Date(),
      reactivatedReason: 'Manual upload = human verified owner finance',
    });
    count++;

    // Firestore batch limit is 500
    if (count >= 500) {
      await batch.commit();
      console.log(`Committed batch of ${count}`);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log(`\n✅ Reactivated ${inactiveManual.length} properties!`);
}

reactivateManualProperties()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
