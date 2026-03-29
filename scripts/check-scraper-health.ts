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
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const snap = await db.collection('properties')
    .where('foundAt', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
    .select('foundAt', 'dealTypes', 'isOwnerfinance', 'isCashDeal')
    .get();

  const byDay: Record<string, { total: number; of: number; cd: number; both: number }> = {};
  snap.docs.forEach((doc: any) => {
    const d = doc.data();
    let foundAt = d.foundAt;
    if (foundAt && foundAt.toDate) foundAt = foundAt.toDate();
    if (foundAt == null) return;
    const day = foundAt.toISOString().split('T')[0];
    if (!byDay[day]) byDay[day] = { total: 0, of: 0, cd: 0, both: 0 };
    byDay[day].total++;
    const isOF = d.isOwnerfinance;
    const isCD = d.isCashDeal;
    if (isOF && isCD) byDay[day].both++;
    else if (isOF) byDay[day].of++;
    else if (isCD) byDay[day].cd++;
  });

  console.log('=== Last 7 Days Breakdown ===');
  console.log('Date       | Total | OF | Cash | Both');
  console.log('-'.repeat(45));
  Object.keys(byDay).sort().forEach(day => {
    const d = byDay[day];
    console.log(`${day} |  ${String(d.total).padStart(4)} | ${String(d.of).padStart(2)} |  ${String(d.cd).padStart(3)} |  ${String(d.both).padStart(3)}`);
  });
  console.log('-'.repeat(45));
  console.log('Total:', snap.size);

  process.exit(0);
}

main().catch((e: any) => { console.error(e.message); process.exit(1); });
