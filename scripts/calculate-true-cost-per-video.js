const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function calculateTrueCost() {
  console.log('💰 TRUE COST PER VIDEO CALCULATION\n');
  console.log('Using REAL numbers from actual service usage\n');
  console.log('='.repeat(80));

  const currentMonth = '2025-10';

  // Get ALL costs for October from aggregated monthly data
  const monthlyCosts = await db.collection('monthly_costs')
    .where('month', '==', currentMonth)
    .get();

  let totalMonthCost = 0;
  let videoServiceCosts = {
    heygen: { units: 0, cost: 0 },
    submagic: { units: 0, cost: 0 },
    late: { units: 0, cost: 0 },
    openai: { units: 0, cost: 0 },
    r2: { units: 0, cost: 0 }
  };

  console.log('\n📅 October 2025 Costs by Brand:\n');

  monthlyCosts.forEach(doc => {
    const data = doc.data();
    const brand = data.brand;
    const brandTotal = data.total || 0;

    console.log(`${brand.toUpperCase()}:`);
    console.log(`  HeyGen:   ${data.heygen?.units || 0} videos @ $${(data.heygen?.costUSD || 0).toFixed(2)}`);
    console.log(`  Submagic: ${data.submagic?.units || 0} videos @ $${(data.submagic?.costUSD || 0).toFixed(2)}`);
    console.log(`  Late:     ${data.late?.units || 0} posts @ $${(data.late?.costUSD || 0).toFixed(2)}`);
    console.log(`  OpenAI:   ${data.openai?.units || 0} tokens @ $${(data.openai?.costUSD || 0).toFixed(2)}`);
    console.log(`  R2:       ${(data.r2?.units || 0).toFixed(2)} GB @ $${(data.r2?.costUSD || 0).toFixed(2)}`);
    console.log(`  TOTAL:    $${brandTotal.toFixed(2)}\n`);

    totalMonthCost += brandTotal;

    videoServiceCosts.heygen.units += data.heygen?.units || 0;
    videoServiceCosts.heygen.cost += data.heygen?.costUSD || 0;

    videoServiceCosts.submagic.units += data.submagic?.units || 0;
    videoServiceCosts.submagic.cost += data.submagic?.costUSD || 0;

    videoServiceCosts.late.units += data.late?.units || 0;
    videoServiceCosts.late.cost += data.late?.costUSD || 0;

    videoServiceCosts.openai.units += data.openai?.units || 0;
    videoServiceCosts.openai.cost += data.openai?.costUSD || 0;

    videoServiceCosts.r2.units += data.r2?.units || 0;
    videoServiceCosts.r2.cost += data.r2?.costUSD || 0;
  });

  console.log('='.repeat(80));
  console.log('\n📊 TOTAL OCTOBER 2025 COSTS:\n');
  console.log(`HeyGen Videos:    ${videoServiceCosts.heygen.units} @ $${videoServiceCosts.heygen.cost.toFixed(2)}`);
  console.log(`Submagic Videos:  ${videoServiceCosts.submagic.units} @ $${videoServiceCosts.submagic.cost.toFixed(2)}`);
  console.log(`Late Posts:       ${videoServiceCosts.late.units} @ $${videoServiceCosts.late.cost.toFixed(2)} (free)`);
  console.log(`OpenAI Tokens:    ${videoServiceCosts.openai.units} @ $${videoServiceCosts.openai.cost.toFixed(2)}`);
  console.log(`R2 Storage:       ${videoServiceCosts.r2.units.toFixed(2)} GB @ $${videoServiceCosts.r2.cost.toFixed(2)}`);
  console.log(`\nTOTAL:            $${totalMonthCost.toFixed(2)}`);

  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 REAL COST PER VIDEO CALCULATION:\n');

  // Total videos = HeyGen + Submagic (these are the actual video generations)
  const totalVideos = videoServiceCosts.heygen.units + videoServiceCosts.submagic.units;

  console.log(`Total Videos Produced: ${totalVideos}`);
  console.log(`  - HeyGen:   ${videoServiceCosts.heygen.units} videos`);
  console.log(`  - Submagic: ${videoServiceCosts.submagic.units} videos`);

  if (totalVideos > 0) {
    // Method 1: Total cost divided by total videos
    const avgCostMethod1 = totalMonthCost / totalVideos;
    console.log(`\n💵 Method 1 - Total Spend ÷ Total Videos:`);
    console.log(`   $${totalMonthCost.toFixed(2)} ÷ ${totalVideos} = $${avgCostMethod1.toFixed(2)} per video`);

    // Method 2: Video-specific costs only (HeyGen + Submagic + proportional OpenAI/R2)
    const videoDirectCosts = videoServiceCosts.heygen.cost + videoServiceCosts.submagic.cost;
    const videoSupportCosts = videoServiceCosts.openai.cost + videoServiceCosts.r2.cost;
    const totalVideoRelatedCosts = videoDirectCosts + videoSupportCosts;

    const avgCostMethod2 = totalVideoRelatedCosts / totalVideos;
    console.log(`\n💵 Method 2 - Video-Related Costs Only:`);
    console.log(`   Direct (HeyGen+Submagic): $${videoDirectCosts.toFixed(2)}`);
    console.log(`   Support (OpenAI+R2):      $${videoSupportCosts.toFixed(2)}`);
    console.log(`   Total Video Costs:        $${totalVideoRelatedCosts.toFixed(2)}`);
    console.log(`   $${totalVideoRelatedCosts.toFixed(2)} ÷ ${totalVideos} = $${avgCostMethod2.toFixed(2)} per video`);

    // Method 3: Submagic-only (since that's where most costs are)
    if (videoServiceCosts.submagic.units > 0) {
      const submagicAvg = videoServiceCosts.submagic.cost / videoServiceCosts.submagic.units;
      console.log(`\n💵 Method 3 - Submagic Cost Per Video:`);
      console.log(`   $${videoServiceCosts.submagic.cost.toFixed(2)} ÷ ${videoServiceCosts.submagic.units} = $${submagicAvg.toFixed(2)} per video`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📈 COST BREAKDOWN:\n');

  if (totalMonthCost > 0) {
    console.log(`Video Generation (HeyGen):  $${videoServiceCosts.heygen.cost.toFixed(2)} (${((videoServiceCosts.heygen.cost/totalMonthCost)*100).toFixed(1)}%)`);
    console.log(`Captions (Submagic):        $${videoServiceCosts.submagic.cost.toFixed(2)} (${((videoServiceCosts.submagic.cost/totalMonthCost)*100).toFixed(1)}%)`);
    console.log(`AI Processing (OpenAI):     $${videoServiceCosts.openai.cost.toFixed(2)} (${((videoServiceCosts.openai.cost/totalMonthCost)*100).toFixed(1)}%)`);
    console.log(`Storage (R2):               $${videoServiceCosts.r2.cost.toFixed(2)} (${((videoServiceCosts.r2.cost/totalMonthCost)*100).toFixed(1)}%)`);
    console.log(`Posting (Late):             $${videoServiceCosts.late.cost.toFixed(2)} (${((videoServiceCosts.late.cost/totalMonthCost)*100).toFixed(1)}%) - Free tier`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 RECOMMENDED COST PER VIDEO:\n');

  if (totalVideos > 0) {
    const recommendedCost = totalMonthCost / totalVideos;
    console.log(`   Use: $${recommendedCost.toFixed(2)} per video`);
    console.log(`\n   This includes ALL costs (video generation, captions, AI, storage, posting)`);
    console.log(`   divided by total videos produced (${totalVideos} videos in October 2025)`);
  }

  console.log('\n' + '='.repeat(80));

  await admin.app().delete();
}

calculateTrueCost().catch(console.error);
