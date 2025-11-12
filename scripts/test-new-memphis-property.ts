/**
 * Test script to trigger the save-property webhook with a FRESH Memphis property
 * to verify the fix is working in production
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testNewMemphisProperty() {
  console.log('🧪 Testing NEW Memphis property with fixed webhook');
  console.log('=================================================\n');

  // Get the base URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  console.log(`📡 Using base URL: ${baseUrl}\n`);

  // Prepare a NEW Memphis property
  const propertyPayload = {
    // Required fields - use unique timestamp for new property
    opportunityId: 'memphis-test-' + Date.now(),
    propertyAddress: '1234 Elm Street', // Different address
    propertyCity: 'Memphis',
    state: 'TN',
    price: 175000, // Lower price to match more buyers

    // Optional property details
    bedrooms: 3,
    bathrooms: 2,
    livingArea: 1600,
    yearBuilt: 2008,
    lotSizes: '0.2 acre',
    homeType: 'Single Family',
    zipCode: '38103',

    // Owner financing terms - very affordable to match all buyers
    downPayment: 5, // Only 5% down
    interestRate: 6.5,
    termYears: 30,

    // Description
    description: 'Affordable Memphis home with owner financing! Perfect for first-time buyers.',

    // Image
    imageLink: ''
  };

  console.log('📋 Property Details:');
  console.log(`   Address: ${propertyPayload.propertyAddress}`);
  console.log(`   City: ${propertyPayload.propertyCity}, ${propertyPayload.state}`);
  console.log(`   Price: $${propertyPayload.price.toLocaleString()}`);
  console.log(`   Beds/Baths: ${propertyPayload.bedrooms}/${propertyPayload.bathrooms}`);
  console.log(`   Down Payment: ${propertyPayload.downPayment}%`);
  console.log(`   Interest Rate: ${propertyPayload.interestRate}%`);
  console.log(`   Term: ${propertyPayload.termYears} years\n`);

  // Calculate expected monthly payment
  const downPaymentAmount = Math.round(propertyPayload.price * (propertyPayload.downPayment / 100));
  const loanAmount = propertyPayload.price - downPaymentAmount;
  const monthlyRate = (propertyPayload.interestRate / 100) / 12;
  const numPayments = propertyPayload.termYears * 12;
  const monthlyPayment = Math.round(
    loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );

  console.log(`💰 Calculated Financials:`);
  console.log(`   Down Payment Amount: $${downPaymentAmount.toLocaleString()}`);
  console.log(`   Loan Amount: $${loanAmount.toLocaleString()}`);
  console.log(`   Monthly Payment: $${monthlyPayment}\n`);

  try {
    console.log('🚀 Sending webhook request to production...\n');

    const response = await fetch(`${baseUrl}/api/gohighlevel/webhook/save-property`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(propertyPayload)
    });

    console.log(`📥 Response status: ${response.status} ${response.statusText}\n`);

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Property saved successfully!');
      console.log('\n📝 Response data:');
      console.log(JSON.stringify(result.data, null, 2));

      const propertyId = result.data?.propertyId;

      console.log('\n⏳ Waiting 8 seconds for buyer matching to complete...');
      await new Promise(resolve => setTimeout(resolve, 8000));

      console.log('\n🔍 Checking results...\n');

      // Check if buyers were matched
      console.log('1️⃣ Checking if buyers were matched to this property...');

      const checkScript = `
        import { initializeApp } from 'firebase/app';
        import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

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

        const buyersQuery = query(
          collection(db, 'buyerProfiles'),
          where('matchedPropertyIds', 'array-contains', '${propertyId}')
        );

        const buyersSnapshot = await getDocs(buyersQuery);
        console.log(\`   ✅ Found \${buyersSnapshot.size} buyers matched!\`);

        buyersSnapshot.docs.forEach(doc => {
          const buyer = doc.data();
          console.log(\`      • \${buyer.firstName} \${buyer.lastName} (\${buyer.phone})\`);
        });
      `;

      console.log('\n📊 Summary:');
      console.log(`   Property ID: ${propertyId}`);
      console.log(`   Expected matches: All 6 Memphis buyers should match this affordable property`);
      console.log(`   Expected notifications: 6 SMS messages sent via GoHighLevel\n`);

      console.log('🔍 To verify manually:');
      console.log(`   1. Check Firestore: properties/${propertyId}`);
      console.log(`   2. Check buyers have this ID in matchedPropertyIds`);
      console.log(`   3. Check webhookLogs collection for SMS notification records`);
      console.log(`   4. Check GoHighLevel for SMS delivery status\n`);

    } else {
      console.error('❌ Failed to save property:');
      console.error(JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ Error during test:');
    console.error(error);
  }

  console.log('\n=================================================');
  console.log('🏁 Test complete!');
}

// Run the test
testNewMemphisProperty().catch(console.error);
