/**
 * Count properties added in the last 24 hours
 * Usage: npx tsx scripts/count-recent.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function main() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log('=== Properties Added (Last 24 Hours) ===');
  console.log('From:', yesterday.toISOString());
  console.log('To:  ', now.toISOString());
  console.log('---');

  // Try ISO string query first (scraper writes ISO strings for createdAt)
  let snap = await db.collection('properties')
    .where('createdAt', '>=', yesterday.toISOString())
    .get();

  // If zero, try Firestore Timestamp
  if (snap.size === 0) {
    console.log('(Trying Firestore Timestamp format...)');
    snap = await db.collection('properties')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(yesterday))
      .get();
  }

  let ownerFinance = 0;
  let cashDeal = 0;
  let both = 0;
  let other = 0;

  snap.docs.forEach((doc: any) => {
    const data = doc.data();
    const types: string[] = data.dealTypes || [];
    const hasOF = types.includes('owner_finance');
    const hasCD = types.includes('cash_deal');

    if (hasOF && hasCD) both++;
    else if (hasOF) ownerFinance++;
    else if (hasCD) cashDeal++;
    else other++;
  });

  console.log('Total new properties:', snap.size);
  console.log('Owner Finance only:', ownerFinance);
  console.log('Cash Deal only:', cashDeal);
  console.log('Both OF + Cash:', both);
  if (other > 0) console.log('Other/No deal type:', other);
  console.log('---');
  console.log('Total Owner Finance (incl. both):', ownerFinance + both);
  console.log('Total Cash Deals (incl. both):', cashDeal + both);
}

main().catch(console.error);
