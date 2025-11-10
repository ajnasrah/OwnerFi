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

async function checkLatestProperty() {
  console.log('🔍 Checking latest properties added to database...\n');

  try {
    // Get most recently created properties
    const snapshot = await db.collection('properties')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (snapshot.empty) {
      console.log('❌ No properties found');
      return;
    }

    console.log(`📋 Last 5 properties created:\n`);

    for (let i = 0; i < snapshot.docs.length; i++) {
      const doc = snapshot.docs[i];
      const data = doc.data();

      const createdDate = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString() :
                          data.dateAdded ? new Date(data.dateAdded).toLocaleString() : 'Unknown';
      const secondsAgo = data.createdAt ?
        ((Date.now() - data.createdAt.toMillis()) / 1000).toFixed(0) :
        'Unknown';

      console.log(`${i + 1}. ${data.address || 'Unknown Address'}`);
      console.log(`   City: ${data.city || 'Unknown'}, ${data.state || ''}`);
      console.log(`   Property ID: ${doc.id}`);
      console.log(`   Created: ${createdDate} (${secondsAgo}s ago)`);
      console.log(`   Source: ${data.source || 'Unknown'}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Active: ${data.isActive}`);
      console.log(`   Images: ${data.imageUrls?.length || 0}`);

      // Check if in queue
      const queueDoc = await db.collection('property_rotation_queue')
        .where('propertyId', '==', doc.id)
        .limit(1)
        .get();

      if (!queueDoc.empty) {
        console.log(`   ✅ IN VIDEO QUEUE (${queueDoc.docs[0].data().status})`);
      } else {
        console.log(`   ❌ NOT in video queue`);
      }

      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkLatestProperty()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
