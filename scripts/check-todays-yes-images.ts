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
  const yesSnap = await db.collection('properties')
    .where('agentConfirmedAt', '>=', since)
    .get();

  console.log(`YES properties in last 24h: ${yesSnap.size}\n`);
  let withImg = 0, withoutImg = 0;
  const missing: string[] = [];

  for (const doc of yesSnap.docs) {
    const d = doc.data();
    const img = (hasHttp(d.primaryImage) && d.primaryImage)
      || (hasHttp(d.firstPropertyImage) && d.firstPropertyImage)
      || (Array.isArray(d.imageUrls) && d.imageUrls.find(hasHttp));
    const status = img ? '✅' : '❌';
    console.log(`${status} ${doc.id}  ${d.address}  | primaryImage=${d.primaryImage ? 'Y' : 'N'}  imgSrc=${d.imgSrc ? 'Y' : 'N'}`);
    if (img) withImg++; else { withoutImg++; missing.push(doc.id); }
  }

  console.log(`\nWith image: ${withImg}`);
  console.log(`Without image: ${withoutImg}`);
  if (missing.length) console.log(`\nMissing ids: ${missing.join(', ')}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
