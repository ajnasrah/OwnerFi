const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').resolve(__dirname, '..', '.env.local') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}
const db = admin.firestore();

async function deleteSoldInactiveProperties() {
  console.log('=== Task 1: Delete sold/recently_sold inactive properties ===\n');

  let totalDeleted = 0;
  let lastDoc = null;
  let batchRound = 0;

  while (true) {
    batchRound++;
    // Query for inactive properties with SOLD or RECENTLY_SOLD status
    // Firestore 'in' queries support arrays, so we can query both statuses at once
    let query = db.collection('properties')
      .where('isActive', '==', false)
      .where('homeStatus', 'in', ['SOLD', 'RECENTLY_SOLD'])
      .limit(500);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`\nNo more documents found. Exiting loop.`);
      break;
    }

    console.log(`Round ${batchRound}: Found ${snapshot.size} docs to delete...`);

    // Delete in batches of 500
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted += snapshot.size;
    console.log(`  Deleted ${snapshot.size} docs (total so far: ${totalDeleted})`);

    // If we got fewer than 500, we've reached the end
    if (snapshot.size < 500) {
      break;
    }

    // No need for lastDoc cursor since we're deleting the docs we just read
    // The next query with the same criteria will get the next batch
    lastDoc = null;
  }

  console.log(`\n=== DONE: Deleted ${totalDeleted} sold/recently_sold inactive properties ===`);
  return totalDeleted;
}

deleteSoldInactiveProperties()
  .then((count) => {
    console.log(`\nFinal count: ${count}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
