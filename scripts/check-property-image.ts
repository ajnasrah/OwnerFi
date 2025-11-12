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

async function checkProperty() {
  const address = "13996 Godbold";
  console.log(`Searching for property: ${address}\n`);

  try {
    const snapshot = await db.collection('properties')
      .where('address', '>=', address)
      .where('address', '<=', address + '\uf8ff')
      .get();

    if (snapshot.empty) {
      console.log('Property not found');
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('Property ID:', doc.id);
      console.log('Address:', data.address);
      console.log('City:', data.city);
      console.log('State:', data.state);
      console.log('\n--- Image Data ---');
      console.log('imageUrl (legacy):', data.imageUrl);
      console.log('imageUrls (array):', data.imageUrls);
      console.log('\nNumber of images:', data.imageUrls?.length || 0);

      if (data.imageUrls && data.imageUrls.length > 0) {
        console.log('\nFirst image URL:');
        console.log(data.imageUrls[0]);
      }
    });
  } catch (error) {
    console.error('Error fetching property:', error);
  }
}

checkProperty();
