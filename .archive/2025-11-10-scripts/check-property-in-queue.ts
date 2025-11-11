import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

// Initialize Firebase Admin
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

async function checkPropertyInQueue(address: string) {
  console.log(`🔍 Checking if "${address}" is in video queue...\n`);

  try {
    // Find the property
    const propertiesSnapshot = await db.collection('properties')
      .where('address', '==', address)
      .limit(1)
      .get();

    if (propertiesSnapshot.empty) {
      console.log(`❌ Property not found with address: ${address}`);
      return;
    }

    const propertyDoc = propertiesSnapshot.docs[0];
    const propertyId = propertyDoc.id;
    const propertyData = propertyDoc.data();

    console.log(`✅ Found property:`);
    console.log(`   ID: ${propertyId}`);
    console.log(`   Address: ${propertyData.address}`);
    console.log(`   City: ${propertyData.city}, ${propertyData.state}`);
    console.log(`   Price: $${propertyData.listPrice?.toLocaleString()}`);
    console.log(`   Status: ${propertyData.status}`);
    console.log(`   Active: ${propertyData.isActive}`);
    console.log(`   Images: ${propertyData.imageUrls?.length || 0}`);
    console.log('');

    // Check if in rotation queue
    const queueSnapshot = await db.collection('property_rotation_queue')
      .where('propertyId', '==', propertyId)
      .limit(1)
      .get();

    if (queueSnapshot.empty) {
      console.log(`❌ NOT in rotation queue!`);
      console.log('');
      console.log('💡 To add to queue:');
      console.log(`   Property must be:`);
      console.log(`   - status: 'active' (current: ${propertyData.status})`);
      console.log(`   - isActive: true (current: ${propertyData.isActive})`);
      console.log(`   - Have images (current: ${propertyData.imageUrls?.length || 0})`);
      console.log('');

      if (propertyData.status === 'active' && propertyData.isActive && propertyData.imageUrls?.length > 0) {
        console.log('✅ Property meets criteria - adding to queue now...');

        const { addToPropertyRotationQueue } = await import('@/lib/feed-store-firestore');
        await addToPropertyRotationQueue(propertyId);

        console.log('✅ ADDED TO QUEUE!');
      } else {
        console.log('⚠️  Property does NOT meet criteria to be in queue');
      }
      return;
    }

    const queueData = queueSnapshot.docs[0].data();

    console.log(`✅ IN ROTATION QUEUE!`);
    console.log(`   Queue Status: ${queueData.status}`);
    console.log(`   Position: ${queueData.position || 'Not set'}`);
    console.log(`   Video Count: ${queueData.videoCount || 0} times shown`);
    console.log(`   Current Cycle: ${queueData.currentCycleCount || 0}`);
    console.log(`   Added: ${queueData.addedAt ? new Date(queueData.addedAt).toLocaleString() : 'Unknown'}`);
    console.log(`   Last Updated: ${queueData.updatedAt ? new Date(queueData.updatedAt).toLocaleString() : 'Unknown'}`);
    console.log('');

    if (queueData.status === 'queued') {
      console.log('✅ Ready to generate video (waiting for cron job)');
    } else if (queueData.status === 'processing') {
      console.log('🎥 Video generation in progress');
    } else if (queueData.status === 'completed') {
      console.log('✅ Video already generated this cycle');
    }

    // Check if any videos exist
    const videosSnapshot = await db.collection('property_videos')
      .where('propertyId', '==', propertyId)
      .get();

    if (!videosSnapshot.empty) {
      console.log('');
      console.log(`📹 Existing videos: ${videosSnapshot.size}`);
      videosSnapshot.forEach(doc => {
        const video = doc.data();
        console.log(`   - ${video.variant}: ${video.status} (${video.createdAt ? new Date(video.createdAt).toLocaleString() : 'Unknown'})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

const address = process.argv[2] || '348 Alhambra Pl';
checkPropertyInQueue(address)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
