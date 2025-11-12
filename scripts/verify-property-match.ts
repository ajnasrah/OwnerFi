/**
 * Verify if the property memphis-test-1762987638709 was matched to buyers
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

const PROPERTY_ID = 'memphis-test-1762987638709';

async function verifyPropertyMatch() {
  console.log('🔍 Verifying property match results');
  console.log('====================================\n');

  try {
    // 1. Check if property exists
    console.log(`1️⃣ Checking property: ${PROPERTY_ID}\n`);
    const propertyRef = doc(db, 'properties', PROPERTY_ID);
    const propertySnap = await getDoc(propertyRef);

    if (!propertySnap.exists()) {
      console.log('❌ Property not found in database!');
      return;
    }

    const property = propertySnap.data();
    console.log('✅ Property found:');
    console.log(`   Address: ${property.address}`);
    console.log(`   City: ${property.city}, ${property.state}`);
    console.log(`   Price: $${property.price?.toLocaleString()}`);
    console.log(`   Monthly: $${property.monthlyPayment}`);
    console.log(`   Down: $${property.downPaymentAmount?.toLocaleString()}\n`);

    // 2. Check if any buyers were matched
    console.log(`2️⃣ Checking matched buyers...\n`);
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('matchedPropertyIds', 'array-contains', PROPERTY_ID)
    );

    const buyersSnapshot = await getDocs(buyersQuery);

    if (buyersSnapshot.empty) {
      console.log('❌ NO BUYERS MATCHED!');
      console.log('   This means the buyer matching logic did NOT run.\n');

      console.log('🔍 Debugging info:');
      console.log(`   Property status: ${property.status}`);
      console.log(`   Property isActive: ${property.isActive}`);
      console.log('   Expected: status=active, isActive=true\n');

      return;
    }

    console.log(`✅ Found ${buyersSnapshot.size} matched buyers:\n`);

    for (const buyerDoc of buyersSnapshot.docs) {
      const buyer = buyerDoc.data();
      console.log(`   • ${buyer.firstName} ${buyer.lastName}`);
      console.log(`     Phone: ${buyer.phone}`);
      console.log(`     Email: ${buyer.email}`);
      console.log(`     City: ${buyer.preferredCity || buyer.city}`);
      console.log(`     Max Monthly: $${buyer.maxMonthlyPayment}`);
      console.log(`     Max Down: $${buyer.maxDownPayment?.toLocaleString()}`);
      console.log('');
    }

    // 3. Check notifications
    console.log(`3️⃣ Checking SMS notifications...\n`);
    const logsQuery = query(
      collection(db, 'webhookLogs'),
      where('propertyId', '==', PROPERTY_ID)
    );

    const logsSnapshot = await getDocs(logsQuery);

    if (logsSnapshot.empty) {
      console.log('❌ NO NOTIFICATIONS LOGGED!');
      console.log('   Possible reasons:');
      console.log('   - GOHIGHLEVEL_WEBHOOK_URL not configured');
      console.log('   - Notification function threw an error');
      console.log('   - Buyers have SMS disabled\n');
    } else {
      console.log(`✅ Found ${logsSnapshot.size} notification log(s):\n`);

      for (const logDoc of logsSnapshot.docs) {
        const log = logDoc.data();
        const payload = log.payload || {};

        console.log(`   ${log.status === 'sent' ? '✅' : '❌'} ${payload.buyerName}`);
        console.log(`      Phone: ${payload.buyerPhone}`);
        console.log(`      Status: ${log.status}`);
        if (log.errorMessage) {
          console.log(`      Error: ${log.errorMessage}`);
        }
        console.log('');
      }
    }

    console.log('====================================');
    console.log('📊 Summary:');
    console.log(`   Property: ${property.address}`);
    console.log(`   Matched buyers: ${buyersSnapshot.size}`);
    console.log(`   Notifications: ${logsSnapshot.size}`);

    if (buyersSnapshot.size > 0 && logsSnapshot.size > 0) {
      console.log('\n🎉 SUCCESS! Buyer matching and notifications are working!');
    } else if (buyersSnapshot.size > 0 && logsSnapshot.size === 0) {
      console.log('\n⚠️  Buyers matched but notifications failed.');
      console.log('   Check GOHIGHLEVEL_WEBHOOK_URL configuration.');
    } else {
      console.log('\n❌ Buyer matching did NOT work.');
      console.log('   The webhook code may not have executed properly.');
    }

  } catch (error) {
    console.error('❌ Error:');
    console.error(error);
  }
}

// Run the check
verifyPropertyMatch().catch(console.error);
