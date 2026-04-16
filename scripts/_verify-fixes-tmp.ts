import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();

async function main() {
  const snap = await db.collection('properties').get();
  console.log(`Fetched ${snap.size} docs\n`);

  const homeTypeFreq: Record<string, number> = {};
  let cashDealCount = 0;
  let landCashDeals = 0;
  let activeCount = 0;
  let activeWithDealTypes = 0;
  let ofDriftCount = 0;
  let cashDriftCount = 0;
  let missingLand = 0;
  let landProps = 0;
  let cashFieldMismatch = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    homeTypeFreq[d.homeType || '(missing)'] = (homeTypeFreq[d.homeType || '(missing)'] || 0) + 1;
    if (d.isActive !== false) {
      activeCount++;
      if (Array.isArray(d.dealTypes) && d.dealTypes.length > 0) activeWithDealTypes++;
    }
    if (d.isCashDeal === true) {
      cashDealCount++;
      if (d.isLand === true) landCashDeals++;
      // Check math
      const price = Number(d.listPrice ?? d.price ?? 0);
      const zest = Number(d.estimate ?? d.zestimate ?? 0);
      if (price > 0 && zest > 0 && price >= zest * 0.8) cashFieldMismatch++;
    }
    if (d.isLand === true) landProps++;
    if (!('isLand' in d)) missingLand++;

    // Boolean vs array drift
    const dt: string[] = Array.isArray(d.dealTypes) ? d.dealTypes : [];
    const ofInArr = dt.includes('owner_finance');
    const cdInArr = dt.includes('cash_deal');
    if (Boolean(d.isOwnerfinance) !== ofInArr) ofDriftCount++;
    if (Boolean(d.isCashDeal) !== cdInArr) cashDriftCount++;
  }

  console.log('========== VERIFICATION ==========\n');
  console.log('homeType frequency:');
  for (const [k, v] of Object.entries(homeTypeFreq).sort((a, b) => b[1] - a[1])) {
    const isNormalized = k === k.toLowerCase() && !/[A-Z_]/.test(k);
    console.log(`  ${isNormalized ? '✅' : '❌'} ${k.padEnd(20)} ${v}`);
  }

  console.log(`\nActive docs: ${activeCount}`);
  console.log(`  with non-empty dealTypes: ${activeWithDealTypes}`);
  console.log(`\nCash deals: ${cashDealCount}`);
  console.log(`  land cash deals (should be 0): ${landCashDeals} ${landCashDeals === 0 ? '✅' : '❌'}`);
  console.log(`  cash-deal math mismatch (price ≥ 80% zestimate): ${cashFieldMismatch} ${cashFieldMismatch === 0 ? '✅' : '❌'}`);
  console.log(`\nLand props: ${landProps}`);
  console.log(`Docs missing isLand field: ${missingLand} ${missingLand === 0 ? '✅' : '❌'}`);
  console.log(`\ndealTypes ↔ boolean drift:`);
  console.log(`  isOwnerfinance drift: ${ofDriftCount} ${ofDriftCount === 0 ? '✅' : '❌'}`);
  console.log(`  isCashDeal drift:     ${cashDriftCount} ${cashDriftCount === 0 ? '✅' : '❌'}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
