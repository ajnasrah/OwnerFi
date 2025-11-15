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

async function checkMissingEstimates() {
  console.log('🔍 Checking properties for missing estimates...\n');

  // Check zillow_imports collection
  const zillowImports = await db.collection('zillow_imports').get();
  let missingEstimate = 0;
  let missingRent = 0;
  let missingBoth = 0;
  let hasEstimate = 0;
  let hasRent = 0;
  let hasBoth = 0;

  zillowImports.docs.forEach(doc => {
    const data = doc.data();
    const estimate = data.estimate || 0;
    const rentEstimate = data.rentEstimate || 0;

    if (!estimate && !rentEstimate) {
      missingBoth++;
    } else if (!estimate) {
      missingEstimate++;
    } else if (!rentEstimate) {
      missingRent++;
    } else {
      hasBoth++;
    }

    if (estimate > 0) hasEstimate++;
    if (rentEstimate > 0) hasRent++;
  });

  console.log('📊 ZILLOW_IMPORTS Collection:');
  console.log(`   Total Properties: ${zillowImports.size}`);
  console.log(`   Has Zestimate: ${hasEstimate} (${(hasEstimate/zillowImports.size*100).toFixed(1)}%)`);
  console.log(`   Missing Zestimate: ${missingEstimate + missingBoth} (${((missingEstimate + missingBoth)/zillowImports.size*100).toFixed(1)}%)`);
  console.log(`   Has Rent Estimate: ${hasRent} (${(hasRent/zillowImports.size*100).toFixed(1)}%)`);
  console.log(`   Missing Rent Estimate: ${missingRent + missingBoth} (${((missingRent + missingBoth)/zillowImports.size*100).toFixed(1)}%)`);
  console.log(`   Missing BOTH: ${missingBoth}`);

  // Check cash_houses collection
  const cashHouses = await db.collection('cash_houses').get();
  let cashMissingEstimate = 0;
  let cashHasEstimate = 0;

  cashHouses.docs.forEach(doc => {
    const data = doc.data();
    const estimate = data.estimate || 0;
    if (estimate > 0) {
      cashHasEstimate++;
    } else {
      cashMissingEstimate++;
    }
  });

  console.log('\n📊 CASH_HOUSES Collection:');
  console.log(`   Total Properties: ${cashHouses.size}`);
  console.log(`   Has Zestimate: ${cashHasEstimate} (${(cashHasEstimate/cashHouses.size*100).toFixed(1)}%)`);
  console.log(`   Missing Zestimate: ${cashMissingEstimate} (${(cashMissingEstimate/cashHouses.size*100).toFixed(1)}%)`);
}

checkMissingEstimates().catch(console.error);
