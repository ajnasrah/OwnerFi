#!/usr/bin/env node

const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// CORRECT PRICING
const PRICING = {
  heygen: 0.50,      // $0.50 per video
  submagic: 1.27,    // $1.27 per video
  late: 50,          // $50/month flat rate
  openai: {
    input: 0.15,     // $0.15 per 1M tokens
    output: 0.60     // $0.60 per 1M tokens
  },
  r2: 0.015          // $0.015 per GB/month
};

async function calculateActualSpending() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  console.log('\n💰 CALCULATING ACTUAL 30-DAY SPENDING\n');
  console.log('📅 Period:', new Date(thirtyDaysAgo).toLocaleDateString(), 'to', new Date().toLocaleDateString());
  console.log('\n' + '='.repeat(70) + '\n');

  const queues = [
    'ownerfi_workflow_queue',
    'benefit_workflow_queue',
    'podcast_workflow_queue',
    'carz_workflow_queue',
    'vassdistro_workflow_queue',
    'abdullah_workflow_queue'
  ];

  let heygenCount = 0;
  let submagicCount = 0;
  let lateCount = 0;

  console.log('📊 Analyzing workflow queues...\n');

  for (const queue of queues) {
    const workflows = await db.collection(queue)
      .where('createdAt', '>=', thirtyDaysAgo)
      .get();

    let queueHeygen = 0, queueSubmagic = 0, queueLate = 0;

    workflows.forEach(doc => {
      const data = doc.data();
      if (data.heygenCompleted === true) queueHeygen++;
      if (data.submagicCompleted === true) queueSubmagic++;
      if (data.latePosted === true || data.posted === true) queueLate++;
    });

    if (workflows.size > 0) {
      const brand = queue.replace('_workflow_queue', '');
      console.log(`   ${brand.padEnd(15)}: ${workflows.size.toString().padStart(3)} workflows | HeyGen: ${queueHeygen.toString().padStart(3)} | Submagic: ${queueSubmagic.toString().padStart(3)} | Late: ${queueLate.toString().padStart(3)}`);
    }

    heygenCount += queueHeygen;
    submagicCount += queueSubmagic;
    lateCount += queueLate;
  }

  console.log('\n' + '─'.repeat(70) + '\n');

  // Calculate costs
  const heygenCost = heygenCount * PRICING.heygen;
  const submagicCost = submagicCount * PRICING.submagic;
  const lateCost = PRICING.late; // Flat monthly

  console.log('🎬 HeyGen Videos Generated: ' + heygenCount);
  console.log('   💵 Cost: $' + heygenCost.toFixed(2) + ' ($0.50 per video)\n');

  console.log('📝 Submagic Videos Captioned: ' + submagicCount);
  console.log('   💵 Cost: $' + submagicCost.toFixed(2) + ' ($1.27 per video)\n');

  console.log('📱 Late Posts Published: ' + lateCount);
  console.log('   💵 Cost: $' + lateCost.toFixed(2) + ' (flat monthly rate)\n');

  // OpenAI
  console.log('─'.repeat(70) + '\n');
  const openaiEntries = await db.collection('cost_entries')
    .where('service', '==', 'openai')
    .where('timestamp', '>=', thirtyDaysAgo)
    .get();

  let openaiCost = 0;
  openaiEntries.forEach(doc => {
    openaiCost += doc.data().costUSD || 0;
  });

  console.log('🤖 OpenAI API Calls: ' + openaiEntries.size);
  console.log('   💵 Cost: $' + openaiCost.toFixed(6) + '\n');

  // R2
  console.log('─'.repeat(70) + '\n');
  const videos = await db.collection('property_videos')
    .where('createdAt', '>=', thirtyDaysAgo)
    .get();

  const estimatedGB = videos.size * 0.05; // ~50MB per video
  const r2Cost = estimatedGB * PRICING.r2;

  console.log('💾 R2 Videos Stored: ' + videos.size);
  console.log('   📊 Estimated Storage: ' + estimatedGB.toFixed(2) + ' GB');
  console.log('   💵 Cost: $' + r2Cost.toFixed(6) + '\n');

  // TOTAL
  console.log('='.repeat(70));
  console.log('\n💰 30-DAY COST BREAKDOWN:\n');
  console.log('   HeyGen:    $' + heygenCost.toFixed(2).padStart(10) + ' (' + heygenCount + ' videos)');
  console.log('   Submagic:  $' + submagicCost.toFixed(2).padStart(10) + ' (' + submagicCount + ' videos)');
  console.log('   Late:      $' + lateCost.toFixed(2).padStart(10) + ' (' + lateCount + ' posts, flat rate)');
  console.log('   OpenAI:    $' + openaiCost.toFixed(2).padStart(10) + ' (' + openaiEntries.size + ' calls)');
  console.log('   R2:        $' + r2Cost.toFixed(2).padStart(10) + ' (' + estimatedGB.toFixed(2) + ' GB)');

  const total = heygenCost + submagicCost + lateCost + openaiCost + r2Cost;

  console.log('\n' + '='.repeat(70));
  console.log('\n💵 TOTAL 30-DAY SPENDING: $' + total.toFixed(2));
  console.log('\n' + '='.repeat(70) + '\n');

  process.exit(0);
}

calculateActualSpending().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
