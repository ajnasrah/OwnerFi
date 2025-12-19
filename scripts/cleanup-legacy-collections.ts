import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

async function deleteCollection(collectionName: string) {
  console.log(`\nDeleting ${collectionName}...`);

  const collRef = db.collection(collectionName);
  const snapshot = await collRef.get();

  if (snapshot.empty) {
    console.log(`  ${collectionName} is already empty`);
    return 0;
  }

  console.log(`  Found ${snapshot.size} documents to delete`);

  let deleted = 0;
  const batchSize = 400;

  // Process in batches
  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(i, i + batchSize);

    chunk.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deleted += chunk.length;
    console.log(`  Deleted ${deleted}/${snapshot.size}`);
  }

  console.log(`  ✓ ${collectionName} deleted (${deleted} docs)`);
  return deleted;
}

async function cleanup() {
  console.log("=== CLEANING UP LEGACY COLLECTIONS ===");
  console.log("These collections are duplicated in the unified 'properties' collection\n");

  // First, verify properties collection exists and has data
  const propertiesSnap = await db.collection("properties").count().get();
  console.log(`Properties collection: ${propertiesSnap.data().count} documents`);

  if (propertiesSnap.data().count === 0) {
    console.log("\nERROR: properties collection is empty! Aborting to prevent data loss.");
    process.exit(1);
  }

  const legacyCollections = ["zillow_imports", "cash_houses"];
  let totalDeleted = 0;

  for (const coll of legacyCollections) {
    const deleted = await deleteCollection(coll);
    totalDeleted += deleted;
  }

  console.log("\n=== CLEANUP COMPLETE ===");
  console.log(`Total documents deleted: ${totalDeleted}`);
  console.log(`Properties collection remains: ${propertiesSnap.data().count} documents`);
}

cleanup().catch(console.error);
