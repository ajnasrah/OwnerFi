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

const targets = [
  { street: '2220 villa', city: 'Indianapolis', state: 'IN' },
  { street: '742 s addison', city: 'Indianapolis', state: 'IN' },
  { street: '4641 saddle ridge', city: 'Owens Cross Roads', state: 'AL' },
  { street: '804 linden', city: 'Dayton', state: 'OH' },
];

async function main() {
  for (const t of targets) {
    const snap = await db.collection('properties')
      .where('city', '==', t.city)
      .where('state', '==', t.state)
      .get();

    for (const doc of snap.docs) {
      const d = doc.data();
      const addr = (d.address || d.streetAddress || '').toLowerCase();
      if (!addr.includes(t.street)) continue;
      console.log(`\n=== ${doc.id} — ${d.address} ===`);
      console.log(`  source: ${d.source || d.importSource || 'unknown'}`);
      console.log(`  isActive: ${d.isActive}  homeStatus: ${d.homeStatus}`);
      console.log(`  dealTypes: ${JSON.stringify(d.dealTypes)}`);
      console.log(`  imageUrl (singular): ${d.imageUrl || '(none)'}`);
      console.log(`  imageUrls: ${JSON.stringify(d.imageUrls || null)}`);
      console.log(`  primaryImage: ${d.primaryImage || '(none)'}`);
      console.log(`  firstPropertyImage: ${d.firstPropertyImage || '(none)'}`);
      console.log(`  imgSrc: ${d.imgSrc || '(none)'}`);
      console.log(`  hiResImageLink: ${d.hiResImageLink || '(none)'}`);
      console.log(`  originalQueueId: ${d.originalQueueId || '(none)'}`);
      console.log(`  createdAt: ${d.createdAt?.toDate?.() || d.createdAt}`);
      console.log(`  zpid: ${d.zpid}`);
      console.log(`  all keys: ${Object.keys(d).sort().join(', ')}`);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
