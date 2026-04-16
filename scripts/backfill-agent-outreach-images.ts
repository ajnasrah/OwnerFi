import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();
const hasHttp = (v: any) => typeof v === 'string' && /^https?:\/\//i.test(v.trim());

async function main() {
  const missing: any[] = require('../scripts/truly-missing-images.json');
  console.log(`Backfilling images for ${missing.length} agent_outreach properties...\n`);

  let fixed = 0;
  let skipped = 0;
  const failures: Array<{ id: string; reason: string }> = [];

  for (const m of missing) {
    const pDoc = await db.collection('properties').doc(m.id).get();
    if (!pDoc.exists) { failures.push({ id: m.id, reason: 'properties doc missing' }); continue; }
    const pData = pDoc.data()!;
    const queueId = pData.originalQueueId;
    if (!queueId) { failures.push({ id: m.id, reason: 'no originalQueueId' }); continue; }

    const qDoc = await db.collection('agent_outreach_queue').doc(queueId).get();
    if (!qDoc.exists) { failures.push({ id: m.id, reason: `queue ${queueId} missing` }); continue; }
    const q = qDoc.data()!;

    const primary = (hasHttp(q.firstPropertyImage) && q.firstPropertyImage)
      || (hasHttp(q.imgSrc) && q.imgSrc)
      || null;

    if (!primary) { failures.push({ id: m.id, reason: 'queue has no image URL' }); continue; }

    const update = {
      primaryImage: primary,
      firstPropertyImage: primary,
      imgSrc: primary,
      imageUrls: [primary],
    };

    await db.collection('properties').doc(m.id).set(update, { merge: true });
    console.log(`  ✅ ${m.id} ${m.address} → ${primary.slice(0, 80)}...`);
    fixed++;
  }

  console.log(`\n=== BACKFILL DONE ===`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Failures: ${failures.length}`);
  if (failures.length) failures.forEach(f => console.log(`  ${f.id}: ${f.reason}`));

  // Re-sync to Typesense
  console.log('\n=== SYNCING TO TYPESENSE ===');
  const { indexRawFirestoreProperty } = await import('../src/lib/typesense/sync');
  let synced = 0;
  for (const m of missing) {
    try {
      const doc = await db.collection('properties').doc(m.id).get();
      if (!doc.exists) continue;
      await indexRawFirestoreProperty(m.id, doc.data()!, 'properties');
      synced++;
    } catch (e: any) {
      console.error(`  ⚠️  Typesense sync failed for ${m.id}: ${e.message}`);
    }
  }
  console.log(`Typesense synced: ${synced}/${missing.length}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
