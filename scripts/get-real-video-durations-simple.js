const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

async function getVideoInfo(videoId) {
  try {
    const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': HEYGEN_API_KEY
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    return null;
  }
}

async function getRealVideoDurations() {
  console.log('🎥 GETTING REAL VIDEO DURATIONS FROM ACTUAL VIDEOS\n');
  console.log('='.repeat(80));

  const WORKFLOW_COLLECTIONS = [
    'ownerfi_workflow_queue',
    'carz_workflow_queue',
    'podcast_workflow_queue'
  ];

  const videoDurations = [];

  for (const collectionName of WORKFLOW_COLLECTIONS) {
    console.log(`\n📋 Checking ${collectionName}...`);

    // Just get all completed, don't filter by heygenVideoId
    const snapshot = await db.collection(collectionName)
      .where('status', '==', 'completed')
      .limit(10)
      .get();

    console.log(`  Found ${snapshot.size} completed workflows`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const heygenId = data.heygenVideoId;

      if (!heygenId) {
        console.log(`  Skipping ${doc.id} - no HeyGen ID`);
        continue;
      }

      console.log(`\n  Workflow: ${doc.id}`);
      console.log(`  HeyGen ID: ${heygenId}`);
      console.log(`  Fetching video info from HeyGen API...`);

      const videoInfo = await getVideoInfo(heygenId);

      if (videoInfo && videoInfo.duration) {
        const duration = videoInfo.duration;
        videoDurations.push({
          workflowId: doc.id,
          brand: data.brand,
          heygenId: heygenId,
          duration: duration,
        });

        console.log(`  ✅ Duration: ${duration} seconds`);
      } else {
        console.log(`  ❌ Could not get duration (video might be deleted)`);
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 REAL VIDEO DURATION ANALYSIS:\n');

  if (videoDurations.length === 0) {
    console.log('❌ Could not retrieve any video durations');
    console.log('\n💡 MANUAL CHECK NEEDED:');
    console.log('   1. Check one of your actual videos');
    console.log('   2. See how long it is (probably ~30 seconds)');
    console.log('   3. HeyGen charges per minute, rounded UP');
    console.log('   4. So 30s video = 1 minute = 1 credit = $0.50\n');
    await admin.app().delete();
    return;
  }

  console.log(`Total videos with duration data: ${videoDurations.length}\n`);

  videoDurations.forEach((v, i) => {
    console.log(`${i + 1}. ${v.brand.toUpperCase()} - ${v.duration}s`);
  });

  const durations = videoDurations.map(v => v.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  console.log('\n' + '='.repeat(80));
  console.log('\n💰 REAL HEYGEN COST CALCULATION:\n');

  console.log(`Average video: ${avgDuration.toFixed(1)} seconds`);
  console.log(`Range: ${minDuration}s - ${maxDuration}s\n`);

  // HeyGen charges per minute, rounded up
  const avgMinutes = avgDuration / 60;
  const creditsPerVideo = Math.ceil(avgMinutes);
  const costPerVideo = creditsPerVideo * 0.50;

  console.log('HeyGen Pricing:');
  console.log(`  - $0.50 per credit`);
  console.log(`  - 1 credit = 1 minute`);
  console.log(`  - Rounded UP to nearest minute\n`);

  console.log(`YOUR REAL COST:`);
  console.log(`  - ${avgDuration.toFixed(1)}s avg = ${avgMinutes.toFixed(2)} minutes`);
  console.log(`  - Rounded up to ${creditsPerVideo} minute(s)`);
  console.log(`  - Cost: ${creditsPerVideo} × $0.50 = $${costPerVideo.toFixed(2)} per video\n`);

  console.log('='.repeat(80));
  console.log('\n🎯 REAL TOTAL COST PER VIDEO:\n');

  console.log(`HeyGen:   $${costPerVideo.toFixed(2)} (actual ${avgDuration.toFixed(0)}s videos)`);
  console.log(`Submagic: $1.27`);
  console.log(`OpenAI:   $0.01`);
  console.log(`R2:       $0.00`);
  console.log(`──────────────`);
  console.log(`TOTAL:    $${(costPerVideo + 1.27 + 0.01).toFixed(2)} per video\n`);

  console.log('='.repeat(80));

  await admin.app().delete();
}

getRealVideoDurations().catch(console.error);
