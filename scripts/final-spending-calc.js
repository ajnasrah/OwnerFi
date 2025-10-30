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

const PRICING = {
  heygen: 0.50,
  submagic: 1.27,
  late: 50,
  r2: 0.015
};

async function calculateSpending() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  console.log('\n💰 30-DAY ACTUAL SPENDING BREAKDOWN\n');
  console.log('📅 Period:', new Date(thirtyDaysAgo).toLocaleDateString(), '-', new Date().toLocaleDateString());
  console.log('='.repeat(80) + '\n');

  const queues = [
    'ownerfi_workflow_queue',
    'benefit_workflow_queue',
    'podcast_workflow_queue',
    'carz_workflow_queue',
    'vassdistro_workflow_queue',
    'abdullah_workflow_queue'
  ];

  let totalHeygen = 0, totalSubmagic = 0, totalLate = 0;
  const breakdown = {};

  for (const queue of queues) {
    const brand = queue.replace('_workflow_queue', '');
    const workflows = await db.collection(queue)
      .where('createdAt', '>=', thirtyDaysAgo)
      .get();

    let heygen = 0, submagic = 0, late = 0;

    workflows.forEach(doc => {
      const data = doc.data();
      if (data.heygenVideoId && data.heygenVideoId !== 'none') heygen++;
      if (data.submagicVideoId && data.submagicVideoId !== 'none') submagic++;
      if (data.status === 'completed' || data.latePosted === true || data.posted === true) late++;
    });

    totalHeygen += heygen;
    totalSubmagic += submagic;
    totalLate += late;

    if (workflows.size > 0) {
      breakdown[brand] = { total: workflows.size, heygen, submagic, late };
    }
  }

  // Display breakdown
  console.log('📊 Workflow Breakdown by Brand:\n');
  Object.entries(breakdown).forEach(([brand, stats]) => {
    console.log(`   ${brand.padEnd(15)} | Total: ${stats.total.toString().padStart(3)} | HeyGen: ${stats.heygen.toString().padStart(3)} | Submagic: ${stats.submagic.toString().padStart(3)} | Late: ${stats.late.toString().padStart(3)}`);
  });

  console.log('\n' + '='.repeat(80) + '\n');

  // Calculate costs
  const heygenCost = totalHeygen * PRICING.heygen;
  const submagicCost = totalSubmagic * PRICING.submagic;
  const lateCost = PRICING.late;

  console.log('💰 COST BREAKDOWN:\n');
  console.log(`   🎬 HeyGen (Video Generation)`);
  console.log(`      Videos: ${totalHeygen}`);
  console.log(`      Cost: $${heygenCost.toFixed(2)} ($0.50 per video)\n`);

  console.log(`   📝 Submagic (Caption Generation)`);
  console.log(`      Videos: ${totalSubmagic}`);
  console.log(`      Cost: $${submagicCost.toFixed(2)} ($1.27 per video)\n`);

  console.log(`   📱 Late.so (Social Posting)`);
  console.log(`      Posts: ${totalLate}`);
  console.log(`      Cost: $${lateCost.toFixed(2)} (flat monthly subscription)\n`);

  // OpenAI - just count entries
  const openaiEntries = await db.collection('cost_entries')
    .where('service', '==', 'openai')
    .get();

  let openaiCost = 0;
  let openaiRecent = 0;
  openaiEntries.forEach(doc => {
    const data = doc.data();
    openaiCost += data.costUSD || 0;
    if (data.timestamp >= thirtyDaysAgo) openaiRecent++;
  });

  console.log(`   🤖 OpenAI (API Calls)`);
  console.log(`      Calls (last 30d): ${openaiRecent}`);
  console.log(`      Cost (all-time): $${openaiCost.toFixed(6)}\n`);

  // R2 - estimate
  const videos = await db.collection('property_videos')
    .where('createdAt', '>=', thirtyDaysAgo)
    .get();
  const estimatedGB = videos.size * 0.05;
  const r2Cost = estimatedGB * PRICING.r2;

  console.log(`   💾 R2 Storage (Cloudflare)`);
  console.log(`      Videos: ${videos.size}`);
  console.log(`      Estimated: ${estimatedGB.toFixed(2)} GB`);
  console.log(`      Cost: $${r2Cost.toFixed(6)}\n`);

  const total = heygenCost + submagicCost + lateCost + openaiCost + r2Cost;

  console.log('='.repeat(80));
  console.log(`\n💵 TOTAL 30-DAY SPENDING: $${total.toFixed(2)}\n`);
  console.log('='.repeat(80) + '\n');

  process.exit(0);
}

calculateSpending().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
