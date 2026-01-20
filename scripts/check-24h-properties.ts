import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function checkLast24Hours() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log('\nChecking properties created since: ' + twentyFourHoursAgo.toISOString());
  console.log('Current time: ' + now.toISOString() + '\n');

  // Query properties created in last 24 hours
  const snapshot = await db.collection('properties')
    .where('createdAt', '>=', Timestamp.fromDate(twentyFourHoursAgo))
    .get();

  let ownerFinanceCount = 0;
  let cashDealCount = 0;
  let bothCount = 0;

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const isOF = data.isOwnerFinance === true;
    const isCD = data.isCashDeal === true;

    if (isOF && isCD) bothCount++;
    else if (isOF) ownerFinanceCount++;
    else if (isCD) cashDealCount++;
  });

  console.log('==================================================');
  console.log('PROPERTIES FOUND IN LAST 24 HOURS');
  console.log('==================================================');
  console.log('Total new properties: ' + snapshot.size);
  console.log('  - Owner Finance only: ' + ownerFinanceCount);
  console.log('  - Cash Deal only: ' + cashDealCount);
  console.log('  - Both (OF + CD): ' + bothCount);
  console.log('  - Total Owner Finance: ' + (ownerFinanceCount + bothCount));
  console.log('  - Total Cash Deals: ' + (cashDealCount + bothCount));
  console.log('==================================================');
}

checkLast24Hours().catch(console.error);
