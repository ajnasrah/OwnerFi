import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function checkQueueVsProperties() {
  console.log('📊 Checking Properties vs Queue...\n');

  // Count total active properties
  const propertiesSnapshot = await db.collection('properties')
    .where('isActive', '==', true)
    .get();

  console.log(`Total active properties: ${propertiesSnapshot.size}`);

  // Count properties in rotation queue
  const queueSnapshot = await db.collection('property_rotation_queue').get();
  console.log(`Properties in rotation queue: ${queueSnapshot.size}`);

  const missing = propertiesSnapshot.size - queueSnapshot.size;
  console.log(`\nMissing from queue: ${missing}`);

  if (missing > 0) {
    console.log('\n⚠️  Queue is missing properties!');
    console.log(`   ${missing} active properties are NOT in the rotation queue`);
    console.log('\n💡 Solution: Run populate-queue endpoint to add them');
    console.log('   Endpoint: POST /api/property/populate-queue');
    console.log('   This should be called automatically when queue is empty');
  } else {
    console.log('\n✅ All active properties are in the rotation queue');
  }
}

checkQueueVsProperties().catch(console.error);
