#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function testMatching() {
  console.log('🔍 Testing property matching logic...\n');

  // Test cities
  const testCities = [
    { city: 'Dallas', state: 'TX' },
    { city: 'Atlanta', state: 'GA' },
    { city: 'Phoenix', state: 'AZ' }
  ];

  const snapshot = await db.collection('properties').get();
  const allProperties = [];
  snapshot.forEach(doc => {
    allProperties.push({ id: doc.id, ...doc.data() });
  });

  for (const test of testCities) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing: ${test.city}, ${test.state}`);
    console.log(`${'='.repeat(70)}`);

    // Direct matches
    const directMatches = allProperties.filter(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      return propertyCity?.toLowerCase() === test.city.toLowerCase() &&
             property.state === test.state;
    });

    console.log(`\n✅ DIRECT MATCHES: ${directMatches.length} properties IN ${test.city}`);
    if (directMatches.length > 0) {
      directMatches.slice(0, 3).forEach(p => {
        console.log(`   • ${p.address} - $${p.monthlyPayment}/mo`);
      });
    }

    // Nearby matches - OLD WAY (broken)
    const nearbyMatchesOld = allProperties.filter(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      if (propertyCity?.toLowerCase() === test.city.toLowerCase()) return false;
      if (property.state !== test.state) return false;

      // OLD BROKEN CODE - trying to compare object to string
      const considersNearby = property.nearbyCities &&
        Array.isArray(property.nearbyCities) &&
        property.nearbyCities.some(nearbyCity =>
          nearbyCity.toLowerCase && nearbyCity.toLowerCase() === test.city.toLowerCase()
        );

      return considersNearby;
    });

    console.log(`\n❌ NEARBY (OLD BROKEN): ${nearbyMatchesOld.length} properties`);

    // Nearby matches - NEW WAY (fixed)
    const nearbyMatchesNew = allProperties.filter(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      if (propertyCity?.toLowerCase() === test.city.toLowerCase()) return false;
      if (property.state !== test.state) return false;

      // NEW FIXED CODE - handles object structure
      const considersNearby = property.nearbyCities &&
        Array.isArray(property.nearbyCities) &&
        property.nearbyCities.some(nearbyCity => {
          const cityName = typeof nearbyCity === 'string' ? nearbyCity : nearbyCity.name;
          return cityName && cityName.toLowerCase() === test.city.toLowerCase();
        });

      return considersNearby;
    });

    console.log(`\n✅ NEARBY (FIXED): ${nearbyMatchesNew.length} properties near ${test.city}`);
    if (nearbyMatchesNew.length > 0) {
      nearbyMatchesNew.slice(0, 3).forEach(p => {
        const fromCity = p.city?.split(',')[0].trim();
        console.log(`   • ${p.address} (from ${fromCity}) - $${p.monthlyPayment}/mo`);
      });
    }

    // Show what's in nearbyCities for a sample property
    if (directMatches.length > 0 && directMatches[0].nearbyCities) {
      console.log(`\n📍 Sample nearbyCities structure from ${test.city}:`);
      const sample = directMatches[0].nearbyCities.slice(0, 3);
      console.log(`   Type: ${typeof sample[0]}`);
      if (typeof sample[0] === 'object') {
        console.log(`   First 3 nearby:`, sample.map(n => n.name).join(', '));
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY:');
  console.log(`${'='.repeat(70)}`);
  console.log('The fix changes how we check the nearbyCities array:');
  console.log('❌ OLD: Expected string array, failed with object array');
  console.log('✅ NEW: Handles both string and object {name, lat, lng} formats');
  console.log('\nThis allows properties from nearby cities to appear in search results!');
}

testMatching()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });