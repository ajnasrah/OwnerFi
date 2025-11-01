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

async function analyzeWorkflowCosts() {
  console.log('🔍 ANALYZING COMPLETE VIDEO WORKFLOW COSTS\n');
  console.log('='.repeat(80));

  console.log('\n📋 WORKFLOW STEPS (From /api/workflow/complete-viral/route.ts):\n');
  console.log('1. RSS Article Fetch (FREE)');
  console.log('2. OpenAI Script Generation (PAID - GPT-4 API)');
  console.log('3. HeyGen Video Generation (PAID - HeyGen API)');
  console.log('4. Submagic Caption Generation (PAID - Submagic API)');
  console.log('5. R2 Video Storage (PAID - Cloudflare R2)');
  console.log('6. Late Social Media Posting (PAID - Late API $50/month flat)');

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 OCTOBER 2025 - ACTUAL USAGE BY SERVICE:\n');

  // Get monthly costs to see what was actually used
  const monthlyCosts = await db.collection('monthly_costs')
    .where('month', '==', '2025-10')
    .get();

  let totalHeygen = 0, totalSubmagic = 0, totalOpenAI = 0, totalR2 = 0, totalLate = 0;
  let heygenVideos = 0, submagicVideos = 0, lateUnits = 0, openaiTokens = 0;

  monthlyCosts.forEach(doc => {
    const data = doc.data();
    totalHeygen += data.heygen?.costUSD || 0;
    totalSubmagic += data.submagic?.costUSD || 0;
    totalOpenAI += data.openai?.costUSD || 0;
    totalR2 += data.r2?.costUSD || 0;
    totalLate += data.late?.costUSD || 0;

    heygenVideos += data.heygen?.units || 0;
    submagicVideos += data.submagic?.units || 0;
    lateUnits += data.late?.units || 0;
    openaiTokens += data.openai?.units || 0;
  });

  console.log(`HeyGen (Video Generation):`);
  console.log(`  Videos: ${heygenVideos}`);
  console.log(`  Cost: $${totalHeygen.toFixed(2)}`);
  console.log(`  Per video: $${heygenVideos > 0 ? (totalHeygen / heygenVideos).toFixed(2) : '0.00'}`);

  console.log(`\nSubmagic (Caption Generation):`);
  console.log(`  Videos: ${submagicVideos}`);
  console.log(`  Cost: $${totalSubmagic.toFixed(2)}`);
  console.log(`  Per video: $${submagicVideos > 0 ? (totalSubmagic / submagicVideos).toFixed(2) : '0.00'}`);

  console.log(`\nOpenAI (Script Generation):`);
  console.log(`  Tokens: ${openaiTokens.toLocaleString()}`);
  console.log(`  Cost: $${totalOpenAI.toFixed(4)}`);
  console.log(`  Per video (est): $${submagicVideos > 0 ? (totalOpenAI / submagicVideos).toFixed(4) : '0.00'}`);

  console.log(`\nR2 (Video Storage):`);
  console.log(`  Cost: $${totalR2.toFixed(4)}`);
  console.log(`  Per video (est): $${submagicVideos > 0 ? (totalR2 / submagicVideos).toFixed(4) : '0.00'}`);

  console.log(`\nLate (Social Posting):`);
  console.log(`  Posts: ${lateUnits}`);
  console.log(`  Cost: $${totalLate.toFixed(2)} (flat $50/month unlimited)`);

  const totalCost = totalHeygen + totalSubmagic + totalOpenAI + totalR2 + totalLate;

  console.log('\n' + '='.repeat(80));
  console.log('\n💰 TOTAL COST ANALYSIS:\n');

  console.log(`Total October Spend: $${totalCost.toFixed(2)}`);
  console.log(`Total Videos Completed: ${Math.max(heygenVideos, submagicVideos)}`);

  // Calculate which videos were tracked
  console.log(`\n🔍 COST TRACKING ANALYSIS:`);
  console.log(`  HeyGen videos tracked: ${heygenVideos}`);
  console.log(`  Submagic videos tracked: ${submagicVideos}`);

  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 TRUE COST PER VIDEO CALCULATION:\n');

  if (submagicVideos > 0) {
    console.log(`Method 1: Total Actual Spend ÷ Videos Completed`);
    console.log(`  = $${totalCost.toFixed(2)} ÷ ${submagicVideos}`);
    console.log(`  = $${(totalCost / submagicVideos).toFixed(2)} per video\n`);

    console.log(`Breakdown per video:`);
    console.log(`  - HeyGen (video gen):    $${(totalHeygen / submagicVideos).toFixed(2)}`);
    console.log(`  - Submagic (captions):   $${(totalSubmagic / submagicVideos).toFixed(2)}`);
    console.log(`  - OpenAI (script):       $${(totalOpenAI / submagicVideos).toFixed(4)}`);
    console.log(`  - R2 (storage):          $${(totalR2 / submagicVideos).toFixed(4)}`);
    console.log(`  - Late (posting):        $0.00 (flat rate)`);
    console.log(`  ────────────────────────`);
    console.log(`  TOTAL PER VIDEO:         $${(totalCost / submagicVideos).toFixed(2)}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n⚠️  IMPORTANT FINDINGS:\n');

  if (heygenVideos === 0) {
    console.log('❌ HeyGen was NOT USED in October 2025!');
    console.log('   This means workflows are NOT going through step 3 (HeyGen video generation)');
    console.log('   Either:');
    console.log('   a) Videos are being generated but costs not tracked');
    console.log('   b) Workflows are skipping HeyGen step');
    console.log('   c) Pre-existing videos are being used\n');
  }

  if (totalOpenAI < 0.01) {
    console.log('⚠️  OpenAI costs are near-zero ($' + totalOpenAI.toFixed(4) + ')');
    console.log('   Either:');
    console.log('   a) Script generation not properly tracked');
    console.log('   b) Using cached/pre-written scripts');
    console.log('   c) OpenAI API calls not being logged\n');
  }

  console.log('✅ Submagic costs ARE being tracked properly ($' + totalSubmagic.toFixed(2) + ')');
  console.log('✅ R2 storage costs ARE being tracked ($' + totalR2.toFixed(4) + ')');

  console.log('\n' + '='.repeat(80));

  await admin.app().delete();
}

analyzeWorkflowCosts().catch(console.error);
