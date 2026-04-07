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

// Helper: chunk an array into smaller arrays
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function deleteOrphanedQueueDocs() {
  console.log('=== Task 2: Delete orphaned agent_outreach_queue docs ===\n');

  // Phase 1: Collect all doc IDs and zpids from agent_outreach_queue
  console.log('Phase 1: Reading all agent_outreach_queue docs...');
  let allDocs = []; // { id, zpid, status }
  let lastDoc = null;
  let pageNum = 0;

  while (true) {
    pageNum++;
    let query = db.collection('agent_outreach_queue')
      .select('zpid', 'status')
      .limit(500);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    console.log(`  Page ${pageNum}: read ${snapshot.size} docs`);
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      allDocs.push({ id: doc.id, zpid: data.zpid, status: data.status });
    }

    if (snapshot.size < 500) break;
  }

  console.log(`\nTotal queue docs: ${allDocs.length}`);

  // Phase 2: Filter out agent_yes, then check property existence
  const agentYesDocs = allDocs.filter(d => d.status === 'agent_yes');
  const docsToCheck = allDocs.filter(d => d.status !== 'agent_yes');

  console.log(`Skipping ${agentYesDocs.length} agent_yes docs`);
  console.log(`Checking ${docsToCheck.length} docs for orphaned properties...\n`);

  // Phase 3: Check property existence in chunks of 20
  const orphanedIds = [];
  const checkChunks = chunk(docsToCheck, 20);

  for (let i = 0; i < checkChunks.length; i++) {
    const docChunk = checkChunks[i];
    const propertyRefs = docChunk.map(d =>
      db.collection('properties').doc(`zpid_${d.zpid}`)
    );

    const propertySnapshots = await db.getAll(...propertyRefs, { fieldMask: [] });

    for (let j = 0; j < docChunk.length; j++) {
      if (!propertySnapshots[j].exists) {
        orphanedIds.push(docChunk[j].id);
      }
    }

    if ((i + 1) % 25 === 0) {
      console.log(`  Checked ${(i + 1) * 20}/${docsToCheck.length} docs, found ${orphanedIds.length} orphans so far`);
    }
  }

  console.log(`\nFound ${orphanedIds.length} orphaned docs to delete`);
  const totalPropertyExists = docsToCheck.length - orphanedIds.length;
  console.log(`${totalPropertyExists} docs have existing properties\n`);

  // Phase 4: Delete orphaned docs using individual doc.delete() calls in parallel batches
  // Avoid batch writes entirely since the docs may be large
  let totalDeleted = 0;
  const deleteChunks = chunk(orphanedIds, 25);

  for (let i = 0; i < deleteChunks.length; i++) {
    const delChunk = deleteChunks[i];
    await Promise.all(
      delChunk.map(id =>
        db.collection('agent_outreach_queue').doc(id).delete()
      )
    );
    totalDeleted += delChunk.length;

    if ((i + 1) % 20 === 0 || i === deleteChunks.length - 1) {
      console.log(`  Deleted ${totalDeleted}/${orphanedIds.length}`);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total scanned:              ${allDocs.length}`);
  console.log(`Total deleted (orphaned):   ${totalDeleted}`);
  console.log(`Total skipped (agent_yes):  ${agentYesDocs.length}`);
  console.log(`Total with existing property: ${totalPropertyExists}`);
  console.log(`=== DONE ===`);

  return totalDeleted;
}

deleteOrphanedQueueDocs()
  .then((count) => {
    console.log(`\nFinal orphaned docs deleted: ${count}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
