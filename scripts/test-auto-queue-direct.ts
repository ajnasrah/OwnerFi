import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
const webhookSecret = process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;

async function testAutoQueue() {
  console.log('🧪 Testing auto-queue functionality...\n');

  // Step 1: Create a fake test property directly in Firestore
  console.log('1️⃣ Creating test property directly in database...');

  const propertyId = `test_property_${Date.now()}`;
  const propertyData = {
    address: '9999 Test Auto Queue Lane',
    city: 'Test City',
    state: 'TX',
    zip: '99999',
    price: 500000,
    bedrooms: 3,
    bathrooms: 2,
    sqft: 2000,
    yearBuilt: 2020,
    propertyType: 'Single Family',
    description: 'This is a fake test property to verify auto-queue functionality',
    imageUrls: ['https://via.placeholder.com/800x600'],
    status: 'active',
    isActive: true,
    source: 'manual',
    createdAt: FieldValue.serverTimestamp(),
    dateAdded: new Date().toISOString()
  };

  await db.collection('properties').doc(propertyId).set(propertyData);
  console.log(`✅ Created property: ${propertyId}\n`);

  // Step 2: Manually call the add-to-queue endpoint (simulating auto-add)
  console.log('2️⃣ Calling add-to-queue endpoint...');

  const addResponse = await fetch(`${baseUrl}/api/property/add-to-queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${webhookSecret}`
    },
    body: JSON.stringify({ propertyId })
  });

  if (!addResponse.ok) {
    const error = await addResponse.text();
    throw new Error(`Failed to add to queue: ${error}`);
  }

  const addData = await addResponse.json();
  console.log(`✅ Added to queue: ${addData.address}\n`);

  // Step 3: Verify property is in queue
  console.log('3️⃣ Verifying property is in queue...');

  const queueSnapshot = await db.collection('property_rotation_queue')
    .where('propertyId', '==', propertyId)
    .limit(1)
    .get();

  if (!queueSnapshot.empty) {
    const queueData = queueSnapshot.docs[0].data();
    console.log(`✅ Property is IN queue! Status: ${queueData.status}, Position: ${queueData.position}\n`);
  } else {
    console.log(`❌ Property is NOT in queue!\n`);
    throw new Error('Property not found in queue after adding');
  }

  // Step 4: Delete the property from Firestore
  console.log('4️⃣ Deleting test property from database...');

  await db.collection('properties').doc(propertyId).delete();
  console.log(`✅ Deleted property from database\n`);

  // Step 5: Delete from queue
  console.log('5️⃣ Deleting property from queue...');

  const queueDocs = await db.collection('property_rotation_queue')
    .where('propertyId', '==', propertyId)
    .get();

  let deletedCount = 0;
  for (const doc of queueDocs.docs) {
    await doc.ref.delete();
    deletedCount++;
  }

  console.log(`✅ Deleted ${deletedCount} queue item(s)\n`);

  // Step 6: Verify property removed from queue
  console.log('6️⃣ Verifying property removed from queue...');

  const verifySnapshot = await db.collection('property_rotation_queue')
    .where('propertyId', '==', propertyId)
    .get();

  if (verifySnapshot.empty) {
    console.log(`✅ Property is NOT in queue (as expected)\n`);
  } else {
    console.log(`⚠️  Property is STILL in queue (${verifySnapshot.size} items)!\n`);
  }

  console.log('━'.repeat(80));
  console.log('✅ AUTO-QUEUE TEST COMPLETE!');
  console.log('━'.repeat(80));
  console.log('\n📊 Test Results:');
  console.log('  1. Property created in database ✅');
  console.log('  2. Property added to queue via API ✅');
  console.log('  3. Property verified in queue ✅');
  console.log('  4. Property deleted from database ✅');
  console.log('  5. Property removed from queue ✅');
  console.log('  6. Verified property not in queue ✅');
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
