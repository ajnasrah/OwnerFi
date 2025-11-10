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

async function checkRecentQueueAdditions() {
  console.log('🔍 Checking recently added properties to video queue...\n');

  try {
    // Get most recent queue additions
    const queueSnapshot = await db.collection('property_rotation_queue')
      .orderBy('addedAt', 'desc')
      .limit(10)
      .get();

    if (queueSnapshot.empty) {
      console.log('❌ Queue is empty');
      return;
    }

    console.log(`📋 Last 10 properties added to queue:\n`);

    for (let i = 0; i < queueSnapshot.docs.length; i++) {
      const queueDoc = queueSnapshot.docs[i];
      const queueData = queueDoc.data();
      const propertyId = queueData.propertyId;

      // Get property details
      let propertyData: any = {};
      try {
        const propertyDoc = await db.collection('properties').doc(propertyId).get();
        if (propertyDoc.exists) {
          propertyData = propertyDoc.data();
        }
      } catch (err) {
        // Continue even if property fetch fails
      }

      const addedDate = queueData.addedAt ? new Date(queueData.addedAt).toLocaleString() : 'Unknown';
      const minutesAgo = queueData.addedAt ?
        ((Date.now() - queueData.addedAt) / (1000 * 60)).toFixed(1) :
        'Unknown';

      console.log(`${i + 1}. ${propertyData.address || 'Unknown Address'}`);
      console.log(`   City: ${propertyData.city || 'Unknown'}, ${propertyData.state || ''}`);
      console.log(`   Property ID: ${propertyId}`);
      console.log(`   Added: ${addedDate} (${minutesAgo} min ago)`);
      console.log(`   Status: ${queueData.status}`);
      console.log(`   Position: ${queueData.position || 'Not set'}`);
      console.log('');
    }

  } catch (error: any) {
    if (error.code === 9 && error.message.includes('index')) {
      console.log('⚠️  No index for addedAt - fetching without order...\n');

      const queueSnapshot = await db.collection('property_rotation_queue')
        .limit(10)
        .get();

      if (queueSnapshot.empty) {
        console.log('❌ Queue is empty');
        return;
      }

      console.log(`📋 Recent properties in queue (unordered):\n`);

      for (let i = 0; i < queueSnapshot.docs.length; i++) {
        const queueDoc = queueSnapshot.docs[i];
        const queueData = queueDoc.data();
        const propertyId = queueData.propertyId;

        const propertyDoc = await db.collection('properties').doc(propertyId).get();
        const propertyData = propertyDoc.exists ? propertyDoc.data() : {};

        console.log(`${i + 1}. ${propertyData?.address || 'Unknown'}`);
        console.log(`   Property ID: ${propertyId}`);
        console.log(`   Status: ${queueData.status}`);
        console.log('');
      }
    } else {
      console.error('❌ Error:', error);
    }
  }
}

checkRecentQueueAdditions()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
