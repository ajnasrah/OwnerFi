/**
 * Final test with a brand new Memphis property after the fix
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testFinalFix() {
  console.log('🧪 FINAL TEST - New Memphis Property After Fix');
  console.log('==============================================\n');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  console.log(`📡 Using: ${baseUrl}\n`);

  // Create a FRESH property with unique timestamp
  const propertyPayload = {
    opportunityId: 'final-test-' + Date.now(),
    propertyAddress: '789 Maple Avenue',
    propertyCity: 'Memphis',
    state: 'TN',
    price: 199000,
    bedrooms: 4,
    bathrooms: 2.5,
    livingArea: 2100,
    yearBuilt: 2010,
    lotSizes: '0.3 acre',
    homeType: 'Single Family',
    zipCode: '38104',
    downPayment: 8, // 8% down
    interestRate: 7.0,
    termYears: 30,
    description: 'Beautiful 4BR home in Memphis! Owner financing available.',
    imageLink: ''
  };

  console.log('🏠 Property Details:');
  console.log(`   Address: ${propertyPayload.propertyAddress}`);
  console.log(`   City: ${propertyPayload.propertyCity}, ${propertyPayload.state}`);
  console.log(`   Price: $${propertyPayload.price.toLocaleString()}`);
  console.log(`   Beds/Baths: ${propertyPayload.bedrooms}/${propertyPayload.bathrooms}`);
  console.log('');

  try {
    console.log('🚀 Sending to production webhook...\n');

    const response = await fetch(`${baseUrl}/api/gohighlevel/webhook/save-property`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(propertyPayload)
    });

    console.log(`📥 Response: ${response.status} ${response.statusText}\n`);

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ Property saved!\n');
      console.log('📝 Response:');
      console.log(JSON.stringify(result.data, null, 2));

      const propertyId = result.data?.propertyId;

      console.log('\n⏳ Waiting 10 seconds for processing...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Verify buyers were matched
      console.log('🔍 Verifying results...\n');

      const verifyScript = `
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

const app = initializeApp({
  apiKey: "${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}",
  authDomain: "${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}",
  projectId: "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}",
  storageBucket: "${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}",
});

const db = getFirestore(app);

(async () => {
  const buyersQuery = query(
    collection(db, 'buyerProfiles'),
    where('matchedPropertyIds', 'array-contains', '${propertyId}')
  );

  const buyersSnapshot = await getDocs(buyersQuery);

  console.log('📊 RESULTS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(\`✅ Matched Buyers: \${buyersSnapshot.size}\`);

  if (buyersSnapshot.size > 0) {
    console.log('');
    buyersSnapshot.docs.forEach(doc => {
      const buyer = doc.data();
      console.log(\`   • \${buyer.firstName} \${buyer.lastName} (\${buyer.phone})\`);
    });
    console.log('');
    console.log('📱 These buyers should receive SMS notifications!');
    console.log('   Check their phones or GoHighLevel dashboard.');
  } else {
    console.log('');
    console.log('❌ No buyers were matched!');
    console.log('   The buyer matching logic may not have run.');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
})();
`;

      // Save and run verification
      const fs = require('fs');
      fs.writeFileSync('/tmp/verify-match.js', verifyScript);

      const { execSync } = require('child_process');
      execSync('node /tmp/verify-match.js', { stdio: 'inherit' });

    } else {
      console.error('❌ Failed:');
      console.error(JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:');
    console.error(error);
  }

  console.log('\n==============================================');
  console.log('🏁 Test Complete!');
}

testFinalFix().catch(console.error);
