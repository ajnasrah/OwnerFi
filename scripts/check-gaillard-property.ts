import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function checkGaillard() {
  console.log('\n🔍 CHECKING FOR GAILLARD PROPERTY\n');
  console.log('='.repeat(70));

  const snapshot = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .get();

  let found = false;

  snapshot.forEach(doc => {
    const data = doc.data();
    const address = data.fullAddress || data.address || data.streetAddress || '';

    if (address.toLowerCase().includes('gaillard')) {
      found = true;
      console.log('\n✅ FOUND PROPERTY:\n');
      console.log('ID:', doc.id);
      console.log('Address:', data.fullAddress);
      console.log('City:', data.city);
      console.log('State:', data.state);
      console.log('Zip Code:', data.zipCode);
      console.log('Price:', data.price);
      console.log('Source:', data.source);
      console.log('Status:', data.status);
      console.log('Image:', data.firstPropertyImage ? 'Yes' : 'No');
      console.log('\n');
    }
  });

  if (!found) {
    console.log('\n❌ PROPERTY NOT FOUND\n');
    console.log('The Gaillard property is NOT in the database.\n');
  }

  console.log('='.repeat(70));
  process.exit(0);
}

checkGaillard();
