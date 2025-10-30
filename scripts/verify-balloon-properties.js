// Verify all properties with balloon payment have proper balloonYears setup
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

async function verifyBalloonProperties() {
  console.log('=== BALLOON PROPERTY VERIFICATION ===\n');

  const results = {
    total: 0,
    withBalloonPayment: 0,
    withBalloonYears: 0,
    withBoth: 0,
    withPaymentOnly: 0,
    withYearsOnly: 0,
    missingBoth: 0,
    properties: []
  };

  try {
    // Query 1: Properties with balloonPayment
    console.log('📊 Querying properties with balloonPayment...');
    const withPaymentSnapshot = await db.collection('properties')
      .where('balloonPayment', '>', 0)
      .get();

    console.log(`Found ${withPaymentSnapshot.size} properties with balloonPayment > 0\n`);

    // Query 2: Properties with balloonYears
    console.log('📊 Querying properties with balloonYears...');
    const withYearsSnapshot = await db.collection('properties')
      .where('balloonYears', '>', 0)
      .get();

    console.log(`Found ${withYearsSnapshot.size} properties with balloonYears > 0\n`);

    // Combine all properties
    const allBalloonPropertyIds = new Set();
    withPaymentSnapshot.forEach(doc => allBalloonPropertyIds.add(doc.id));
    withYearsSnapshot.forEach(doc => allBalloonPropertyIds.add(doc.id));

    console.log(`📋 Total unique properties with balloon data: ${allBalloonPropertyIds.size}\n`);
    console.log('='.repeat(80));
    console.log('\n');

    // Analyze each property
    for (const propertyId of allBalloonPropertyIds) {
      const doc = await db.collection('properties').doc(propertyId).get();
      const data = doc.data();

      if (!data) continue;

      results.total++;

      const hasBalloonPayment = data.balloonPayment && data.balloonPayment > 0;
      const hasBalloonYears = data.balloonYears && data.balloonYears > 0;

      if (hasBalloonPayment) results.withBalloonPayment++;
      if (hasBalloonYears) results.withBalloonYears++;

      if (hasBalloonPayment && hasBalloonYears) {
        results.withBoth++;
      } else if (hasBalloonPayment && !hasBalloonYears) {
        results.withPaymentOnly++;
      } else if (!hasBalloonPayment && hasBalloonYears) {
        results.withYearsOnly++;
      }

      const propertyInfo = {
        id: propertyId,
        address: data.address || 'N/A',
        city: data.city || 'N/A',
        state: data.state || 'N/A',
        listPrice: data.listPrice || 0,
        balloonPayment: data.balloonPayment || null,
        balloonYears: data.balloonYears || null,
        status: data.status || 'unknown',
        isActive: data.isActive !== false,
        source: data.source || 'unknown'
      };

      results.properties.push(propertyInfo);

      // Print individual property details
      const paymentDisplay = propertyInfo.balloonPayment ? '$' + propertyInfo.balloonPayment.toLocaleString() : 'NULL';
      const yearsDisplay = propertyInfo.balloonYears || 'NULL';

      console.log(`Property ${results.total}:`);
      console.log(`  ID: ${propertyId}`);
      console.log(`  Address: ${propertyInfo.address}`);
      console.log(`  City: ${propertyInfo.city}, ${propertyInfo.state}`);
      console.log(`  List Price: $${propertyInfo.listPrice.toLocaleString()}`);
      console.log(`  Balloon Payment: ${paymentDisplay}`);
      console.log(`  Balloon Years: ${yearsDisplay}`);
      console.log(`  Status: ${propertyInfo.status} (Active: ${propertyInfo.isActive})`);
      console.log(`  Source: ${propertyInfo.source}`);

      // Flag issues
      if (!hasBalloonYears) {
        console.log(`  ⚠️  WARNING: Missing balloonYears!`);
      }
      if (!hasBalloonPayment && hasBalloonYears) {
        console.log(`  ✅ OK: Has years, no calculated payment (expected after update)`);
      }
      if (hasBalloonPayment && hasBalloonYears) {
        console.log(`  ℹ️  INFO: Has both (old property, works fine)`);
      }

      console.log('');
    }

    // Print Summary
    console.log('='.repeat(80));
    console.log('\n📊 VERIFICATION SUMMARY\n');
    console.log('='.repeat(80));
    console.log(`Total Properties with Balloon Data: ${results.total}`);
    console.log(`  - With balloonPayment: ${results.withBalloonPayment}`);
    console.log(`  - With balloonYears: ${results.withBalloonYears}`);
    console.log(`  - With both fields: ${results.withBoth}`);
    console.log(`  - With payment only: ${results.withPaymentOnly} ${results.withPaymentOnly > 0 ? '⚠️' : ''}`);
    console.log(`  - With years only: ${results.withYearsOnly} ✅`);
    console.log('');

    if (results.withPaymentOnly > 0) {
      console.log('⚠️  ACTION REQUIRED:');
      console.log(`   ${results.withPaymentOnly} properties have balloonPayment but missing balloonYears!`);
      console.log('   These properties need balloonYears added.\n');
    } else {
      console.log('✅ ALL PROPERTIES PROPERLY CONFIGURED\n');
    }

    // Active properties breakdown
    const activeProperties = results.properties.filter(p => p.isActive);
    const activeWithYears = activeProperties.filter(p => p.balloonYears && p.balloonYears > 0);
    const activeMissingYears = activeProperties.filter(p => (!p.balloonYears || p.balloonYears === 0) && p.balloonPayment > 0);

    console.log('📍 ACTIVE PROPERTIES ONLY:');
    console.log(`  Total Active with Balloon: ${activeProperties.length}`);
    console.log(`  Active with balloonYears: ${activeWithYears.length} ✅`);
    console.log(`  Active missing balloonYears: ${activeMissingYears.length} ${activeMissingYears.length > 0 ? '⚠️' : ''}`);
    console.log('');

    if (activeMissingYears.length > 0) {
      console.log('⚠️  ACTIVE PROPERTIES MISSING BALLOON YEARS:');
      activeMissingYears.forEach(p => {
        console.log(`   - ${p.address}, ${p.city} (ID: ${p.id})`);
      });
      console.log('');
    }

    // Distribution of balloon years
    const yearsCounts = {};
    results.properties
      .filter(p => p.balloonYears && p.balloonYears > 0)
      .forEach(p => {
        const years = p.balloonYears;
        yearsCounts[years] = (yearsCounts[years] || 0) + 1;
      });

    if (Object.keys(yearsCounts).length > 0) {
      console.log('📊 BALLOON YEARS DISTRIBUTION:');
      Object.keys(yearsCounts)
        .sort((a, b) => Number(a) - Number(b))
        .forEach(years => {
          console.log(`   ${years} years: ${yearsCounts[years]} properties`);
        });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await admin.app().delete();
  }

  return results;
}

// Run verification
verifyBalloonProperties().catch(console.error);
