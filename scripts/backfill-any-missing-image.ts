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

function findImage(d: any): string | null {
  if (hasHttp(d.primaryImage)) return d.primaryImage;
  if (hasHttp(d.firstPropertyImage)) return d.firstPropertyImage;
  if (Array.isArray(d.imageUrls)) { const f = d.imageUrls.find(hasHttp); if (f) return f; }
  if (hasHttp(d.imageUrl)) return d.imageUrl;
  if (hasHttp(d.imgSrc)) return d.imgSrc;
  if (hasHttp(d.hiResImageLink)) return d.hiResImageLink;
  return null;
}

async function main() {
  const snap = await db.collection('properties').where('isActive', '==', true).get();
  console.log(`Scanning ${snap.size} active properties...`);

  const missing = snap.docs.filter(d => !findImage(d.data()));
  console.log(`Missing images: ${missing.length}\n`);

  if (!missing.length) { console.log('Nothing to fix.'); return; }

  const { indexRawFirestoreProperty } = await import('../src/lib/typesense/sync');
  let fixed = 0, noSource = 0;

  for (const doc of missing) {
    const d = doc.data();
    let primary: string | null = null;

    // Source 1: agent_outreach_queue via originalQueueId
    if (d.originalQueueId) {
      const q = (await db.collection('agent_outreach_queue').doc(d.originalQueueId).get()).data();
      if (q) {
        primary = (hasHttp(q.firstPropertyImage) && q.firstPropertyImage)
          || (hasHttp(q.imgSrc) && q.imgSrc)
          || (hasHttp(q.rawData?.hiResImageLink) && q.rawData.hiResImageLink)
          || (hasHttp(q.rawData?.desktopWebHdpImageLink) && q.rawData.desktopWebHdpImageLink)
          || (hasHttp(q.rawData?.mediumImageLink) && q.rawData.mediumImageLink)
          || null;
      }
    }

    // Source 2: rawData on property doc itself
    if (!primary && d.rawData) {
      primary = (hasHttp(d.rawData.hiResImageLink) && d.rawData.hiResImageLink)
        || (hasHttp(d.rawData.desktopWebHdpImageLink) && d.rawData.desktopWebHdpImageLink)
        || (hasHttp(d.rawData.mediumImageLink) && d.rawData.mediumImageLink)
        || null;
    }

    if (!primary) { console.log(`  ⚠️  ${doc.id} ${d.address} — no image found anywhere`); noSource++; continue; }

    await db.collection('properties').doc(doc.id).set({
      primaryImage: primary,
      firstPropertyImage: primary,
      imgSrc: primary,
      imageUrls: [primary],
    }, { merge: true });

    const saved = await db.collection('properties').doc(doc.id).get();
    await indexRawFirestoreProperty(doc.id, saved.data()!, 'properties');
    console.log(`  ✅ ${doc.id} ${d.address}`);
    fixed++;
  }

  console.log(`\nFixed: ${fixed}  |  No source: ${noSource}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
