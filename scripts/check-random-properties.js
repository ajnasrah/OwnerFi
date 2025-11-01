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

async function checkRandomProperties() {
  console.log('🎲 Checking 25 random properties for financial data:\n');
  console.log('='.repeat(70));

  const snapshot = await db.collection('properties').get();
  const allProperties = [];

  snapshot.forEach(doc => {
    allProperties.push({
      id: doc.id,
      ...doc.data()
    });
  });

  // Shuffle and take 25 random properties
  const shuffled = allProperties.sort(() => 0.5 - Math.random());
  const randomProperties = shuffled.slice(0, 25);

  randomProperties.forEach((property, index) => {
    console.log(`\n${index + 1}. ${property.address || 'No address'}`);
    console.log(`   City: ${property.city}, ${property.state}`);
    console.log(`   List Price: $${property.listPrice?.toLocaleString() || 'N/A'}`);

    // Check financial fields
    const hasInterest = property.interestRate !== undefined && property.interestRate !== null;
    const hasDownPercent = property.downPaymentPercent !== undefined && property.downPaymentPercent !== null;
    const hasBalloon = property.balloonYears !== undefined && property.balloonYears !== null;

    console.log(`   ✅ Interest Rate: ${hasInterest ? property.interestRate + '%' : '❌ NOT SET'}`);
    console.log(`   ✅ Down Payment %: ${hasDownPercent ? property.downPaymentPercent + '%' : '❌ NOT SET'}`);
    console.log(`   ${hasBalloon ? '✅' : '⚪'} Balloon Years: ${hasBalloon ? property.balloonYears + ' years' : 'Not specified'}`);

    if (!hasInterest || !hasDownPercent) {
      console.log(`   ⚠️  WARNING: Missing critical financial data!`);
    }
  });

  // Summary
  const withInterest = randomProperties.filter(p => p.interestRate !== undefined && p.interestRate !== null).length;
  const withDownPercent = randomProperties.filter(p => p.downPaymentPercent !== undefined && p.downPaymentPercent !== null).length;
  const withBalloon = randomProperties.filter(p => p.balloonYears !== undefined && p.balloonYears !== null).length;

  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY OF 25 RANDOM PROPERTIES:');
  console.log('='.repeat(70));
  console.log(`Properties with Interest Rate: ${withInterest}/25 (${(withInterest/25*100).toFixed(0)}%)`);
  console.log(`Properties with Down Payment %: ${withDownPercent}/25 (${(withDownPercent/25*100).toFixed(0)}%)`);
  console.log(`Properties with Balloon Years: ${withBalloon}/25 (${(withBalloon/25*100).toFixed(0)}%)`);

  if (withInterest < 25 || withDownPercent < 25) {
    console.log('\n⚠️  Some properties are missing financial data!');
  } else {
    console.log('\n✅ All checked properties have interest rate and down payment data!');
  }
}

checkRandomProperties()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });