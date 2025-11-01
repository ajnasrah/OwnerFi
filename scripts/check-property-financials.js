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

// Properties to check
const testAddresses = [
  '718 N Union St',
  '9543 Enstone Cir',
  '3482 Bandera Rd',
  '4504 Hunt Cir',
  '1049 Blythwood Dr',
  '6060 E River Rd'
];

async function checkProperties() {
  console.log('Checking financial data in Firebase:\n');

  const snapshot = await db.collection('properties').get();

  snapshot.forEach(doc => {
    const data = doc.data();

    // Check if this is one of our test addresses
    const isTestAddress = testAddresses.some(testAddr =>
      data.address && data.address.toLowerCase().includes(testAddr.toLowerCase())
    );

    if (isTestAddress) {
      console.log(`\n📍 Property: ${data.address}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Interest Rate: ${data.interestRate !== undefined ? data.interestRate + '%' : 'Not set'}`);
      console.log(`   Down Payment %: ${data.downPaymentPercent !== undefined ? data.downPaymentPercent + '%' : 'Not set'}`);
      console.log(`   Down Payment Amt: ${data.downPaymentAmount !== undefined ? '$' + data.downPaymentAmount : 'Not set'}`);
      console.log(`   Balloon Years: ${data.balloonYears !== undefined ? data.balloonYears + ' years' : 'Not set'}`);
      console.log(`   Balloon Payment: ${data.balloonPayment !== undefined ? '$' + data.balloonPayment : 'Not set'}`);
      console.log(`   Monthly Payment: ${data.monthlyPayment !== undefined ? '$' + data.monthlyPayment : 'Not set'}`);
    }
  });

  console.log('\n✅ Check complete');
}

checkProperties()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });