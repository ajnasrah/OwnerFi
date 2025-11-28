import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

async function check() {
  // Check cash_houses
  const cash = await db.collection('cash_houses').get();
  const cashWithArv = cash.docs.filter(d => (d.data().estimate || 0) > 0 || (d.data().arv || 0) > 0).length;
  const cashWithRent = cash.docs.filter(d => (d.data().rentEstimate || 0) > 0).length;
  const cashWithCashFlow = cash.docs.filter(d => d.data().cashFlow).length;

  // Check zillow_imports
  const zillow = await db.collection('zillow_imports').limit(500).get();
  const zillowWithArv = zillow.docs.filter(d => (d.data().estimate || 0) > 0 || (d.data().arv || 0) > 0).length;
  const zillowWithRent = zillow.docs.filter(d => (d.data().rentEstimate || 0) > 0).length;
  const zillowWithCashFlow = zillow.docs.filter(d => d.data().cashFlow).length;

  console.log('=== DATA QUALITY CHECK ===\n');
  console.log('cash_houses:');
  console.log(`  Total: ${cash.size}`);
  console.log(`  With ARV/Zestimate: ${cashWithArv} (${Math.round(cashWithArv/cash.size*100)}%)`);
  console.log(`  With Rent Estimate: ${cashWithRent} (${Math.round(cashWithRent/cash.size*100)}%)`);
  console.log(`  With CashFlow: ${cashWithCashFlow} (${Math.round(cashWithCashFlow/cash.size*100)}%)`);
  console.log('');
  console.log('zillow_imports (sample 500):');
  console.log(`  Total: ${zillow.size}`);
  console.log(`  With ARV/Zestimate: ${zillowWithArv} (${Math.round(zillowWithArv/zillow.size*100)}%)`);
  console.log(`  With Rent Estimate: ${zillowWithRent} (${Math.round(zillowWithRent/zillow.size*100)}%)`);
  console.log(`  With CashFlow: ${zillowWithCashFlow} (${Math.round(zillowWithCashFlow/zillow.size*100)}%)`);
}

check().catch(console.error);
