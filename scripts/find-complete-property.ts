/**
 * Find a property with complete data for testing
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findCompleteProperty() {
  console.log('🔍 Finding property with complete data for testing\n');

  const propertiesQuery = query(
    collection(db, 'properties'),
    where('status', '==', 'active'),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  const snapshot = await getDocs(propertiesQuery);

  console.log(`Checking ${snapshot.size} properties...\n`);

  for (const docSnap of snapshot.docs) {
    const property = docSnap.data();

    // Check if property has all required fields
    const hasAllFields =
      property.address &&
      property.city &&
      property.state &&
      property.bedrooms &&
      property.bathrooms &&
      property.monthlyPayment &&
      property.interestRate &&
      property.termYears &&
      property.imageUrls && property.imageUrls.length > 0 &&
      (property.downPaymentAmount || property.downPaymentPercent) &&
      property.listPrice;

    if (hasAllFields) {
      console.log('✅ FOUND COMPLETE PROPERTY!\n');
      console.log(`Address: ${property.address}`);
      console.log(`City: ${property.city}, ${property.state}`);
      console.log(`Property ID: ${docSnap.id}`);
      console.log(`\nProperty Details:`);
      console.log(`  Bedrooms: ${property.bedrooms}`);
      console.log(`  Bathrooms: ${property.bathrooms}`);
      console.log(`  List Price: $${property.listPrice?.toLocaleString()}`);
      console.log(`  Down Payment Amount: $${property.downPaymentAmount?.toLocaleString() || 'N/A'}`);
      console.log(`  Down Payment Percent: ${property.downPaymentPercent || 'N/A'}%`);
      console.log(`  Monthly Payment: $${property.monthlyPayment?.toLocaleString()}`);
      console.log(`  Interest Rate: ${property.interestRate}%`);
      console.log(`  Term: ${property.termYears} years`);
      console.log(`  Images: ${property.imageUrls.length}`);
      console.log(`\n💡 Use this property ID to test: ${docSnap.id}`);
      return;
    }
  }

  console.log('❌ No complete properties found in first 50 results');
}

findCompleteProperty().catch(console.error);
