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

async function getPropertyVideoScript(address: string) {
  console.log(`🔍 Searching for video script for: ${address}\n`);

  try {
    // First, find the property by address
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

    console.log(`✅ Found property: ${propertyData.address}, ${propertyData.city}, ${propertyData.state}`);
    console.log(`   Property ID: ${propertyId}`);
    console.log(`   Price: $${propertyData.listPrice?.toLocaleString()}`);
    console.log(`   Bedrooms: ${propertyData.bedrooms} | Bathrooms: ${propertyData.bathrooms}`);
    console.log('');

    // Now find video workflows for this property
    const videosSnapshot = await db.collection('property_videos')
      .where('propertyId', '==', propertyId)
      .orderBy('createdAt', 'desc')
      .get();

    if (videosSnapshot.empty) {
      console.log(`❌ No video workflows found for property ID: ${propertyId}`);
      return;
    }

    console.log(`📹 Found ${videosSnapshot.size} video workflow(s)\n`);

    videosSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${'='.repeat(80)}`);
      console.log(`Video Workflow #${index + 1}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Workflow ID: ${doc.id}`);
      console.log(`Status: ${data.status}`);
      console.log(`Variant: ${data.variant || '15sec'}`);
      console.log(`Created: ${data.createdAt ? new Date(data.createdAt).toLocaleString() : 'Unknown'}`);
      console.log(`Updated: ${data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Unknown'}`);

      if (data.heygenVideoId) {
        console.log(`HeyGen Video ID: ${data.heygenVideoId}`);
      }

      if (data.submagicProjectId) {
        console.log(`Submagic Project ID: ${data.submagicProjectId}`);
      }

      if (data.latePostId) {
        console.log(`Late Post ID: ${data.latePostId}`);
      }

      if (data.error) {
        console.log(`❌ Error: ${data.error}`);
      }

      console.log('');

      // Check if script data exists
      if (data.script) {
        console.log(`📝 SCRIPT:`);
        console.log(`${'-'.repeat(80)}`);
        console.log(data.script);
        console.log(`${'-'.repeat(80)}`);
      } else if (data.heygenScript) {
        console.log(`📝 HEYGEN SCRIPT:`);
        console.log(`${'-'.repeat(80)}`);
        console.log(data.heygenScript);
        console.log(`${'-'.repeat(80)}`);
      } else {
        console.log(`⚠️  No script found in this workflow record`);
      }

      // Show all fields that might contain script
      console.log('\n📋 All available fields:');
      console.log(Object.keys(data).join(', '));
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
const address = process.argv[2] || '1346 San Marco Rd';
getPropertyVideoScript(address)
  .then(() => {
    console.log('\n✅ Script lookup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
