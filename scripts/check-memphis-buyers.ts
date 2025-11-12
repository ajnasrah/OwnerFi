/**
 * Check which Memphis buyers would match the 5284 Flowering Peach property
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
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

// Test property details
const testProperty = {
  address: '5284 Flowering Peach',
  city: 'Memphis',
  state: 'TN',
  price: 189900,
  bedrooms: 3,
  bathrooms: 2,
  monthlyPayment: 1440, // Calculated: ~$189,900 @ 10% down, 7.5% interest, 25 years
  downPaymentAmount: 18990, // 10% of $189,900
};

async function checkMemphisBuyers() {
  console.log('🔍 Checking Memphis buyers for property match');
  console.log('==============================================\n');

  console.log('🏠 Property Details:');
  console.log(`   Address: ${testProperty.address}`);
  console.log(`   City: ${testProperty.city}, ${testProperty.state}`);
  console.log(`   Price: $${testProperty.price.toLocaleString()}`);
  console.log(`   Beds/Baths: ${testProperty.bedrooms}/${testProperty.bathrooms}`);
  console.log(`   Monthly Payment: $${testProperty.monthlyPayment}`);
  console.log(`   Down Payment: $${testProperty.downPaymentAmount.toLocaleString()}\n`);

  try {
    // Query all buyers in Tennessee
    console.log('📊 Querying buyers in Tennessee...\n');
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('preferredState', '==', 'TN')
    );

    const buyersSnapshot = await getDocs(buyersQuery);
    console.log(`   Found ${buyersSnapshot.size} buyers in Tennessee\n`);

    if (buyersSnapshot.empty) {
      console.log('⚠️  No buyers found in Tennessee!');
      console.log('   Create some test buyers first.\n');
      return;
    }

    // Check which buyers match
    let matchCount = 0;
    let memphisCount = 0;

    console.log('🎯 Checking matches:\n');

    for (const doc of buyersSnapshot.docs) {
      const buyer = doc.data();
      const buyerId = doc.id;

      // Get search criteria
      const criteria = buyer.searchCriteria || {};
      const buyerCities = criteria.cities || [buyer.preferredCity];
      const maxMonthly = criteria.maxMonthlyPayment || buyer.maxMonthlyPayment || 0;
      const maxDown = criteria.maxDownPayment || buyer.maxDownPayment || 0;

      // Check if buyer is looking in Memphis
      const isMemphisBuyer = buyerCities.some((city: string) =>
        city.toLowerCase() === 'memphis'
      );

      if (isMemphisBuyer) {
        memphisCount++;

        // Check if property matches their budget (OR logic)
        const monthlyMatch = testProperty.monthlyPayment <= maxMonthly;
        const downMatch = testProperty.downPaymentAmount <= maxDown;
        const budgetMatch = monthlyMatch || downMatch;

        // Check bedroom/bathroom requirements
        const bedroomMatch = !buyer.minBedrooms || testProperty.bedrooms >= buyer.minBedrooms;
        const bathroomMatch = !buyer.minBathrooms || testProperty.bathrooms >= buyer.minBathrooms;

        const fullMatch = budgetMatch && bedroomMatch && bathroomMatch;

        console.log(`   ${fullMatch ? '✅' : '❌'} ${buyer.firstName} ${buyer.lastName} (${buyerId.substring(0, 8)}...)`);
        console.log(`      Phone: ${buyer.phone || 'N/A'}`);
        console.log(`      Email: ${buyer.email || 'N/A'}`);
        console.log(`      Max Monthly: $${maxMonthly} ${monthlyMatch ? '✓' : '✗'}`);
        console.log(`      Max Down: $${maxDown.toLocaleString()} ${downMatch ? '✓' : '✗'}`);
        console.log(`      Budget Match: ${budgetMatch ? 'YES' : 'NO'} (OR logic)`);
        console.log(`      Min Beds: ${buyer.minBedrooms || 'Any'} ${bedroomMatch ? '✓' : '✗'}`);
        console.log(`      Min Baths: ${buyer.minBathrooms || 'Any'} ${bathroomMatch ? '✓' : '✗'}`);
        console.log(`      SMS Enabled: ${buyer.smsNotifications !== false ? 'YES' : 'NO'}`);
        console.log(`      Active: ${buyer.isActive !== false ? 'YES' : 'NO'}`);

        if (fullMatch) {
          matchCount++;
          console.log(`      🎉 WILL RECEIVE NOTIFICATION!`);
        } else {
          console.log(`      ⏭️  Will not match`);
        }
        console.log('');
      }
    }

    console.log('\n==============================================');
    console.log(`📊 Summary:`);
    console.log(`   Total TN buyers: ${buyersSnapshot.size}`);
    console.log(`   Memphis buyers: ${memphisCount}`);
    console.log(`   Matching buyers: ${matchCount}`);
    console.log(`   Notifications to send: ${matchCount}`);

    if (matchCount === 0) {
      console.log('\n⚠️  No buyers will be notified!');
      console.log('   Reasons:');
      console.log('   - Budget constraints (monthly payment or down payment too high)');
      console.log('   - Bedroom/bathroom requirements not met');
      console.log('   - SMS notifications disabled');
      console.log('   - Buyer profile inactive');
    }

  } catch (error) {
    console.error('❌ Error checking buyers:');
    console.error(error);
  }
}

// Run the check
checkMemphisBuyers().catch(console.error);
