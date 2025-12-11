import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function checkProperty() {
  console.log('🔍 Searching for 6905 Petworth...\n');

  const snap = await db.collection('cash_houses').get();
  let found = false;

  snap.forEach(doc => {
    const data = doc.data();
    if (data.fullAddress?.includes('Petworth') || data.streetAddress?.includes('Petworth')) {
      found = true;
      console.log('Found:');
      console.log('  Address:', data.fullAddress || data.streetAddress);
      console.log('  Price:', '$' + (data.price || 0).toLocaleString());
      console.log('  Zestimate:', '$' + (data.estimate || data.zestimate || 0).toLocaleString());
      const price = data.price || 0;
      const est = data.estimate || data.zestimate || 0;
      const spread = est > 0 ? ((est - price) / est * 100).toFixed(1) : 'N/A';
      console.log('  Spread:', spread + '%');
      console.log('  Discount %:', data.discountPercentage);
      console.log('  Source:', data.source);
      console.log('  Deal Type:', data.dealType);
      console.log('  Added:', data.importedAt?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString() || 'unknown');
      console.log('  Doc ID:', doc.id);
    }
  });

  if (!found) {
    console.log('Property not found in cash_houses');
  }
}

async function checkAllCashHousesSpread() {
  console.log('\n========================================');
  console.log('📊 CASH_HOUSES SPREAD ANALYSIS');
  console.log('========================================\n');

  const snap = await db.collection('cash_houses').get();

  let noSpread = 0;
  let under10 = 0;
  let under20 = 0;
  let goodSpread = 0;
  const badDeals: Array<{address: string, price: number, estimate: number, spread: number, source: string}> = [];

  snap.forEach(doc => {
    const data = doc.data();
    const price = data.price || 0;
    const estimate = data.estimate || data.zestimate || 0;

    if (!estimate || !price) {
      noSpread++;
      return;
    }

    const spreadPercent = ((estimate - price) / estimate) * 100;

    if (spreadPercent < 10) {
      under10++;
      badDeals.push({
        address: data.fullAddress || data.streetAddress || 'Unknown',
        price,
        estimate,
        spread: spreadPercent,
        source: data.source || 'unknown'
      });
    } else if (spreadPercent < 20) {
      under20++;
    } else {
      goodSpread++;
    }
  });

  console.log('Total:', snap.size);
  console.log('Good spread (20%+):', goodSpread);
  console.log('Moderate spread (10-20%):', under20);
  console.log('Bad spread (<10%):', under10);
  console.log('No estimate data:', noSpread);

  if (badDeals.length > 0) {
    console.log('\n🚨 PROPERTIES WITH LESS THAN 10% SPREAD:');
    badDeals.sort((a, b) => a.spread - b.spread).forEach((d, i) => {
      console.log('  ' + (i+1) + '. ' + d.address);
      console.log('     Price: $' + d.price.toLocaleString() + ' | Est: $' + d.estimate.toLocaleString() + ' | Spread: ' + d.spread.toFixed(1) + '% | Source: ' + d.source);
    });
  }
}

checkProperty().then(() => checkAllCashHousesSpread()).catch(console.error);
