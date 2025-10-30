/**
 * Test a single podcast guest
 */

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
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function testSingleGuest(guestId: string) {
  console.log(`\n🎬 Testing single guest: ${guestId}\n`);

  const guestDoc = await db.collection('podcast_guest_profiles').doc(guestId).get();
  if (!guestDoc.exists) {
    throw new Error(`Guest ${guestId} not found`);
  }

  const guestData = guestDoc.data();
  console.log(`Name: ${guestData?.name}`);
  console.log(`Scale: ${guestData?.scale}`);
  console.log(`Offset: x=${guestData?.offset?.x}, y=${guestData?.offset?.y}`);
  console.log(`Voice Speed: ${guestData?.voice_speed}\n`);

  const guestCharacter = guestData?.avatar_type === 'talking_photo'
    ? {
        type: 'talking_photo',
        talking_photo_id: guestData.avatar_id,
        scale: guestData.scale || 3.2
      }
    : {
        type: 'avatar',
        avatar_id: guestData.avatar_id,
        scale: guestData.scale || 3.2,
        offset: guestData.offset || { x: 0, y: 0.15 }
      };

  const videoInputs = [{
    character: guestCharacter,
    voice: {
      type: 'text',
      input_text: `Hi, I'm ${guestData?.name}. This is a test of my positioning with scale ${guestData?.scale} and offset x equals ${guestData?.offset?.x}, y equals ${guestData?.offset?.y}.`,
      voice_id: guestData?.voice_id,
      speed: guestData?.voice_speed || 1.15
    },
    background: {
      type: 'color',
      value: guestData?.background_color || '#2c3e50'
    }
  }];

  console.log('📤 Sending to HeyGen...');

  const response = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Api-Key': HEYGEN_API_KEY!
    },
    body: JSON.stringify({
      test: false,
      caption: false,
      video_inputs: videoInputs,
      dimension: { width: 1080, height: 1920 },
      title: `TEST - ${guestData?.name}`
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HeyGen error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const videoId = result.data?.video_id;

  console.log(`✅ Video ID: ${videoId}`);
  console.log(`📺 https://app.heygen.com/video/${videoId}\n`);
}

// Test Dr. Sofia by default
const guestId = process.argv[2] || 'doctor';
testSingleGuest(guestId).then(() => process.exit(0)).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
