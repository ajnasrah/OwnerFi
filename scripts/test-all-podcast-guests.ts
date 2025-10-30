/**
 * Generate a test video showcasing ALL podcast guests
 * Tests scale (2.8) and offset (0.2) for each guest
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

async function generateAllGuestsTestVideo() {
  console.log('🎬 Generating test video with ALL podcast guests...\n');

  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_API_KEY) {
    throw new Error('HEYGEN_API_KEY not configured');
  }

  // Get host from Firestore
  const hostDoc = await db.collection('podcast_config').doc('host').get();
  const hostProfile = hostDoc.data();

  if (!hostProfile) {
    throw new Error('Host profile not found in Firestore');
  }

  // Get all guests from Firestore - only use guests with working avatars
  const workingGuestIds = ['doctor', 'real_estate_agent', 'car_salesman', 'financial_advisor'];
  const guests: any[] = [];

  for (const guestId of workingGuestIds) {
    const guestDoc = await db.collection('podcast_guest_profiles').doc(guestId).get();
    if (guestDoc.exists) {
      guests.push({ id: guestDoc.id, ...guestDoc.data() });
    }
  }

  console.log(`Found ${guests.length} working guests\n`);

  // Build video scenes - host introduces, then each guest speaks
  const videoInputs: any[] = [];

  // Host introduction
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

  videoInputs.push({
    character: hostCharacter,
    voice: {
      type: 'text',
      input_text: "Welcome to our podcast! Today we're showcasing all of our amazing expert guests. Let's meet them!",
      voice_id: hostProfile.voice_id,
      speed: hostProfile.voice_speed || 1.0
    },
    background: {
      type: 'color',
      value: hostProfile.background_color || '#1a1a1a'
    }
  });

  // Each guest introduces themselves
  for (const guest of guests) {
    console.log(`Adding guest: ${guest.name}`);

    const guestCharacter = guest.avatar_type === 'talking_photo'
      ? {
          type: 'talking_photo',
          talking_photo_id: guest.avatar_id,
          scale: 2.8  // Same scale that worked for Dr. Sofia
        }
      : {
          type: 'avatar',
          avatar_id: guest.avatar_id,
          scale: 2.8,  // Same scale that worked for Dr. Sofia
          offset: { x: 0, y: 0.2 }  // Same offset that worked for Dr. Sofia
        };

    const intro = `Hi, I'm ${guest.name}. ${guest.description || 'I specialize in ' + guest.expertise}`;

    videoInputs.push({
      character: guestCharacter,
      voice: {
        type: 'text',
        input_text: intro,
        voice_id: guest.voice_id,
        speed: guest.voice_speed || 1.15
      },
      background: {
        type: 'color',
        value: guest.background_color || '#2c3e50'
      }
    });
  }

  console.log(`\n📤 Sending request to HeyGen...`);
  console.log(`   Total scenes: ${videoInputs.length} (1 host + ${guests.length} guests)`);
  console.log(`   Guest scale: 2.8, offset: { x: 0, y: 0.2 }`);

  const requestBody = {
    test: false,
    caption: false,
    video_inputs: videoInputs,
    dimension: {
      width: 1080,
      height: 1920
    },
    title: 'TEST - All Podcast Guests Showcase'
  };

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
  console.log(`\n⏱️  Video will be ready in ~5-10 minutes (longer because of ${guests.length} guests)`);
  console.log(`\nGuests in order:`);
  guests.forEach((g, i) => {
    console.log(`   ${i + 1}. ${g.name} (${g.id})`);
  });
}

generateAllGuestsTestVideo().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
