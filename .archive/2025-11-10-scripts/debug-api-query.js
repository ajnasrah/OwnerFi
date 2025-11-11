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

function getTodayDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function debugQuery() {
  console.log('🔍 Debugging API Query\n');

  const today = getTodayDate();
  const month = getCurrentMonth();

  console.log(`Today's date: ${today}`);
  console.log(`Current month: ${month}`);
  console.log(`System time: ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  // Simulate getTotalDailyCosts
  console.log(`\n📅 Querying daily_costs where date == '${today}'`);
  const dailySnapshot = await db.collection('daily_costs')
    .where('date', '==', today)
    .get();

  console.log(`  Found ${dailySnapshot.size} documents`);
  dailySnapshot.forEach(doc => {
    console.log(`    ${doc.id}:`, doc.data());
  });

  // Simulate getTotalMonthlyCosts
  console.log(`\n📆 Querying monthly_costs where month == '${month}'`);
  const monthlySnapshot = await db.collection('monthly_costs')
    .where('month', '==', month)
    .get();

  console.log(`  Found ${monthlySnapshot.size} documents`);
  monthlySnapshot.forEach(doc => {
    console.log(`    ${doc.id}:`, doc.data());
  });

  // Check what dates actually exist
  console.log('\n\n📊 All dates in daily_costs:');
  const allDaily = await db.collection('daily_costs').get();
  const dates = new Set();
  allDaily.forEach(doc => {
    dates.add(doc.data().date);
  });
  console.log(`  ${Array.from(dates).sort().join(', ')}`);

  console.log('\n📊 All months in monthly_costs:');
  const allMonthly = await db.collection('monthly_costs').get();
  const months = new Set();
  allMonthly.forEach(doc => {
    months.add(doc.data().month);
  });
  console.log(`  ${Array.from(months).sort().join(', ')}`);

  console.log('\n' + '='.repeat(80));

  await admin.app().delete();
}

debugQuery().catch(console.error);
