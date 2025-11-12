/**
 * Check if the final test property matched buyers
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize Firebase
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

const PROPERTY_ID = 'final-test-1762988991236';

async function checkFinalTest() {
  console.log('🔍 Checking Final Test Results');
  console.log('===============================\n');

  try {
    // 1. Get property
    const propertyRef = doc(db, 'properties', PROPERTY_ID);
    const propertySnap = await getDoc(propertyRef);

    if (!propertySnap.exists()) {
      console.log('❌ Property not found!');
      return;
    }

    const property = propertySnap.data();
    console.log('✅ Property found:');
    console.log(`   ${property.address}, ${property.city}, ${property.state}`);
    console.log(`   $${property.price?.toLocaleString()} - $${property.monthlyPayment}/mo\n`);

    // 2. Get matched buyers
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('matchedPropertyIds', 'array-contains', PROPERTY_ID)
    );

    const buyersSnapshot = await getDocs(buyersQuery);

    console.log('📊 RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Matched Buyers: ${buyersSnapshot.size}`);

    if (buyersSnapshot.size > 0) {
      console.log('');
      buyersSnapshot.docs.forEach(doc => {
        const buyer = doc.data();
        console.log(`   ✅ ${buyer.firstName} ${buyer.lastName}`);
        console.log(`      Phone: ${buyer.phone}`);
        console.log(`      Email: ${buyer.email}`);
        console.log('');
      });
      console.log('🎉 SUCCESS! Buyers were matched!');
      console.log('📱 SMS notifications should have been sent to all matched buyers.');
      console.log('   Check their phones or GoHighLevel dashboard.');
    } else {
      console.log('');
      console.log('❌ NO BUYERS MATCHED!');
      console.log('   The deployment may not have completed yet.');
      console.log('   Wait 2 minutes and try adding another property.');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error:');
    console.error(error);
  }
}

checkFinalTest().catch(console.error);
