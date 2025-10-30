import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getHeyGenVideoStatus } from '../src/lib/heygen-client';

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

async function getPropertyVideoScriptViaHeyGen(address: string) {
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

    // Query property_videos WITHOUT orderBy to avoid index requirement
    const videosSnapshot = await db.collection('property_videos')
      .where('propertyId', '==', propertyId)
      .get();

    if (videosSnapshot.empty) {
      console.log(`❌ No video workflows found for property ID: ${propertyId}`);
      return;
    }

    console.log(`📹 Found ${videosSnapshot.size} video workflow(s)\n`);

    // Sort in memory by createdAt
    const sortedDocs = videosSnapshot.docs.sort((a, b) => {
      const aTime = a.data().createdAt || 0;
      const bTime = b.data().createdAt || 0;
      return bTime - aTime; // Descending (newest first)
    });

    for (let index = 0; index < sortedDocs.length; index++) {
      const doc = sortedDocs[index];
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

      // Check Firestore data for script
      if (data.script) {
        console.log(`📝 SCRIPT (from Firestore):`);
        console.log(`${'-'.repeat(80)}`);
        console.log(data.script);
        console.log(`${'-'.repeat(80)}`);
        console.log('');
      } else if (data.heygenScript) {
        console.log(`📝 HEYGEN SCRIPT (from Firestore):`);
        console.log(`${'-'.repeat(80)}`);
        console.log(data.heygenScript);
        console.log(`${'-'.repeat(80)}`);
        console.log('');
      }

      // If we have a HeyGen video ID, fetch details from HeyGen API
      if (data.heygenVideoId) {
        try {
          console.log(`🔄 Fetching video details from HeyGen API...`);
          const heygenData = await getHeyGenVideoStatus(data.heygenVideoId);

          console.log(`\n📊 HeyGen API Response:`);
          console.log(JSON.stringify(heygenData, null, 2));
          console.log('');

          // Check for script in HeyGen response
          if (heygenData.data?.video_inputs) {
            console.log(`📝 SCRIPT FROM HEYGEN API:`);
            console.log(`${'-'.repeat(80)}`);

            heygenData.data.video_inputs.forEach((input: any, i: number) => {
              if (input.voice?.input_text) {
                if (heygenData.data.video_inputs.length > 1) {
                  console.log(`\nSegment ${i + 1}:`);
                }
                console.log(input.voice.input_text);
              }
            });

            console.log(`${'-'.repeat(80)}`);
            console.log('');
          }

        } catch (heygenError) {
          console.log(`⚠️  Could not fetch HeyGen details: ${heygenError instanceof Error ? heygenError.message : 'Unknown error'}`);
        }
      }

      // Show all available Firestore fields
      console.log('📋 All Firestore fields:');
      console.log(Object.keys(data).join(', '));
      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
const address = process.argv[2] || '1346 San Marco Rd';
getPropertyVideoScriptViaHeyGen(address)
  .then(() => {
    console.log('\n✅ Script lookup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
