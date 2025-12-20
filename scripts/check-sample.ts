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
  // Get sample owner finance properties
  const snap = await db.collection('properties')
    .where('isOwnerFinance', '==', true)
    .limit(5)
    .get();

  console.log('Sample OWNER FINANCE properties:\n');
  snap.docs.forEach(doc => {
    const d = doc.data();
    console.log('ID:', doc.id);
    console.log('Address:', d.streetAddress, d.city, d.state);
    console.log('isOwnerFinance:', d.isOwnerFinance);
    console.log('isCashDeal:', d.isCashDeal);
    console.log('primaryImage:', d.primaryImage?.substring(0, 80) + '...');
    console.log('description:', (d.description || '').substring(0, 100) + '...');
    console.log('matchedKeywords:', d.matchedKeywords);
    console.log('');
  });

  // Check if there are any properties WITHOUT isOwnerFinance set
  const allSnap = await db.collection('properties').limit(100).get();
  let noOwnerFinance = 0;
  let noCashDeal = 0;
  let neither = 0;

  allSnap.docs.forEach(doc => {
    const d = doc.data();
    if (d.isOwnerFinance !== true && d.isCashDeal !== true) neither++;
    if (d.isOwnerFinance !== true) noOwnerFinance++;
    if (d.isCashDeal !== true) noCashDeal++;
  });

  console.log('\n=== DATA CHECK (sample of 100) ===');
  console.log('Properties without isOwnerFinance=true:', noOwnerFinance);
  console.log('Properties without isCashDeal=true:', noCashDeal);
  console.log('Properties with NEITHER flag:', neither);
}

main().catch(console.error);
