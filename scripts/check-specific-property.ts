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

async function checkProperty() {
  const snapshot = await db.collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .get();

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.fullAddress && data.fullAddress.includes('2842 LUCOMA')) {
      console.log('\n=== PROPERTY DATA ===\n');
      console.log('ID:', doc.id);
      console.log('Address:', data.fullAddress);
      console.log('Price:', data.price);
      console.log('List Price:', data.listPrice);
      console.log('State:', data.state);
      console.log('Zip Code:', data.zipCode);
      console.log('Description length:', data.description?.length || 0);
      console.log('First Image:', data.firstPropertyImage);
      console.log('Image URL:', data.imageUrl);
      console.log('Source:', data.source);
      console.log('\n');
    }
  });

  process.exit(0);
}

checkProperty();
