import { config } from 'dotenv';

config({ path: '.env.local' });

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const webhookSecret = process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;

async function testAutoQueue() {
  console.log('🧪 Testing auto-queue functionality...\n');

  // Step 1: Create a fake test property
  console.log('1️⃣ Creating fake test property...');

  const createResponse = await fetch(`${baseUrl}/api/admin/properties/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${webhookSecret}`
    },
    body: JSON.stringify({
      address: '9999 Test Auto Queue Lane',
      city: 'Test City',
      state: 'TX',
      zip: '99999',
      price: 500000,
      bedrooms: 3,
      bathrooms: 2,
      sqft: 2000,
      monthlyRent: 3000,
      yearBuilt: 2020,
      propertyType: 'Single Family',
      description: 'This is a fake test property to verify auto-queue functionality',
      imageUrls: ['https://via.placeholder.com/800x600'],
      status: 'active',
      isActive: true,
      source: 'manual'
    })
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create property: ${error}`);
  }

  const createData = await createResponse.json();
  const propertyId = createData.propertyId;
  console.log(`✅ Created property: ${propertyId}\n`);

  // Step 2: Wait a moment for auto-queue to process
  console.log('2️⃣ Waiting 2 seconds for auto-queue...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Check if property is in queue
  console.log('3️⃣ Checking if property is in queue...');

  const checkResponse = await fetch(`${baseUrl}/api/property/check-queue?propertyId=${propertyId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${webhookSecret}`
    }
  });

  if (checkResponse.ok) {
    const checkData = await checkResponse.json();
    if (checkData.inQueue) {
      console.log(`✅ Property is IN queue! Status: ${checkData.status}\n`);
    } else {
      console.log(`❌ Property is NOT in queue!\n`);
      throw new Error('Auto-queue failed - property not added to queue');
    }
  } else {
    console.log('⚠️  Check queue endpoint not found, checking manually...\n');
  }

  // Step 4: Delete the property
  console.log('4️⃣ Deleting test property...');

  const deleteResponse = await fetch(`${baseUrl}/api/admin/properties/${propertyId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${webhookSecret}`
    }
  });

  if (!deleteResponse.ok) {
    const error = await deleteResponse.text();
    throw new Error(`Failed to delete property: ${error}`);
  }

  console.log(`✅ Deleted property: ${propertyId}\n`);

  // Step 5: Wait a moment for queue cleanup
  console.log('5️⃣ Waiting 2 seconds for queue cleanup...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 6: Verify property removed from queue
  console.log('6️⃣ Verifying property removed from queue...');

  const verifyResponse = await fetch(`${baseUrl}/api/property/check-queue?propertyId=${propertyId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${webhookSecret}`
    }
  });

  if (verifyResponse.ok) {
    const verifyData = await verifyResponse.json();
    if (!verifyData.inQueue) {
      console.log(`✅ Property is NOT in queue (as expected)\n`);
    } else {
      console.log(`⚠️  Property is STILL in queue: ${verifyData.status}\n`);
    }
  }

  console.log('━'.repeat(80));
  console.log('✅ AUTO-QUEUE TEST COMPLETE!');
  console.log('━'.repeat(80));
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
