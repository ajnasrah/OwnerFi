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

async function checkAggregatedCosts() {
  console.log('📊 Checking Aggregated Cost Collections\n');
  console.log('='.repeat(80));

  // Check daily_costs
  const dailyCosts = await db.collection('daily_costs').get();
  console.log(`\n📅 Daily Costs Collection: ${dailyCosts.size} documents`);

  if (dailyCosts.size > 0) {
    console.log('\nSample daily cost documents:');
    dailyCosts.docs.slice(0, 5).forEach(doc => {
      const data = doc.data();
      console.log(`  ${doc.id}:`, JSON.stringify(data, null, 2));
    });
  } else {
    console.log('  ⚠️  NO DAILY COST DOCUMENTS FOUND!');
  }

  // Check monthly_costs
  const monthlyCosts = await db.collection('monthly_costs').get();
  console.log(`\n📆 Monthly Costs Collection: ${monthlyCosts.size} documents`);

  if (monthlyCosts.size > 0) {
    console.log('\nSample monthly cost documents:');
    monthlyCosts.docs.slice(0, 5).forEach(doc => {
      const data = doc.data();
      console.log(`  ${doc.id}:`, JSON.stringify(data, null, 2));
    });
  } else {
    console.log('  ⚠️  NO MONTHLY COST DOCUMENTS FOUND!');
  }

  // Get today's date
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);

  console.log(`\n\n🔍 Looking for today's costs: ${today}`);
  console.log(`🔍 Looking for this month's costs: ${thisMonth}`);

  const brands = ['ownerfi', 'carz', 'vassdistro', 'podcast', 'benefit'];

  console.log('\n📊 Checking for specific documents:');
  for (const brand of brands) {
    const dailyDocId = `${brand}_${today}`;
    const monthlyDocId = `${brand}_${thisMonth}`;

    const dailyDoc = await db.collection('daily_costs').doc(dailyDocId).get();
    const monthlyDoc = await db.collection('monthly_costs').doc(monthlyDocId).get();

    console.log(`\n  ${brand}:`);
    console.log(`    Daily (${dailyDocId}): ${dailyDoc.exists ? '✅ EXISTS' : '❌ MISSING'}`);
    if (dailyDoc.exists) {
      console.log(`      Data:`, JSON.stringify(dailyDoc.data(), null, 6));
    }
    console.log(`    Monthly (${monthlyDocId}): ${monthlyDoc.exists ? '✅ EXISTS' : '❌ MISSING'}`);
    if (monthlyDoc.exists) {
      console.log(`      Data:`, JSON.stringify(monthlyDoc.data(), null, 6));
    }
  }

  console.log('\n' + '='.repeat(80));

  await admin.app().delete();
}

checkAggregatedCosts().catch(console.error);
