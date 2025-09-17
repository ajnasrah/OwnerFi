// Test script for balloon payment calculation logic
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Test balloon payment calculation
function calculateBalloonPayment(listPrice, downPayment, interestRate, balloonYears, totalYears = 20) {
  const loanAmount = listPrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const totalTermMonths = totalYears * 12;
  const balloonMonths = balloonYears * 12;

  if (monthlyRate > 0 && balloonMonths > 0) {
    // Calculate principal paid during balloon period
    const principalPaid = loanAmount *
      (Math.pow(1 + monthlyRate, balloonMonths) - 1) /
      (Math.pow(1 + monthlyRate, totalTermMonths) - 1);

    return Math.round(loanAmount - principalPaid);
  }
  return 0;
}

async function testBalloonLogic() {
  console.log('=== Testing Balloon Payment Calculation Logic ===\n');

  // Test Cases
  const testCases = [
    {
      name: 'Standard 5-year balloon',
      listPrice: 250000,
      downPayment: 37500,
      interestRate: 8,
      balloonYears: 5,
      totalYears: 20
    },
    {
      name: '3-year balloon with lower interest',
      listPrice: 200000,
      downPayment: 20000,
      interestRate: 6,
      balloonYears: 3,
      totalYears: 20
    },
    {
      name: '7-year balloon',
      listPrice: 300000,
      downPayment: 60000,
      interestRate: 7.5,
      balloonYears: 7,
      totalYears: 20
    }
  ];

  console.log('Test Case Results:');
  console.log('==================');

  testCases.forEach(test => {
    const balloonPayment = calculateBalloonPayment(
      test.listPrice,
      test.downPayment,
      test.interestRate,
      test.balloonYears,
      test.totalYears
    );

    const loanAmount = test.listPrice - test.downPayment;
    const principalPaid = loanAmount - balloonPayment;
    const percentPaid = (principalPaid / loanAmount * 100).toFixed(2);

    console.log(`\n${test.name}:`);
    console.log(`  List Price: $${test.listPrice.toLocaleString()}`);
    console.log(`  Down Payment: $${test.downPayment.toLocaleString()}`);
    console.log(`  Loan Amount: $${loanAmount.toLocaleString()}`);
    console.log(`  Interest Rate: ${test.interestRate}%`);
    console.log(`  Balloon Years: ${test.balloonYears}`);
    console.log(`  Balloon Payment: $${balloonPayment.toLocaleString()}`);
    console.log(`  Principal Paid: $${principalPaid.toLocaleString()} (${percentPaid}%)`);
  });

  // Check database for properties with balloon data
  console.log('\n\n=== Checking Database Properties ===\n');

  const propertiesWithBalloon = await db.collection('properties')
    .where('balloonYears', '>', 0)
    .limit(5)
    .get();

  console.log(`Found ${propertiesWithBalloon.size} properties with balloon years\n`);

  if (propertiesWithBalloon.size > 0) {
    propertiesWithBalloon.forEach(doc => {
      const property = doc.data();
      console.log(`Property: ${property.address}`);
      console.log(`  City: ${property.city}, ${property.state}`);
      console.log(`  List Price: $${property.listPrice?.toLocaleString() || 'N/A'}`);
      console.log(`  Balloon Years: ${property.balloonYears} years`);
      console.log(`  Balloon Payment: $${property.balloonPayment?.toLocaleString() || 'Not calculated'}`);
      console.log('');
    });
  } else {
    console.log('No properties with balloon years found in database');
  }

  // Test nearby cities functionality
  console.log('\n=== Testing Nearby Cities Functionality ===\n');

  const propertiesWithCities = await db.collection('properties')
    .where('nearbyCities', '!=', null)
    .limit(3)
    .get();

  console.log(`Found ${propertiesWithCities.size} properties with nearby cities\n`);

  if (propertiesWithCities.size > 0) {
    propertiesWithCities.forEach(doc => {
      const property = doc.data();
      const cityCount = property.nearbyCities?.length || 0;
      console.log(`Property: ${property.address}`);
      console.log(`  Location: ${property.city}, ${property.state}`);
      console.log(`  Nearby Cities (${cityCount}): ${property.nearbyCities?.slice(0, 5).join(', ')}${cityCount > 5 ? '...' : ''}`);
      console.log('');
    });
  }

  await admin.app().delete();
}

// Run tests
testBalloonLogic().catch(console.error);