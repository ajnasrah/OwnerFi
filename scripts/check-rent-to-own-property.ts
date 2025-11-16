import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

async function checkProperty() {
  const snapshot = await db.collection('zillow_imports').get();
  const property = snapshot.docs.find(doc =>
    doc.data().fullAddress?.includes('4751 Deer Run')
  );

  if (property) {
    const data = property.data();
    console.log('\n=== RENT-TO-OWN PROPERTY DATA ===\n');
    console.log('Address:', data.fullAddress);
    console.log('Price:', data.price);
    console.log('Estimate:', data.estimate);
    console.log('Rent Estimate:', data.rentZestimate || data.rentEstimate);
    console.log('Home Status:', data.homeStatus);
    console.log('Building Type:', data.buildingType);
    console.log('Home Type:', data.homeType);
    console.log('Listing Type:', data.listingType);
    console.log('\nDescription:');
    console.log(data.description || 'No description');
    console.log('\n=== AVAILABLE FIELDS ===');
    console.log(Object.keys(data).sort().join(', '));
  } else {
    console.log('Property not found');
  }
}

checkProperty().then(() => process.exit(0)).catch(console.error);
