#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

async function main() {
  const snap = await db.collection('properties').limit(10).get();

  console.log('Sample of 10 properties in database:\n');
  snap.docs.forEach(doc => {
    const d = doc.data();
    console.log('-', d.streetAddress, d.city);
    console.log('   isOwnerFinance:', d.isOwnerFinance);
    console.log('   isCashDeal:', d.isCashDeal);
    console.log('   primaryImage:', d.primaryImage ? 'YES' : 'NO');
    console.log('   hiResImageLink:', d.hiResImageLink ? 'YES' : 'NO');
    console.log('   description:', (d.description || '').substring(0, 80) + '...');
    console.log('');
  });

  // Count totals
  const allProps = await db.collection('properties').get();
  let ownerFinance = 0;
  let cashDeal = 0;
  let both = 0;
  let hasImage = 0;

  allProps.docs.forEach(doc => {
    const d = doc.data();
    if (d.isOwnerFinance && d.isCashDeal) both++;
    else if (d.isOwnerFinance) ownerFinance++;
    else if (d.isCashDeal) cashDeal++;

    if (d.primaryImage || d.hiResImageLink || d.imgSrc) hasImage++;
  });

  console.log('\n=== TOTALS ===');
  console.log('Total properties:', allProps.size);
  console.log('Owner Finance only:', ownerFinance);
  console.log('Cash Deal only:', cashDeal);
  console.log('Both:', both);
  console.log('Has image:', hasImage);
}

main().catch(console.error);
