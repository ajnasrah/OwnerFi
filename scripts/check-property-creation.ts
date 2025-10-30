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

async function checkPropertyCreation(address: string) {
  console.log(`🔍 Checking when "${address}" was created...\n`);

  const propertiesSnapshot = await db.collection('properties')
    .where('address', '==', address)
    .limit(1)
    .get();

  if (propertiesSnapshot.empty) {
    console.log(`❌ Property not found`);
    return;
  }

  const propertyDoc = propertiesSnapshot.docs[0];
  const data = propertyDoc.data();

  console.log(`Property: ${data.address}`);
  console.log(`ID: ${propertyDoc.id}`);
  console.log(`Created: ${data.dateAdded || data.createdAt || 'Unknown'}`);
  console.log(`Source: ${data.source || 'Unknown'}`);
  console.log(`Status: ${data.status}`);
  console.log(`isActive: ${data.isActive}`);
  console.log(`Images: ${data.imageUrls?.length || 0}`);
  console.log('');

  // Check if this was created via admin API or GHL webhook
  if (data.source === 'manual') {
    console.log('✅ Created via admin API - SHOULD have auto-added to queue');
  } else if (data.source === 'gohighlevel') {
    console.log('⚠️  Created via GHL webhook - check if GHL webhook adds to queue');
  } else {
    console.log(`⚠️  Created via: ${data.source || 'unknown source'}`);
  }

  console.log('');
  console.log('🔍 CHECKING WHY IT WASN\'T AUTO-ADDED:');
  console.log('');

  // Check conditions
  const isActive = data.status === 'active';
  const isActiveFlag = data.isActive === true;
  const hasImages = data.imageUrls && data.imageUrls.length > 0;

  console.log(`Condition 1 - status === 'active': ${isActive ? '✅' : '❌'} (${data.status})`);
  console.log(`Condition 2 - isActive === true: ${isActiveFlag ? '✅' : '❌'} (${data.isActive})`);
  console.log(`Condition 3 - has images: ${hasImages ? '✅' : '❌'} (${data.imageUrls?.length || 0} images)`);

  console.log('');

  if (isActive && isActiveFlag && hasImages) {
    console.log('✅ ALL conditions met - should have been auto-added');
    console.log('');
    console.log('🔍 Possible reasons it wasn\'t added:');
    console.log('1. fetch() call failed silently (caught and logged)');
    console.log('2. WEBHOOK_SECRET/CRON_SECRET not set');
    console.log('3. add-to-queue endpoint returned error');
    console.log('4. Property created BEFORE auto-add code was implemented');
    console.log('');
    console.log('💡 Check server logs around creation time for errors');
  } else {
    console.log('❌ Conditions NOT met at creation time - would not auto-add');
  }
}

checkPropertyCreation('348 Alhambra Pl')
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
