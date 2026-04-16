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
const hasHttp = (v: any) => typeof v === 'string' && /^https?:\/\//i.test(v);

async function main() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesSnap = await db.collection('properties').where('agentConfirmedAt', '>=', since).get();
  console.log(`Scanning ${yesSnap.size} recent YES properties...\n`);

  const { indexRawFirestoreProperty } = await import('../src/lib/typesense/sync');
  let fixed = 0, skipped = 0;

  for (const doc of yesSnap.docs) {
    const d = doc.data();
    const already = (hasHttp(d.primaryImage) && d.primaryImage) || (hasHttp(d.firstPropertyImage) && d.firstPropertyImage);
    if (already) { skipped++; continue; }

    const queueId = d.originalQueueId;
    if (!queueId) { console.log(`  ⚠️  ${doc.id}: no originalQueueId`); continue; }

    const q = (await db.collection('agent_outreach_queue').doc(queueId).get()).data();
    if (!q) { console.log(`  ⚠️  ${doc.id}: queue ${queueId} missing`); continue; }

    const primary = (hasHttp(q.firstPropertyImage) && q.firstPropertyImage)
      || (hasHttp(q.imgSrc) && q.imgSrc)
      || (hasHttp(q.rawData?.hiResImageLink) && q.rawData.hiResImageLink)
      || null;

    if (!primary) { console.log(`  ⚠️  ${doc.id}: no image in queue or rawData`); continue; }

    await db.collection('properties').doc(doc.id).set({
      primaryImage: primary,
      firstPropertyImage: primary,
      imgSrc: primary,
      imageUrls: [primary],
    }, { merge: true });

    const saved = await db.collection('properties').doc(doc.id).get();
    await indexRawFirestoreProperty(doc.id, saved.data()!, 'properties');
    console.log(`  ✅ ${doc.id} ${d.address} → ${primary.slice(0, 70)}...`);
    fixed++;
  }

  console.log(`\nFixed: ${fixed}  |  Already-OK: ${skipped}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
