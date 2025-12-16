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
async function count() {
  const [cash, zillow] = await Promise.all([
    db.collection('cash_houses').count().get(),
    db.collection('zillow_imports').where('ownerFinanceVerified', '==', true).count().get()
  ]);
  console.log('cash_houses total:', cash.data().count);
  console.log('zillow_imports (owner finance):', zillow.data().count);

  // Check how many have price > 0 AND arv > 0
  const cashDocs = await db.collection('cash_houses').get();
  let withPriceAndArv = 0;
  let missingPrice = 0;
  let missingArv = 0;
  cashDocs.docs.forEach(doc => {
    const d = doc.data();
    const price = d.price || d.listPrice || 0;
    const arv = d.arv || d.estimate || d.zestimate || 0;
    if (price > 0 && arv > 0) {
      withPriceAndArv++;
    } else {
      if (price <= 0) missingPrice++;
      if (arv <= 0) missingArv++;
    }
  });
  console.log('\ncash_houses breakdown:');
  console.log('  - with price AND arv:', withPriceAndArv);
  console.log('  - missing price:', missingPrice);
  console.log('  - missing arv:', missingArv);

  process.exit(0);
}
count();
