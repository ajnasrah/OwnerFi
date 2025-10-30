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
  late: 0,           // Flat rate $50/month (not per-post)
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

  // 1. HeyGen - Count completed workflows in last 30 days
  console.log('🎬 HEYGEN (Video Generation)');
  console.log('   Pricing: $0.50 per video\n');

  const queues = [
    'ownerfi_workflow_queue',
    'benefit_workflow_queue',
    'podcast_workflow_queue',
    'carz_workflow_queue',
    'vassdistro_workflow_queue',
    'abdullah_workflow_queue'
  ];

  let heygenCount = 0;

  for (const queue of queues) {
    const workflows = await db.collection(queue)
      .where('createdAt', '>=', thirtyDaysAgo)
      .where('heygenCompleted', '==', true)
      .get();

    if (workflows.size > 0) {
      console.log(`   ${queue.replace('_workflow_queue', '')}: ${workflows.size} videos`);
      heygenCount += workflows.size;
    }
  }

  const heygenCost = heygenCount * PRICING.heygen;
  console.log(`\n   📊 Total HeyGen Videos: ${heygenCount}`);
  console.log(`   💵 Total HeyGen Cost: $${heygenCost.toFixed(2)}\n`);

  // 2. Submagic - Count completed captions
  console.log('─'.repeat(70) + '\n');
  console.log('📝 SUBMAGIC (Caption Generation)');
  console.log('   Pricing: $1.27 per video\n');

  let submagicCount = 0;

  for (const queue of queues) {
    const workflows = await db.collection(queue)
      .where('createdAt', '>=', thirtyDaysAgo)
      .where('submagicCompleted', '==', true)
      .get();

    if (workflows.size > 0) {
      console.log(`   ${queue.replace('_workflow_queue', '')}: ${workflows.size} videos`);
      submagicCount += workflows.size;
    }
  }

  const submagicCost = submagicCount * PRICING.submagic;
  console.log(`\n   📊 Total Submagic Videos: ${submagicCount}`);
  console.log(`   💵 Total Submagic Cost: $${submagicCost.toFixed(2)}\n`);

  // 3. Late - Count social posts
  console.log('─'.repeat(70) + '\n');
  console.log('📱 LATE (Social Media Posting)');
  console.log('   Pricing: $50/month flat rate (unlimited posts)\n');

  let latePostCount = 0;

  for (const queue of queues) {
    const workflows = await db.collection(queue)
      .where('createdAt', '>=', thirtyDaysAgo)
      .where('latePosted', '==', true)
      .get();

    if (workflows.size > 0) {
      console.log(`   ${queue.replace('_workflow_queue', '')}: ${workflows.size} posts`);
      latePostCount += workflows.size;
    }
  }

  const lateCost = 50; // Flat monthly rate
  console.log(`\n   📊 Total Late Posts: ${latePostCount}`);
  console.log(`   💵 Total Late Cost: $${lateCost.toFixed(2)} (flat rate)\n`);

  // 4. OpenAI - From cost_entries
  console.log('─'.repeat(70) + '\n');
  console.log('🤖 OPENAI (API Calls)');
  console.log('   Pricing: $0.15 per 1M input tokens, $0.60 per 1M output tokens\n');

  const openaiEntries = await db.collection('cost_entries')
    .where('service', '==', 'openai')
    .where('timestamp', '>=', thirtyDaysAgo)
    .get();

  let openaiCost = 0;
  let openaiTokens = 0;

  openaiEntries.forEach(doc => {
    const data = doc.data();
    openaiCost += data.costUSD || 0;
    openaiTokens += data.units || 0;
  });

  console.log(`   📊 Total OpenAI Calls: ${openaiEntries.size}`);
  console.log(`   📊 Total Tokens: ${openaiTokens.toLocaleString()}`);
  console.log(`   💵 Total OpenAI Cost: $${openaiCost.toFixed(6)}\n`);

  // 5. R2 Storage - Estimate based on videos
  console.log('─'.repeat(70) + '\n');
  console.log('💾 R2 STORAGE (Cloudflare)');
  console.log('   Pricing: $0.015 per GB/month\n');

  const videos = await db.collection('property_videos')
    .where('createdAt', '>=', thirtyDaysAgo)
    .get();

  // Estimate: ~50MB per video = 0.05 GB
  const estimatedGB = videos.size * 0.05;
  const r2Cost = estimatedGB * PRICING.r2;

  console.log(`   📊 Videos Stored: ${videos.size}`);
  console.log(`   📊 Estimated Storage: ${estimatedGB.toFixed(2)} GB`);
  console.log(`   💵 Total R2 Cost: $${r2Cost.toFixed(6)}\n`);

  // TOTAL
  console.log('='.repeat(70));
  console.log('\n💵 TOTAL SPENDING BREAKDOWN:\n');
  console.log(`   HeyGen:    $${heygenCost.toFixed(2).padStart(10)} (${heygenCount} videos)`);
  console.log(`   Submagic:  $${submagicCost.toFixed(2).padStart(10)} (${submagicCount} videos)`);
  console.log(`   Late:      $${lateCost.toFixed(2).padStart(10)} (${latePostCount} posts, flat rate)`);
  console.log(`   OpenAI:    $${openaiCost.toFixed(2).padStart(10)} (${openaiTokens.toLocaleString()} tokens)`);
  console.log(`   R2:        $${r2Cost.toFixed(2).padStart(10)} (${estimatedGB.toFixed(2)} GB)`);
  console.log('\n' + '='.repeat(70));

  const total = heygenCost + submagicCost + lateCost + openaiCost + r2Cost;
  console.log(`\n💰 TOTAL 30-DAY COST: $${total.toFixed(2)}`);
  console.log('\n' + '='.repeat(70) + '\n');

  process.exit(0);
}

calculateActualSpending().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
