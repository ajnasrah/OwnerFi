/**
 * Check specific property data
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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

async function checkProperty() {
  // Check the property we've been testing: 216 N Martha Ln
  const propertyId = 'i8BLtOzOTYeYUhg42Y6z';

  const docRef = doc(db, 'properties', propertyId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    console.log('❌ Property not found');
    return;
  }

  const property = docSnap.data();

  console.log('\n🏠 Property: 216 N Martha Ln');
  console.log('='.repeat(70));
  console.log('\n📋 ALL FIELDS:');
  console.log(JSON.stringify(property, null, 2));
  console.log('\n' + '='.repeat(70));
  console.log('\n💰 Financial Fields:');
  console.log(`   downPaymentAmount: ${property.downPaymentAmount} (type: ${typeof property.downPaymentAmount})`);
  console.log(`   downPaymentPercent: ${property.downPaymentPercent} (type: ${typeof property.downPaymentPercent})`);
  console.log(`   listPrice: ${property.listPrice}`);
  console.log(`   monthlyPayment: ${property.monthlyPayment}`);
  console.log(`   interestRate: ${property.interestRate}`);
  console.log(`   termYears: ${property.termYears}`);
}

checkProperty().catch(console.error);
