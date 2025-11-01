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

async function showActualCosts() {
  console.log('💰 ACTUAL COSTS REPORT\n');
  console.log('='.repeat(80));

  // Get OCTOBER 2025 data (the real month we care about)
  const octoberSnapshot = await db.collection('monthly_costs')
    .where('month', '==', '2025-10')
    .get();

  let octTotal = 0;
  const octByBrand = {};
  const octByService = {
    heygen: { units: 0, cost: 0 },
    submagic: { units: 0, cost: 0 },
    late: { units: 0, cost: 0 },
    openai: { units: 0, cost: 0 },
    r2: { units: 0, cost: 0 }
  };

  console.log('\n📅 OCTOBER 2025 (Month-to-Date)\n');

  octoberSnapshot.forEach(doc => {
    const data = doc.data();
    const brand = data.brand;
    const total = data.total || 0;

    octByBrand[brand] = {
      heygen: data.heygen?.costUSD || 0,
      submagic: data.submagic?.costUSD || 0,
      late: data.late?.costUSD || 0,
      openai: data.openai?.costUSD || 0,
      r2: data.r2?.costUSD || 0,
      total: total
    };

    octByService.heygen.units += data.heygen?.units || 0;
    octByService.heygen.cost += data.heygen?.costUSD || 0;

    octByService.submagic.units += data.submagic?.units || 0;
    octByService.submagic.cost += data.submagic?.costUSD || 0;

    octByService.late.units += data.late?.units || 0;
    octByService.late.cost += data.late?.costUSD || 0;

    octByService.openai.units += data.openai?.units || 0;
    octByService.openai.cost += data.openai?.costUSD || 0;

    octByService.r2.units += data.r2?.units || 0;
    octByService.r2.cost += data.r2?.costUSD || 0;

    octTotal += total;
  });

  console.log('BY BRAND:');
  Object.entries(octByBrand).forEach(([brand, costs]) => {
    console.log(`\n  ${brand.toUpperCase()}: $${costs.total.toFixed(2)}`);
    console.log(`    HeyGen:   $${costs.heygen.toFixed(2)}`);
    console.log(`    Submagic: $${costs.submagic.toFixed(2)}`);
    console.log(`    Late:     $${costs.late.toFixed(2)}`);
    console.log(`    OpenAI:   $${costs.openai.toFixed(2)}`);
    console.log(`    R2:       $${costs.r2.toFixed(2)}`);
  });

  console.log('\n' + '-'.repeat(80));
  console.log('\nBY SERVICE:');
  Object.entries(octByService).forEach(([service, data]) => {
    console.log(`  ${service.toUpperCase()}: $${data.cost.toFixed(2)} (${data.units} ${service === 'openai' ? 'tokens' : service === 'r2' ? 'GB' : 'videos'})`);
  });

  console.log('\n' + '='.repeat(80));
  console.log(`💵 TOTAL OCTOBER SPEND: $${octTotal.toFixed(2)}`);
  console.log('='.repeat(80));

  // Calculate cost per video (Submagic videos)
  const totalVideos = octByService.submagic.units + octByService.heygen.units;
  if (totalVideos > 0) {
    const costPerVideo = octTotal / totalVideos;
    console.log(`\n📹 Average Cost Per Video: $${costPerVideo.toFixed(2)}`);
    console.log(`   Total Videos: ${totalVideos} (${octByService.submagic.units} Submagic + ${octByService.heygen.units} HeyGen)`);
  }

  // Show breakdown
  console.log(`\n📊 Cost Breakdown:`);
  console.log(`   Submagic (captions): $${octByService.submagic.cost.toFixed(2)} (${((octByService.submagic.cost/octTotal)*100).toFixed(1)}%)`);
  console.log(`   HeyGen (videos):     $${octByService.heygen.cost.toFixed(2)} (${((octByService.heygen.cost/octTotal)*100).toFixed(1)}%)`);
  console.log(`   Late (posts):        $${octByService.late.cost.toFixed(2)} (${((octByService.late.cost/octTotal)*100).toFixed(1)}%)`);
  console.log(`   OpenAI (AI):         $${octByService.openai.cost.toFixed(2)} (${((octByService.openai.cost/octTotal)*100).toFixed(1)}%)`);
  console.log(`   R2 (storage):        $${octByService.r2.cost.toFixed(2)} (${((octByService.r2.cost/octTotal)*100).toFixed(1)}%)`);

  console.log('\n');

  await admin.app().delete();
}

showActualCosts().catch(console.error);
