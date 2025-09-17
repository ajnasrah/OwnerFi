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

async function checkNearbyCities() {
  console.log('🔍 Checking nearbyCities field in properties...\n');

  const snapshot = await db.collection('properties').get();

  let stats = {
    total: 0,
    withNearbyCities: 0,
    emptyNearbyCities: 0,
    nullNearbyCities: 0,
    citiesCount: {}
  };

  snapshot.forEach(doc => {
    const data = doc.data();
    stats.total++;

    if (data.nearbyCities === undefined || data.nearbyCities === null) {
      stats.nullNearbyCities++;
    } else if (Array.isArray(data.nearbyCities) && data.nearbyCities.length > 0) {
      stats.withNearbyCities++;

      // Count by city
      const city = data.city?.split(',')[0].trim() || 'Unknown';
      if (!stats.citiesCount[city]) {
        stats.citiesCount[city] = { total: 0, withNearby: 0, examples: [] };
      }
      stats.citiesCount[city].total++;
      stats.citiesCount[city].withNearby++;

      if (stats.citiesCount[city].examples.length < 2) {
        stats.citiesCount[city].examples.push({
          address: data.address,
          nearbyCities: data.nearbyCities.slice(0, 3) // Show first 3 nearby cities
        });
      }
    } else if (Array.isArray(data.nearbyCities) && data.nearbyCities.length === 0) {
      stats.emptyNearbyCities++;
    }

    // Also count properties without nearby cities by city
    if (!data.nearbyCities || (Array.isArray(data.nearbyCities) && data.nearbyCities.length === 0)) {
      const city = data.city?.split(',')[0].trim() || 'Unknown';
      if (!stats.citiesCount[city]) {
        stats.citiesCount[city] = { total: 0, withNearby: 0, examples: [] };
      }
      stats.citiesCount[city].total++;
    }
  });

  console.log('='.repeat(70));
  console.log('📊 NEARBY CITIES SUMMARY:');
  console.log('='.repeat(70));
  console.log(`Total properties: ${stats.total}`);
  console.log(`With nearby cities: ${stats.withNearbyCities} (${(stats.withNearbyCities/stats.total*100).toFixed(1)}%)`);
  console.log(`Empty nearby cities array: ${stats.emptyNearbyCities} (${(stats.emptyNearbyCities/stats.total*100).toFixed(1)}%)`);
  console.log(`No nearby cities field: ${stats.nullNearbyCities} (${(stats.nullNearbyCities/stats.total*100).toFixed(1)}%)`);

  console.log('\n📍 BREAKDOWN BY CITY:');
  console.log('-'.repeat(70));

  // Sort cities by total properties
  const sortedCities = Object.entries(stats.citiesCount)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10); // Show top 10 cities

  sortedCities.forEach(([city, data]) => {
    const percentage = (data.withNearby / data.total * 100).toFixed(1);
    console.log(`\n${city}: ${data.total} properties (${data.withNearby} with nearby = ${percentage}%)`);

    if (data.examples.length > 0) {
      console.log('  Examples with nearby cities:');
      data.examples.forEach(ex => {
        console.log(`    • ${ex.address}`);
        console.log(`      Nearby: ${ex.nearbyCities.join(', ')}`);
      });
    }
  });

  console.log('\n' + '='.repeat(70));

  if (stats.withNearbyCities === 0) {
    console.log('⚠️  WARNING: No properties have nearby cities configured!');
    console.log('   This will prevent the "nearby properties" matching from working.');
  } else if (stats.withNearbyCities < stats.total * 0.5) {
    console.log('⚠️  WARNING: Less than 50% of properties have nearby cities configured!');
    console.log('   Many properties won\'t appear in nearby searches.');
  }
}

checkNearbyCities()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });