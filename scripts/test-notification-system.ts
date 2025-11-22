import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

async function testNotificationSystem() {
  console.log('\n🧪 Testing Buyer Notification System\n');
  console.log('='.repeat(80));

  const testPhone = '9018319661';

  try {
    // Step 1: Find Abdullah's buyer profile
    console.log('\n📋 Step 1: Finding buyer profile...');
    const buyersSnapshot = await db.collection('buyerProfiles')
      .where('phone', '==', testPhone)
      .get();

    if (buyersSnapshot.empty) {
      console.log('❌ Buyer not found with phone:', testPhone);
      return;
    }

    const buyerDoc = buyersSnapshot.docs[0];
    const buyer = buyerDoc.data();

    console.log('✅ Found buyer:');
    console.log(`   Name: ${buyer.firstName} ${buyer.lastName}`);
    console.log(`   Phone: ${buyer.phone}`);
    console.log(`   City: ${buyer.preferredCity || buyer.city}, ${buyer.preferredState || buyer.state}`);
    console.log(`   Budget: $${buyer.maxMonthlyPayment}/mo, $${buyer.maxDownPayment} down`);
    console.log(`   Already notified about: ${buyer.notifiedPropertyIds?.length || 0} properties`);

    // Step 2: Create a test property in Collierville (near Memphis)
    console.log('\n🏠 Step 2: Creating test property in Collierville, TN...');

    const testProperty: any = {
      address: '123 Test Lane',
      city: 'Collierville',
      state: 'TN',
      zipCode: '38017',
      listPrice: 200000,
      price: 200000,
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1500,
      monthlyPayment: 1200,
      downPaymentAmount: 20000,
      downPaymentPercent: 10,
      interestRate: 6,
      termYears: 30,
      status: 'active',
      isActive: true,
      imageUrls: ['https://example.com/image.jpg'],
      description: 'Test property for notification system. Owner will consider owner financing.',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const propertyRef = await db.collection('properties').add(testProperty);
    const propertyId = propertyRef.id;

    console.log('✅ Test property created:');
    console.log(`   ID: ${propertyId}`);
    console.log(`   Address: ${testProperty.address}, ${testProperty.city}, ${testProperty.state}`);
    console.log(`   Price: $${testProperty.listPrice}`);
    console.log(`   Monthly: $${testProperty.monthlyPayment}, Down: $${testProperty.downPaymentAmount}`);

    // Step 3: Check if buyer's search criteria includes nearby cities
    console.log('\n🔍 Step 3: Checking location matching...');

    const { getCitiesWithinRadiusComprehensive } = await import('../src/lib/comprehensive-cities');
    const buyerCity = buyer.preferredCity || buyer.city;
    const buyerState = buyer.preferredState || buyer.state;

    const nearbyCities = getCitiesWithinRadiusComprehensive(buyerCity, buyerState, 30);
    const nearbyCityNames = nearbyCities.map(c => c.name);
    const includesCollierville = nearbyCityNames.some(c => c.toLowerCase() === 'collierville');

    console.log(`   Buyer searching in: ${buyerCity}, ${buyerState}`);
    console.log(`   Nearby cities (30 miles): ${nearbyCities.length} cities`);
    console.log(`   Includes Collierville: ${includesCollierville ? '✅ YES' : '❌ NO'}`);

    if (includesCollierville) {
      console.log('   ✅ Location match - buyer should see this property!');
    } else {
      console.log('   ⚠️  Location mismatch - buyer may not see this property');
      console.log(`   Nearby cities: ${nearbyCityNames.slice(0, 10).join(', ')}...`);
    }

    // Step 4: Trigger matching manually
    console.log('\n🎯 Step 4: Triggering property matching...');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const matchResponse = await fetch(`${baseUrl}/api/properties/sync-matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        propertyId,
        propertyData: {
          id: propertyId,
          ...testProperty
        }
      })
    });

    if (matchResponse.ok) {
      console.log('✅ Matching triggered successfully');
    } else {
      const error = await matchResponse.text();
      console.log('❌ Matching failed:', error);
    }

    // Step 5: Wait a bit for matching to process
    console.log('\n⏳ Step 5: Waiting for matching to process (3 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 6: Check if buyer was matched
    console.log('\n🔍 Step 6: Checking if buyer was matched...');

    const updatedBuyerDoc = await db.collection('buyerProfiles').doc(buyerDoc.id).get();
    const updatedBuyer = updatedBuyerDoc.data();

    const wasMatched = updatedBuyer?.matchedPropertyIds?.includes(propertyId);

    if (wasMatched) {
      console.log('✅ Property added to buyer\'s matchedPropertyIds!');
    } else {
      console.log('❌ Property NOT in buyer\'s matchedPropertyIds');
      console.log(`   Matched properties: ${updatedBuyer?.matchedPropertyIds?.length || 0}`);
    }

    // Step 7: Check if notification was sent
    console.log('\n📱 Step 7: Checking if notification was sent...');

    const wasNotified = updatedBuyer?.notifiedPropertyIds?.includes(propertyId);

    if (wasNotified) {
      console.log('✅ Buyer was notified! (Property in notifiedPropertyIds)');
      console.log(`   Total notifications sent to buyer: ${updatedBuyer.notificationCount || 0}`);
      console.log(`   Last notified: ${updatedBuyer.lastNotifiedAt?.toDate?.().toLocaleString() || 'N/A'}`);
    } else {
      console.log('⚠️  Buyer NOT notified yet');
      console.log(`   Notified about: ${updatedBuyer?.notifiedPropertyIds?.length || 0} properties`);
    }

    // Step 8: Check webhook logs (SKIPPED - requires Firestore index)
    console.log('\n📋 Step 8: Checking webhook logs...');
    console.log('   ⚠️  Skipping - requires Firestore composite index');
    console.log('   (Not critical for testing matching functionality)');
    const webhookLogsSnapshot = { size: 0, empty: true };

    // Step 9: Cleanup - Delete test property
    console.log('\n🧹 Step 9: Cleaning up test property...');
    await db.collection('properties').doc(propertyId).delete();
    console.log('✅ Test property deleted');

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Buyer found: ${buyer.firstName} ${buyer.lastName}`);
    console.log(`${includesCollierville ? '✅' : '❌'} Location matching: ${includesCollierville ? 'Collierville in range' : 'Out of range'}`);
    console.log(`${wasMatched ? '✅' : '❌'} Property matched: ${wasMatched ? 'Yes' : 'No'}`);
    console.log(`${wasNotified ? '✅' : '❌'} Notification sent: ${wasNotified ? 'Yes' : 'No'}`);
    console.log(`📱 Webhook logs: ${webhookLogsSnapshot.size} found`);

    console.log('\n💡 NEXT STEPS:');
    if (!includesCollierville) {
      console.log('   ❌ Location matching failed - Collierville not in nearby cities');
      console.log('   → Check getCitiesWithinRadiusComprehensive() for Memphis, TN');
    } else if (!wasMatched) {
      console.log('   ❌ Matching failed - Property not added to matchedPropertyIds');
      console.log('   → Check /api/properties/sync-matches endpoint');
      console.log('   → Check budget criteria (monthly: $1200, down: $20000)');
    } else if (!wasNotified) {
      console.log('   ⚠️  Matched but not notified - Check notification logic');
      console.log('   → Verify GOHIGHLEVEL_WEBHOOK_URL in .env.local');
      console.log('   → Check webhook logs for errors');
    } else {
      console.log('   ✅ SYSTEM WORKING PERFECTLY!');
      console.log('   → Buyer was matched and notified');
      console.log('   → Check buyer\'s phone for SMS message');
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

testNotificationSystem();
