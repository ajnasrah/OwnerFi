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

async function checkAllProperties() {
  console.log('🔍 Checking ALL properties against video queue...\n');

  // Get all active properties
  const propertiesSnapshot = await db.collection('properties')
    .where('status', '==', 'active')
    .where('isActive', '==', true)
    .get();

  console.log(`Found ${propertiesSnapshot.size} active properties with isActive=true\n`);

  // Get all queue items
  const queueSnapshot = await db.collection('property_rotation_queue').get();
  const queuePropertyIds = new Set(queueSnapshot.docs.map(doc => doc.data().propertyId));

  console.log(`Found ${queueSnapshot.size} properties in video queue\n`);
  console.log('━'.repeat(80));

  let inQueue = 0;
  let notInQueue = 0;
  const missingFromQueue: any[] = [];

  for (const doc of propertiesSnapshot.docs) {
    const data = doc.data();
    const hasImages = data.imageUrls && data.imageUrls.length > 0;

    // Only check properties that have images (requirement for queue)
    if (!hasImages) continue;

    const isInQueue = queuePropertyIds.has(doc.id);

    if (isInQueue) {
      inQueue++;
    } else {
      notInQueue++;
      missingFromQueue.push({
        id: doc.id,
        address: data.address,
        city: data.city,
        state: data.state,
        source: data.source,
        createdAt: data.createdAt || data.dateAdded
      });
    }
  }

  console.log(`\n📊 SUMMARY:\n`);
  console.log(`✅ In queue: ${inQueue}`);
  console.log(`❌ NOT in queue: ${notInQueue}`);
  console.log('━'.repeat(80));

  if (missingFromQueue.length > 0) {
    console.log(`\n❌ PROPERTIES MISSING FROM QUEUE (active, has images, but not in queue):\n`);
    missingFromQueue.forEach((prop, i) => {
      const date = prop.createdAt ?
        (prop.createdAt.toDate ? new Date(prop.createdAt.toDate()).toLocaleString() : new Date(prop.createdAt).toLocaleString()) :
        'Unknown';
      console.log(`${i + 1}. ${prop.address}`);
      console.log(`   Location: ${prop.city}, ${prop.state}`);
      console.log(`   Property ID: ${prop.id}`);
      console.log(`   Source: ${prop.source}`);
      console.log(`   Created: ${date}`);
      console.log('');
    });
  } else {
    console.log('\n✅ ALL active properties with images are in the queue!');
  }
}

checkAllProperties()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
