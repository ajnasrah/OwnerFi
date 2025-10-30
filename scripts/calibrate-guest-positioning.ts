/**
 * Individual Guest Position Calibrator
 * Generate individual test videos for each guest to find perfect offset
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

// Test different offsets for each guest to find perfect center
const testOffsets = [
  { x: 0, y: -0.2 },
  { x: 0, y: -0.1 },
  { x: 0, y: 0 },
  { x: 0, y: 0.1 },
  { x: 0, y: 0.2 }
];

async function generateCalibrationVideo(guestId: string, guestData: any) {
  console.log(`\n🎯 Generating calibration video for ${guestData.name}...`);

  const videoInputs = testOffsets.map((offset, index) => {
    const character = guestData.avatar_type === 'talking_photo'
      ? {
          type: 'talking_photo',
          talking_photo_id: guestData.avatar_id,
          scale: 3.2
        }
      : {
          type: 'avatar',
          avatar_id: guestData.avatar_id,
          scale: 3.2,
          offset: offset
        };

    return {
      character,
      voice: {
        type: 'text',
        input_text: `Testing offset Y equals ${offset.y}. This is position ${index + 1} of 5.`,
        voice_id: guestData.voice_id,
        speed: guestData.voice_speed || 1.15
      },
      background: {
        type: 'color',
        value: guestData.background_color || '#2c3e50'
      }
    };
  });

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
      dimension: {
        width: 1080,
        height: 1920
      },
      title: `CALIBRATION - ${guestData.name}`
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HeyGen API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const videoId = result.data?.video_id;

  console.log(`✅ Video ID: ${videoId}`);
  console.log(`   Watch: https://app.heygen.com/video/${videoId}`);
  console.log(`   Offsets tested: -0.2, -0.1, 0, 0.1, 0.2`);

  return videoId;
}

async function calibrateAllGuests() {
  console.log('🔧 GUEST POSITION CALIBRATION SYSTEM');
  console.log('=' .repeat(60));
  console.log('Each guest will get a test video with 5 different Y offsets');
  console.log('Watch each video and note which offset centers them best\n');

  const guestIds = ['doctor', 'real_estate_agent', 'car_salesman', 'financial_advisor', 'tech_expert', 'fitness_trainer'];

  const results: any[] = [];

  for (const guestId of guestIds) {
    const guestDoc = await db.collection('podcast_guest_profiles').doc(guestId).get();
    if (!guestDoc.exists) continue;

    const guestData = guestDoc.data();
    try {
      const videoId = await generateCalibrationVideo(guestId, guestData);
      results.push({ guestId, name: guestData?.name, videoId });

      // Wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Failed for ${guestId}:`, error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 CALIBRATION VIDEOS GENERATED:');
  console.log('='.repeat(60));

  results.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.name} (${r.guestId})`);
    console.log(`   Video: https://app.heygen.com/video/${r.videoId}`);
    console.log(`   Test offsets: Y = [-0.2, -0.1, 0, 0.1, 0.2]`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('📝 NEXT STEPS:');
  console.log('1. Watch each video and note which offset (1-5) centers best');
  console.log('2. Use that info to update configure-aggressive-scaling.ts');
  console.log('3. Generate final video with perfect positioning');
}

calibrateAllGuests().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
