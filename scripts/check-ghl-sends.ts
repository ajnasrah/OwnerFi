const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function main() {
  // Count all properties sent to GHL
  const sentToGHL = await db.collection('properties')
    .where('sentToGHL', '==', true)
    .count().get();
  console.log('Total sent to GHL (all time):', sentToGHL.data().count);

  // Count regional properties
  const regional = await db.collection('properties')
    .where('isRegional', '==', true)
    .count().get();
  console.log('Total regional (AR/TN):', regional.data().count);

  // Count owner finance properties
  const ofCount = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .count().get();
  console.log('Total owner finance:', ofCount.data().count);

  // Count cash deals
  const cdCount = await db.collection('properties')
    .where('isCashDeal', '==', true)
    .count().get();
  console.log('Total cash deals:', cdCount.data().count);

  // Last 7 days - sent to GHL
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentGHL = await db.collection('properties')
    .where('sentToGHL', '==', true)
    .where('foundAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
    .count().get();
  console.log('\nSent to GHL (last 7 days):', recentGHL.data().count);

  // Last 7 days - owner finance
  const recentOF = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .where('foundAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
    .count().get();
  console.log('Owner finance (last 7 days):', recentOF.data().count);

  // Last 30 days breakdown
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const last30 = await db.collection('properties')
    .where('sentToGHL', '==', true)
    .where('foundAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
    .select('foundAt')
    .get();

  const byWeek: Record<string, number> = {};
  last30.docs.forEach((doc: any) => {
    const d = doc.data();
    let foundAt = d.foundAt;
    if (foundAt && foundAt.toDate) foundAt = foundAt.toDate();
    if (foundAt == null) return;
    const weekStart = new Date(foundAt);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const key = weekStart.toISOString().split('T')[0];
    byWeek[key] = (byWeek[key] || 0) + 1;
  });

  console.log('\nGHL sends by week (last 30 days):');
  Object.keys(byWeek).sort().forEach(week => {
    console.log(`  Week of ${week}: ${byWeek[week]}`);
  });

  // Sample recent GHL-sent properties
  const recentSent = await db.collection('properties')
    .where('sentToGHL', '==', true)
    .orderBy('foundAt', 'desc')
    .limit(5)
    .select('fullAddress', 'foundAt', 'isOwnerFinance', 'isCashDeal', 'dealTypes')
    .get();

  console.log('\nLast 5 sent to GHL:');
  recentSent.docs.forEach((doc: any) => {
    const d = doc.data();
    let foundAt = d.foundAt;
    if (foundAt && foundAt.toDate) foundAt = foundAt.toDate().toISOString().split('T')[0];
    const types = (d.dealTypes || []).join(', ');
    console.log(`  ${foundAt} | ${(d.fullAddress || '').substring(0, 45)} | ${types}`);
  });

  process.exit(0);
}

main().catch((e: any) => { console.error(e.message); process.exit(1); });
