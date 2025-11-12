/**
 * Manually send notifications to the 6 matched Memphis buyers
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
const GHL_WEBHOOK_URL = process.env.GOHIGHLEVEL_WEBHOOK_URL!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';

async function manuallySendNotifications() {
  console.log('📱 Manually sending notifications to matched buyers');
  console.log('==================================================\n');

  try {
    // 1. Get the property
    const propertyRef = doc(db, 'properties', PROPERTY_ID);
    const propertySnap = await getDoc(propertyRef);

    if (!propertySnap.exists()) {
      console.log('❌ Property not found!');
      return;
    }

    const property = propertySnap.data();
    console.log('🏠 Property:');
    console.log(`   ${property.address}, ${property.city}, ${property.state}`);
    console.log(`   $${property.price?.toLocaleString()} - $${property.monthlyPayment}/mo\n`);

    // 2. Get matched buyers
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('matchedPropertyIds', 'array-contains', PROPERTY_ID)
    );

    const buyersSnapshot = await getDocs(buyersQuery);

    if (buyersSnapshot.empty) {
      console.log('❌ No matched buyers found!');
      return;
    }

    console.log(`📋 Found ${buyersSnapshot.size} matched buyers\n`);

    // 3. Send notification to each buyer via GoHighLevel
    let sent = 0;
    let failed = 0;

    for (const buyerDoc of buyersSnapshot.docs) {
      const buyer = buyerDoc.data();

      console.log(`📤 Sending to ${buyer.firstName} ${buyer.lastName} (${buyer.phone})...`);

      const smsMessage = `🏠 New Property Match!

Hi ${buyer.firstName}! We found a home for you in ${property.city}, ${property.state}:

📍 ${property.address}
🛏️ ${property.bedrooms} bed, ${property.bathrooms} bath
💰 $${property.price?.toLocaleString()} list price
💵 $${property.monthlyPayment}/mo, $${property.downPaymentAmount?.toLocaleString()} down

View it now: ${BASE_URL}/dashboard

Reply STOP to unsubscribe`;

      const ghlPayload = {
        phone: buyer.phone,
        message: smsMessage,

        // Buyer info
        buyerId: buyerDoc.id,
        buyerName: `${buyer.firstName} ${buyer.lastName}`,
        buyerFirstName: buyer.firstName,
        buyerLastName: buyer.lastName,
        buyerEmail: buyer.email,
        buyerPhone: buyer.phone,
        buyerCity: buyer.preferredCity || buyer.city,
        buyerState: buyer.preferredState || buyer.state,
        buyerMaxMonthlyPayment: buyer.maxMonthlyPayment,
        buyerMaxDownPayment: buyer.maxDownPayment,

        // Property info
        propertyId: PROPERTY_ID,
        propertyAddress: property.address,
        propertyCity: property.city,
        propertyState: property.state,
        monthlyPayment: property.monthlyPayment,
        downPaymentAmount: property.downPaymentAmount,
        listPrice: property.price,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,

        dashboardUrl: `${BASE_URL}/dashboard`,
        trigger: 'new_property_added',
        timestamp: new Date().toISOString(),
      };

      try {
        const response = await fetch(GHL_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(ghlPayload),
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`   ✅ Sent! (ID: ${result.id || 'N/A'})`);
          sent++;
        } else {
          console.log(`   ❌ Failed: ${response.status} ${response.statusText}`);
          failed++;
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        failed++;
      }

      // Wait 500ms between sends to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n==================================================');
    console.log('📊 Summary:');
    console.log(`   Total buyers: ${buyersSnapshot.size}`);
    console.log(`   Sent: ${sent}`);
    console.log(`   Failed: ${failed}`);

    if (sent > 0) {
      console.log('\n✅ Notifications sent to GoHighLevel!');
      console.log('   Check the buyers\' phones for SMS messages.');
    }

  } catch (error) {
    console.error('❌ Error:');
    console.error(error);
  }
}

// Run
manuallySendNotifications().catch(console.error);
