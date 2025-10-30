/**
 * Generate a test video for a podcast guest
 * Tests scale and voice speed settings
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

async function generateTestVideo() {
  console.log('🎬 Generating test podcast video...\n');

  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_API_KEY) {
    throw new Error('HEYGEN_API_KEY not configured');
  }

  // Get host and a guest from Firestore
  const hostDoc = await db.collection('podcast_config').doc('host').get();
  const hostProfile = hostDoc.data();

  // Get doctor guest
  const guestDoc = await db.collection('podcast_guest_profiles').doc('doctor').get();
  const guestProfile = guestDoc.data();

  if (!hostProfile || !guestProfile) {
    throw new Error('Profiles not found in Firestore');
  }

  console.log(`Host: ${hostProfile.name}`);
  console.log(`  Scale: ${hostProfile.scale}, Speed: ${hostProfile.voice_speed || 1.0}`);
  console.log(`\nGuest: ${guestProfile.name}`);
  console.log(`  Scale: ${guestProfile.scale}, Speed: ${guestProfile.voice_speed}`);

  // Create test script with short Q&A
  const testScript = {
    question: "Doctor, can you introduce yourself and tell us about your expertise?",
    answer: "Hello! I'm Dr. Sofia, a board-certified physician with 15 years of experience. I specialize in general health and wellness, helping people live healthier lives through better nutrition, exercise, stress management, and preventive care. I'm passionate about breaking down complex medical topics into practical advice everyone can use!"
  };

  // Build video scenes - NO styles to fill the entire vertical frame
  const hostCharacter = hostProfile.avatar_type === 'talking_photo'
    ? {
        type: 'talking_photo',
        talking_photo_id: hostProfile.avatar_id,
        scale: hostProfile.scale || 1.0
      }
    : {
        type: 'avatar',
        avatar_id: hostProfile.avatar_id,
        scale: hostProfile.scale || 1.0
      };

  const guestCharacter = guestProfile.avatar_type === 'talking_photo'
    ? {
        type: 'talking_photo',
        talking_photo_id: guestProfile.avatar_id,
        scale: guestProfile.scale || 1.4
      }
    : {
        type: 'avatar',
        avatar_id: guestProfile.avatar_id,
        scale: 2.8,  // MUCH larger scale to fill vertical frame
        offset: { x: 0, y: 0 }
      };

  const videoInputs = [
    // Host asks question
    {
      character: hostCharacter,
      voice: {
        type: 'text',
        input_text: testScript.question,
        voice_id: hostProfile.voice_id,
        speed: hostProfile.voice_speed || 1.0
      },
      background: {
        type: 'color',
        value: hostProfile.background_color || '#1a1a1a'
      }
    },
    // Guest answers
    {
      character: guestCharacter,
      voice: {
        type: 'text',
        input_text: testScript.answer,
        voice_id: guestProfile.voice_id,
        speed: guestProfile.voice_speed || 1.15
      },
      background: {
        type: 'color',
        value: guestProfile.background_color || '#1e3a5f'
      }
    }
  ];

  console.log('\n📤 Sending request to HeyGen...');
  console.log(`   Host scale: ${hostCharacter.scale}, speed: ${videoInputs[0].voice.speed}`);
  console.log(`   Guest scale: ${guestCharacter.scale}, speed: ${videoInputs[1].voice.speed}`);

  // Log the EXACT request body
  const requestBody = {
    test: false,
    caption: false,
    video_inputs: videoInputs,
    dimension: {
      width: 1080,
      height: 1920
    },
    title: 'TEST - Podcast Guest Scale & Speed'
  };

  console.log('\n🔍 Full API Request Body:');
  console.log(JSON.stringify(requestBody, null, 2));

  const response = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Api-Key': HEYGEN_API_KEY
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const videoId = result.data?.video_id;

  if (!videoId) {
    throw new Error('HeyGen did not return video_id');
  }

  console.log(`\n✅ Test video generation started!`);
  console.log(`   Video ID: ${videoId}`);
  console.log(`\n📺 Check status at: https://app.heygen.com/video/${videoId}`);
  console.log(`\n⏱️  Video will be ready in ~2-3 minutes`);
}

generateTestVideo().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
