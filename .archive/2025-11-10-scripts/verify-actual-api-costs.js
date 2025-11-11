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

async function verifyAPICosts() {
  console.log('🔍 VERIFYING ACTUAL API COSTS FROM FIREBASE\n');
  console.log('='.repeat(80));

  // Get all Submagic cost entries to see actual charged amounts
  const submagicEntries = await db.collection('cost_entries')
    .where('service', '==', 'submagic')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get();

  console.log(`\n📊 Last 20 Submagic API Charges:\n`);

  const costs = [];
  submagicEntries.forEach(doc => {
    const data = doc.data();
    costs.push(data.costUSD);
    console.log(`${new Date(data.timestamp).toISOString()}: $${data.costUSD} - Brand: ${data.brand}`);
  });

  if (costs.length > 0) {
    const uniqueCosts = [...new Set(costs)];
    console.log(`\n📈 Unique Submagic costs charged: ${uniqueCosts.map(c => '$' + c).join(', ')}`);
    console.log(`\nMost common cost: $${costs[0]} per video`);
  }

  // Get all HeyGen cost entries
  const heygenEntries = await db.collection('cost_entries')
    .where('service', '==', 'heygen')
    .orderBy('timestamp', 'desc')
    .limit(20)
    .get();

  console.log(`\n\n📊 Last 20 HeyGen API Charges:\n`);

  if (heygenEntries.size === 0) {
    console.log('❌ NO HEYGEN CHARGES FOUND IN DATABASE');
    console.log('   This means HeyGen was NOT used, or costs were not tracked.');
  } else {
    const heygenCosts = [];
    heygenEntries.forEach(doc => {
      const data = doc.data();
      heygenCosts.push(data.costUSD);
      console.log(`${new Date(data.timestamp).toISOString()}: $${data.costUSD} - Brand: ${data.brand} - Units: ${data.units}`);
    });

    if (heygenCosts.length > 0) {
      const uniqueHeygenCosts = [...new Set(heygenCosts)];
      console.log(`\n📈 Unique HeyGen costs charged: ${uniqueHeygenCosts.map(c => '$' + c).join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 ACTUAL PRICING FROM REAL API CALLS:\n');

  if (costs.length > 0) {
    console.log(`Submagic: $${costs[0]} per video (from actual API charges)`);
  }

  if (heygenEntries.size > 0) {
    console.log(`HeyGen: Check charges above`);
  } else {
    console.log(`HeyGen: NOT USED in recent history`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 DOCUMENTATION vs REALITY:\n');
  console.log('HeyGen Scale Plan ($330/month for 660 credits):');
  console.log('  - Cost per credit: $0.50');
  console.log('  - Video avatar: 1 credit/min');
  console.log('  - Example: 2-min video = 2 credits = $1.00\n');

  console.log('Submagic Actual Charges:');
  console.log(`  - From our database: $${costs[0] || 'UNKNOWN'} per video`);
  console.log('  - Need to verify with Submagic documentation\n');

  console.log('\n' + '='.repeat(80));

  await admin.app().delete();
}

verifyAPICosts().catch(console.error);
