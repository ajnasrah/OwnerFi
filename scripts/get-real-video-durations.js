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
    'carz_workflow_queue',
    'ownerfi_workflow_queue',
    'podcast_workflow_queue'
  ];

  const videoDurations = [];
  let totalVideos = 0;

  for (const collectionName of WORKFLOW_COLLECTIONS) {
    console.log(`\n📋 Checking ${collectionName}...`);

    const snapshot = await db.collection(collectionName)
      .where('status', '==', 'completed')
      .where('heygenVideoId', '!=', null)
      .limit(10)
      .get();

    console.log(`  Found ${snapshot.size} completed workflows with HeyGen IDs`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const heygenId = data.heygenVideoId;

      if (!heygenId) continue;

      totalVideos++;
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
          created: data.createdAt,
          completed: data.completedAt
        });

        console.log(`  ✅ Duration: ${duration} seconds`);
        console.log(`  Brand: ${data.brand}`);
      } else {
        console.log(`  ❌ Could not get duration from HeyGen API`);
      }

      // Rate limit: wait 1 second between API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 REAL VIDEO DURATION ANALYSIS:\n');

  if (videoDurations.length === 0) {
    console.log('❌ Could not retrieve any video durations from HeyGen API');
    console.log('   This might be because:');
    console.log('   - Videos are too old and HeyGen purged them');
    console.log('   - API key doesn\'t have access');
    console.log('   - Video IDs are invalid\n');
    return;
  }

  console.log(`Total videos analyzed: ${videoDurations.length}\n`);

  videoDurations.forEach((v, i) => {
    console.log(`${i + 1}. ${v.brand.toUpperCase()} - ${v.duration}s (${v.workflowId.substring(0, 20)}...)`);
  });

  // Calculate statistics
  const durations = videoDurations.map(v => v.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  console.log('\n' + '='.repeat(80));
  console.log('\n💰 REAL HEYGEN COST CALCULATION:\n');

  console.log(`Average video duration: ${avgDuration.toFixed(1)} seconds`);
  console.log(`Shortest video: ${minDuration} seconds`);
  console.log(`Longest video: ${maxDuration} seconds\n`);

  // HeyGen charges by the minute, rounded up
  // 1 credit per minute
  const avgMinutes = avgDuration / 60;
  const creditsPerVideo = Math.ceil(avgMinutes);
  const costPerCredit = 0.50;
  const costPerVideo = creditsPerVideo * costPerCredit;

  console.log('HeyGen Pricing:');
  console.log(`  - Cost per credit: $${costPerCredit}`);
  console.log(`  - 1 credit = 1 minute of video`);
  console.log(`  - Billing: rounded UP to nearest minute\n`);

  console.log(`REAL Cost Per Video:`);
  console.log(`  - Average duration: ${avgDuration.toFixed(1)}s = ${avgMinutes.toFixed(2)} minutes`);
  console.log(`  - Credits charged: ${creditsPerVideo} credit(s) (rounded up)`);
  console.log(`  - Cost: ${creditsPerVideo} × $${costPerCredit} = $${costPerVideo.toFixed(2)}\n`);

  // Calculate by brand
  const byBrand = {};
  videoDurations.forEach(v => {
    if (!byBrand[v.brand]) {
      byBrand[v.brand] = [];
    }
    byBrand[v.brand].push(v.duration);
  });

  console.log('Cost by Brand:');
  Object.entries(byBrand).forEach(([brand, durations]) => {
    const avgDur = durations.reduce((a, b) => a + b, 0) / durations.length;
    const credits = Math.ceil(avgDur / 60);
    const cost = credits * costPerCredit;
    console.log(`  ${brand.toUpperCase()}: ${avgDur.toFixed(1)}s avg = ${credits} credit(s) = $${cost.toFixed(2)} per video (${durations.length} videos)`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 REAL TOTAL COST PER VIDEO:\n');

  console.log(`HeyGen (video generation):  $${costPerVideo.toFixed(2)} (REAL from actual ${avgDuration.toFixed(0)}s videos)`);
  console.log(`Submagic (captions):        $1.27 (actual tracked)`);
  console.log(`OpenAI (script):            $0.01 (estimated)`);
  console.log(`R2 (storage):               $0.00 (negligible)`);
  console.log(`Late (posting):             $0.00 (flat rate)`);
  console.log(`─────────────────────────────`);
  console.log(`REAL TOTAL:                 $${(costPerVideo + 1.27 + 0.01).toFixed(2)} per video\n`);

  console.log('='.repeat(80));

  await admin.app().delete();
}

getRealVideoDurations().catch(console.error);
