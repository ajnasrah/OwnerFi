import * as dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const app = initializeApp({ credential: cert(serviceAccount as any) });
const db = getFirestore(app);

async function deleteProperty() {
  const propertiesRef = db.collection('properties');
  const snapshot = await propertiesRef.where('address', '==', '789 Rental Investment Blvd').get();
  
  if (snapshot.empty) {
    console.log('Property not found');
    return;
  }
  
  console.log('Found properties:', snapshot.size);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log('Deleting:', doc.id, '-', data.address);
    await doc.ref.delete();
    console.log('Deleted');
  }
}

deleteProperty().catch(console.error);
