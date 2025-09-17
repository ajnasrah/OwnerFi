#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    clientEmail,
  })
});

const db = admin.firestore();

async function countFinancialData() {
  console.log('📊 Counting properties with financial data...\n');

  const snapshot = await db.collection('properties').get();

  let stats = {
    total: 0,
    withInterestRate: 0,
    withDownPaymentPercent: 0,
    withBalloonYears: 0,
    withAnyFinancialData: 0,
    withAllThreeFields: 0,
    propertiesWithData: []
  };

  snapshot.forEach(doc => {
    const data = doc.data();
    stats.total++;

    let hasInterest = data.interestRate !== undefined && data.interestRate !== null;
    let hasDownPercent = data.downPaymentPercent !== undefined && data.downPaymentPercent !== null;
    let hasBalloon = data.balloonYears !== undefined && data.balloonYears !== null;

    if (hasInterest) stats.withInterestRate++;
    if (hasDownPercent) stats.withDownPaymentPercent++;
    if (hasBalloon) stats.withBalloonYears++;

    if (hasInterest || hasDownPercent || hasBalloon) {
      stats.withAnyFinancialData++;

      stats.propertiesWithData.push({
        address: data.address,
        interestRate: hasInterest ? data.interestRate : null,
        downPaymentPercent: hasDownPercent ? data.downPaymentPercent : null,
        balloonYears: hasBalloon ? data.balloonYears : null
      });
    }

    if (hasInterest && hasDownPercent && hasBalloon) {
      stats.withAllThreeFields++;
    }
  });

  console.log('='.repeat(60));
  console.log('📈 FINANCIAL DATA SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total properties in database: ${stats.total}`);
  console.log(`Properties with ANY financial data: ${stats.withAnyFinancialData}`);
  console.log(`  → With Interest Rate: ${stats.withInterestRate}`);
  console.log(`  → With Down Payment %: ${stats.withDownPaymentPercent}`);
  console.log(`  → With Balloon Years: ${stats.withBalloonYears}`);
  console.log(`  → With ALL three fields: ${stats.withAllThreeFields}`);

  console.log('\n📋 Properties with financial data:');
  console.log('-'.repeat(60));

  stats.propertiesWithData.forEach((prop, index) => {
    console.log(`${index + 1}. ${prop.address}`);
    if (prop.interestRate !== null) console.log(`   Interest: ${prop.interestRate}%`);
    if (prop.downPaymentPercent !== null) console.log(`   Down Payment: ${prop.downPaymentPercent}%`);
    if (prop.balloonYears !== null) console.log(`   Balloon: ${prop.balloonYears} years`);
  });

  console.log('\n✅ Count complete');
}

countFinancialData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });