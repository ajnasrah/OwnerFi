import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}
const db = getFirestore();
async function check() {
  // Get ALL owner finance imports
  const snapshot = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .get();

  console.log('Total zillow_imports (owner finance):', snapshot.docs.length);

  let withPrice = 0;
  let withArv = 0;
  let withBoth = 0;
  let missingBoth = 0;

  snapshot.docs.forEach(doc => {
    const d = doc.data();
    const price = d.price || d.listPrice || 0;
    const arv = d.arv || d.estimate || d.zestimate || 0;

    if (price > 0) withPrice++;
    if (arv > 0) withArv++;
    if (price > 0 && arv > 0) withBoth++;
    if (price <= 0 && arv <= 0) missingBoth++;
  });

  console.log('\nzillow_imports (owner finance) breakdown:');
  console.log('  - with price:', withPrice);
  console.log('  - with arv:', withArv);
  console.log('  - with BOTH:', withBoth);
  console.log('  - missing BOTH:', missingBoth);

  // Check zpid
  let withZpid = 0;
  snapshot.docs.forEach(doc => {
    if (doc.data().zpid) withZpid++;
  });
  console.log('  - with zpid:', withZpid);

  // Show first example
  if (snapshot.docs.length > 0) {
    const first = snapshot.docs[0].data();
    console.log('\nExample property fields:');
    console.log('  - price:', first.price);
    console.log('  - listPrice:', first.listPrice);
    console.log('  - arv:', first.arv);
    console.log('  - estimate:', first.estimate);
    console.log('  - zestimate:', first.zestimate);
    console.log('  - zpid:', first.zpid);
  }

  process.exit(0);
}
check();
