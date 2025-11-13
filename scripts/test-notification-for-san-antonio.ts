import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function testNotification() {
  try {
    const propertyId = '5di4UYPJgQdJwEH1Cfh4'; // San Antonio property

    console.log('\n🔍 Testing Notification Logic for San Antonio Property');
    console.log('='.repeat(80));

    // Get the property
    const propertyDoc = await db.collection('properties').doc(propertyId).get();
    if (!propertyDoc.exists) {
      console.log('❌ Property not found');
      return;
    }

    const property = propertyDoc.data()!;
    console.log(`\nProperty: ${property.address}, ${property.city}, ${property.state}`);
    console.log(`Price: $${property.price?.toLocaleString()}`);
    console.log(`Monthly: $${property.monthlyPayment} | Down: $${property.downPaymentAmount?.toLocaleString()}`);
    console.log(`Beds/Baths: ${property.bedrooms}/${property.bathrooms}`);

    // Check buyer that should match: Abir Besbes
    console.log('\n\n👤 Checking Buyer: Abir Besbes');
    console.log('='.repeat(80));

    const buyersSnapshot = await db.collection('buyerProfiles')
      .where('phone', '==', '2063954410')
      .get();

    if (buyersSnapshot.empty) {
      console.log('❌ Buyer not found');
      return;
    }

    const buyerDoc = buyersSnapshot.docs[0];
    const buyer = buyerDoc.data();

    console.log(`\nBuyer: ${buyer.firstName} ${buyer.lastName}`);
    console.log(`Phone: ${buyer.phone}`);
    console.log(`State: ${buyer.preferredState}`);
    console.log(`Cities: ${(buyer.searchCriteria?.cities || [buyer.preferredCity]).join(', ')}`);
    console.log(`Max Monthly: $${buyer.searchCriteria?.maxMonthlyPayment || buyer.maxMonthlyPayment}`);
    console.log(`Max Down: $${buyer.searchCriteria?.maxDownPayment || buyer.maxDownPayment}`);

    // Test matching logic
    console.log('\n\n🧮 Testing Match Logic');
    console.log('='.repeat(80));

    const criteria = buyer.searchCriteria || {};
    const buyerCities = criteria.cities || [buyer.preferredCity];

    // Check location match
    const locationMatch = buyer.preferredState === property.state &&
      buyerCities.some((city: string) =>
        city.toLowerCase() === property.city.toLowerCase()
      );

    console.log(`\n1. Location Match: ${locationMatch ? '✅' : '❌'}`);
    console.log(`   Buyer state: ${buyer.preferredState} vs Property state: ${property.state}`);
    console.log(`   Buyer cities: ${buyerCities.join(', ')} vs Property city: ${property.city}`);

    // Check budget match
    const maxMonthly = criteria.maxMonthlyPayment || buyer.maxMonthlyPayment || 0;
    const maxDown = criteria.maxDownPayment || buyer.maxDownPayment || 0;
    const monthlyMatch = property.monthlyPayment <= maxMonthly;
    const downMatch = property.downPaymentAmount <= maxDown;
    const budgetMatch = monthlyMatch || downMatch;

    console.log(`\n2. Budget Match: ${budgetMatch ? '✅' : '❌'}`);
    console.log(`   Monthly: $${property.monthlyPayment} <= $${maxMonthly} = ${monthlyMatch ? '✅' : '❌'}`);
    console.log(`   Down: $${property.downPaymentAmount} <= $${maxDown} = ${downMatch ? '✅' : '❌'}`);
    console.log(`   Overall (OR logic): ${budgetMatch ? '✅' : '❌'}`);

    // Check requirements
    const requirementsMatch =
      (!buyer.minBedrooms || property.bedrooms >= buyer.minBedrooms) &&
      (!buyer.minBathrooms || property.bathrooms >= buyer.minBathrooms);

    console.log(`\n3. Requirements Match: ${requirementsMatch ? '✅' : '❌'}`);
    console.log(`   Beds: ${property.bedrooms} >= ${buyer.minBedrooms || 'any'} = ${!buyer.minBedrooms || property.bedrooms >= buyer.minBedrooms ? '✅' : '❌'}`);
    console.log(`   Baths: ${property.bathrooms} >= ${buyer.minBathrooms || 'any'} = ${!buyer.minBathrooms || property.bathrooms >= buyer.minBathrooms ? '✅' : '❌'}`);

    const overallMatch = locationMatch && budgetMatch && requirementsMatch;

    console.log(`\n\n🎯 OVERALL MATCH: ${overallMatch ? '✅ YES' : '❌ NO'}`);

    if (overallMatch) {
      console.log('\n\n📱 SMS Message that SHOULD have been sent:');
      console.log('='.repeat(80));
      const smsMessage = `🏠 New Property Match!

Hi ${buyer.firstName}! We found a home for you in ${property.city}, ${property.state}:

📍 ${property.address}
🛏️ ${property.bedrooms} bed, ${property.bathrooms} bath
💰 $${property.price?.toLocaleString()} list price
💵 $${property.monthlyPayment}/mo, $${property.downPaymentAmount?.toLocaleString()} down

View it now: https://ownerfi.ai/dashboard

Reply STOP to unsubscribe`;

      console.log(smsMessage);
      console.log('\n' + '='.repeat(80));

      // Check if property is in buyer's matchedPropertyIds
      if (buyer.matchedPropertyIds?.includes(propertyId)) {
        console.log('\n✅ Property IS in buyer\'s matchedPropertyIds array');
      } else {
        console.log('\n❌ Property NOT in buyer\'s matchedPropertyIds array');
        console.log(`   Current matched IDs: ${buyer.matchedPropertyIds?.join(', ') || 'none'}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testNotification();
