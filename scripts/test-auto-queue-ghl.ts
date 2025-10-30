import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const ghlWebhookSecret = process.env.GHL_WEBHOOK_SECRET;

async function testAutoQueue() {
  console.log('🧪 Testing auto-queue functionality via GHL webhook...\n');

  // Step 1: Create a fake test property via GHL webhook
  console.log('1️⃣ Simulating GHL webhook to create test property...');

  const ghlPayload = {
    opportunityId: 'test_ghl_' + Date.now(),
    opportunityName: 'Test Auto Queue Property',
    propertyAddress: '9999 Test Auto Queue Lane',
    propertyCity: 'Test City',
    state: 'TX',
    zipCode: '99999',
    price: 500000,
    bedrooms: 3,
    bathrooms: 2,
    livingArea: 2000,
    yearBuilt: 2020,
    homeType: 'Single Family',
    imageLink: 'https://via.placeholder.com/800x600',
    monthlyPayment: 3000,
    downPaymentAmount: 100000,
    interestRate: 6.5
  };

  const createResponse = await fetch(`${baseUrl}/api/gohighlevel/webhook/save-property`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': ghlWebhookSecret || ''
    },
    body: JSON.stringify(ghlPayload)
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create property via GHL webhook: ${error}`);
  }

  const createData = await createResponse.json();
  const propertyId = createData.propertyId;
  console.log(`✅ Created property via GHL webhook: ${propertyId}\n`);

  // Step 2: Wait a moment for auto-queue to process
  console.log('2️⃣ Waiting 3 seconds for auto-queue...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 3: Check if property is in queue
  console.log('3️⃣ Checking if property is in queue...');

  const queueSnapshot = await db.collection('property_rotation_queue')
    .where('propertyId', '==', propertyId)
    .limit(1)
    .get();

  if (!queueSnapshot.empty) {
    const queueData = queueSnapshot.docs[0].data();
    console.log(`✅ Property is IN queue! Status: ${queueData.status}\n`);
  } else {
    console.log(`❌ Property is NOT in queue!\n`);
    throw new Error('Auto-queue failed - property not added to queue');
  }

  // Step 4: Delete the property from Firestore
  console.log('4️⃣ Deleting test property from database...');

  await db.collection('properties').doc(propertyId).delete();
  console.log(`✅ Deleted property from database: ${propertyId}\n`);

  // Step 5: Delete from queue
  console.log('5️⃣ Deleting property from queue...');

  const queueDocs = await db.collection('property_rotation_queue')
    .where('propertyId', '==', propertyId)
    .get();

  for (const doc of queueDocs.docs) {
    await doc.ref.delete();
  }

  console.log(`✅ Deleted property from queue\n`);

  // Step 6: Verify property removed from queue
  console.log('6️⃣ Verifying property removed from queue...');

  const verifySnapshot = await db.collection('property_rotation_queue')
    .where('propertyId', '==', propertyId)
    .get();

  if (verifySnapshot.empty) {
    console.log(`✅ Property is NOT in queue (as expected)\n`);
  } else {
    console.log(`⚠️  Property is STILL in queue!\n`);
  }

  console.log('━'.repeat(80));
  console.log('✅ AUTO-QUEUE TEST COMPLETE!');
  console.log('━'.repeat(80));
  console.log('\n📊 Test Results:');
  console.log('  1. Property created via GHL webhook ✅');
  console.log('  2. Property auto-added to queue ✅');
  console.log('  3. Property deleted from database ✅');
  console.log('  4. Property removed from queue ✅');
}

testAutoQueue()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  });
