/**
 * Test property auto-add to rotation queue
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testQueueAutoAdd() {
  console.log('🧪 Testing Property Auto-Add to Queue');
  console.log('====================================\n');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const propertyId = `test-queue-${Date.now()}`;

  // Create test property
  const propertyPayload = {
    opportunityId: propertyId,
    propertyAddress: '999 Queue Test Dr',
    propertyCity: 'Memphis',
    state: 'TN',
    price: 175000,
    bedrooms: 3,
    bathrooms: 2,
    livingArea: 1800,
    yearBuilt: 2015,
    lotSizes: '0.25 acre',
    homeType: 'Single Family',
    zipCode: '38104',
    downPayment: 10,
    interestRate: 7.0,
    termYears: 30,
    description: 'Test property for queue auto-add verification',
    imageLink: 'https://example.com/test.jpg'
  };

  console.log('1️⃣ Creating test property...');
  console.log(`   Address: ${propertyPayload.propertyAddress}`);
  console.log(`   City: ${propertyPayload.propertyCity}, ${propertyPayload.state}\n`);

  try {
    const response = await fetch(`${baseUrl}/api/gohighlevel/webhook/save-property`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(propertyPayload)
    });

    if (!response.ok) {
      throw new Error(`Property creation failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Property created successfully\n');

    // Wait for auto-add to complete
    console.log('2️⃣ Waiting 5 seconds for auto-add...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if property is in queue
    console.log('3️⃣ Checking if property was added to queue...\n');

    const { initializeApp } = require('firebase/app');
    const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

    const app = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });

    const db = getFirestore(app);

    // Check property_videos collection
    const queueQuery = query(
      collection(db, 'property_videos'),
      where('propertyId', '==', propertyId)
    );

    const queueSnapshot = await getDocs(queueQuery);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (queueSnapshot.size > 0) {
      console.log('✅ SUCCESS! Property was auto-added to queue');
      console.log(`   Found ${queueSnapshot.size} workflow(s)\n`);

      queueSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   Workflow ID: ${doc.id}`);
        console.log(`   Property ID: ${data.propertyId}`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Source: ${data.source}`);
        console.log('');
      });

      console.log('🎉 AUTO-ADD IS WORKING!\n');
      return { success: true, propertyId };
    } else {
      console.log('❌ FAILED! Property NOT in queue');
      console.log('   The auto-add logic did not work\n');
      return { success: false, propertyId };
    }

  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, error };
  }
}

testQueueAutoAdd()
  .then(result => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (result.success) {
      console.log('✅ Test property ID:', result.propertyId);
      console.log('\nTo delete this test property, use the admin panel or run:');
      console.log(`firebase firestore:delete properties/${result.propertyId}`);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
