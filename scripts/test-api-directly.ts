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

async function testApiDirectly() {
  console.log('\n🧪 Testing Sync-Matches API Directly\n');

  try {
    // Create a test property (WITHOUT id - it will be set by Firestore)
    const testProperty = {
      address: '123 Test Lane',
      city: 'Collierville',
      state: 'TN',
      zipCode: '38017',
      listPrice: 200000,
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1500,
      monthlyPayment: 1200,
      downPaymentAmount: 20000,
      imageUrls: [],
      isActive: true,
      status: 'active',
    };

    // Save to properties collection
    const propertyRef = await db.collection('properties').add(testProperty);
    const propertyId = propertyRef.id;

    console.log('✅ Created test property:', propertyId);

    // Call sync-matches API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
    console.log(`\n📞 Calling ${baseUrl}/api/properties/sync-matches`);

    const payload = {
      action: 'add',
      propertyId,
      propertyData: {
        id: propertyId,
        ...testProperty
      }
    };

    console.log('\n📦 Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${baseUrl}/api/properties/sync-matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('\n📊 Response Status:', response.status, response.statusText);

    const responseText = await response.text();
    console.log('📊 Response Body:', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
      console.log('\n📊 Parsed Response:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('⚠️  Response is not JSON');
    }

    // Check if Abdullah was matched
    console.log('\n\n🔍 Checking if Abdullah was matched...');

    const abdullahSnapshot = await db.collection('buyerProfiles')
      .where('phone', '==', '9018319661')
      .get();

    if (!abdullahSnapshot.empty) {
      const abdullah = abdullahSnapshot.docs[0].data();
      const wasMatched = abdullah.matchedPropertyIds?.includes(propertyId);

      if (wasMatched) {
        console.log('✅✅✅ SUCCESS! Abdullah was matched!');
        console.log(`   matchedPropertyIds: ${abdullah.matchedPropertyIds?.length || 0} properties`);
        console.log(`   Property ${propertyId} is in the list`);
      } else {
        console.log('❌ FAILED: Abdullah was NOT matched');
        console.log(`   matchedPropertyIds: ${abdullah.matchedPropertyIds?.length || 0} properties`);
        console.log(`   Property ${propertyId} is NOT in the list`);
      }
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test property...');
    await db.collection('properties').doc(propertyId).delete();
    console.log('✅ Deleted');

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

testApiDirectly();
