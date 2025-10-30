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

async function getFullWorkflowData(address: string) {
  console.log(`🔍 Getting full workflow data for: ${address}\n`);

  try {
    // Find the property
    const propertiesSnapshot = await db.collection('properties')
      .where('address', '==', address)
      .limit(1)
      .get();

    if (propertiesSnapshot.empty) {
      console.log(`❌ No property found with address: ${address}`);
      return;
    }

    const propertyDoc = propertiesSnapshot.docs[0];
    const propertyId = propertyDoc.id;
    const propertyData = propertyDoc.data();

    console.log(`✅ Property: ${propertyData.address}, ${propertyData.city}, ${propertyData.state}`);
    console.log(`   Property ID: ${propertyId}\n`);

    // Get video workflows
    const videosSnapshot = await db.collection('property_videos')
      .where('propertyId', '==', propertyId)
      .get();

    if (videosSnapshot.empty) {
      console.log(`❌ No video workflows found`);
      return;
    }

    console.log(`📹 Found ${videosSnapshot.size} workflow(s)\n`);

    videosSnapshot.forEach((doc, index) => {
      const data = doc.data();

      console.log(`${'='.repeat(80)}`);
      console.log(`Workflow #${index + 1}: ${doc.id}`);
      console.log(`${'='.repeat(80)}`);
      console.log(JSON.stringify(data, null, 2));
      console.log('\n');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

const address = process.argv[2] || '1346 San Marco Rd';
getFullWorkflowData(address)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
