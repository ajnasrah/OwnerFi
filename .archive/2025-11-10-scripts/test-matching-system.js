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

async function testMatchingSystem() {
  console.log('🔬 COMPREHENSIVE MATCHING SYSTEM TEST\n');
  console.log('='.repeat(70));

  // Test scenarios with different budgets and cities
  const testScenarios = [
    {
      name: 'High Budget Dallas Buyer',
      city: 'Dallas',
      state: 'TX',
      maxMonthly: 5000,
      maxDown: 100000
    },
    {
      name: 'Medium Budget Atlanta Buyer',
      city: 'Atlanta',
      state: 'GA',
      maxMonthly: 3000,
      maxDown: 50000
    },
    {
      name: 'Low Budget Phoenix Buyer',
      city: 'Phoenix',
      state: 'AZ',
      maxMonthly: 2000,
      maxDown: 20000
    },
    {
      name: 'Ultra High Budget San Antonio Buyer',
      city: 'San Antonio',
      state: 'TX',
      maxMonthly: 10000,
      maxDown: 200000
    }
  ];

  // Get all properties
  const snapshot = await db.collection('properties').get();
  const allProperties = [];
  snapshot.forEach(doc => {
    allProperties.push({ id: doc.id, ...doc.data() });
  });

  console.log(`Total properties in database: ${allProperties.length}\n`);

  for (const scenario of testScenarios) {
    console.log('\n' + '='.repeat(70));
    console.log(`📍 ${scenario.name}`);
    console.log(`   Location: ${scenario.city}, ${scenario.state}`);
    console.log(`   Budget: $${scenario.maxMonthly}/mo, $${scenario.maxDown} down`);
    console.log('='.repeat(70));

    // 1. DIRECT MATCHES - Properties in the exact city
    const directMatches = allProperties.filter(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      const meetsbudget = property.monthlyPayment <= scenario.maxMonthly &&
                         property.downPaymentAmount <= scenario.maxDown;

      return propertyCity?.toLowerCase() === scenario.city.toLowerCase() &&
             property.state === scenario.state &&
             property.isActive !== false &&
             meetsbudget;
    });

    console.log(`\n✅ DIRECT MATCHES: ${directMatches.length} properties`);
    if (directMatches.length > 0) {
      console.log('   Examples:');
      directMatches.slice(0, 3).forEach(p => {
        console.log(`   • ${p.address}`);
        console.log(`     💰 $${p.monthlyPayment}/mo, $${p.downPaymentAmount} down`);
      });
    }

    // 2. NEARBY MATCHES - Properties that consider this city nearby
    const nearbyMatches = allProperties.filter(property => {
      const propertyCity = property.city?.split(',')[0].trim();

      // Skip if it's the same city or different state
      if (propertyCity?.toLowerCase() === scenario.city.toLowerCase()) return false;
      if (property.state !== scenario.state) return false;

      // Check if property considers the search city nearby
      const considersNearby = property.nearbyCities &&
        Array.isArray(property.nearbyCities) &&
        property.nearbyCities.some(nearbyCity => {
          const cityName = typeof nearbyCity === 'string' ? nearbyCity : nearbyCity.name;
          return cityName && cityName.toLowerCase() === scenario.city.toLowerCase();
        });

      const meetsbudget = property.monthlyPayment <= scenario.maxMonthly &&
                         property.downPaymentAmount <= scenario.maxDown;

      return considersNearby &&
             property.isActive !== false &&
             meetsbudget;
    });

    console.log(`\n🏘️ NEARBY MATCHES: ${nearbyMatches.length} properties`);
    if (nearbyMatches.length > 0) {
      console.log('   Examples:');
      nearbyMatches.slice(0, 3).forEach(p => {
        const fromCity = p.city?.split(',')[0].trim();
        console.log(`   • ${p.address} (from ${fromCity})`);
        console.log(`     💰 $${p.monthlyPayment}/mo, $${p.downPaymentAmount} down`);
      });
    }

    // 3. BUDGET ANALYSIS
    const allInCityAndNearby = allProperties.filter(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      const isInCity = propertyCity?.toLowerCase() === scenario.city.toLowerCase() &&
                       property.state === scenario.state;

      const considersNearby = property.nearbyCities &&
        Array.isArray(property.nearbyCities) &&
        property.nearbyCities.some(nearbyCity => {
          const cityName = typeof nearbyCity === 'string' ? nearbyCity : nearbyCity.name;
          return cityName && cityName.toLowerCase() === scenario.city.toLowerCase();
        });

      return (isInCity || (considersNearby && property.state === scenario.state)) &&
             property.isActive !== false;
    });

    const overBudget = allInCityAndNearby.filter(p =>
      p.monthlyPayment > scenario.maxMonthly || p.downPaymentAmount > scenario.maxDown
    );

    console.log(`\n📊 BUDGET ANALYSIS:`);
    console.log(`   Total available in area: ${allInCityAndNearby.length}`);
    console.log(`   Within budget: ${directMatches.length + nearbyMatches.length}`);
    console.log(`   Over budget: ${overBudget.length}`);

    if (overBudget.length > 0) {
      const lowestMonthly = Math.min(...overBudget.map(p => p.monthlyPayment || Infinity));
      const lowestDown = Math.min(...overBudget.map(p => p.downPaymentAmount || Infinity));
      console.log(`   Cheapest over-budget: $${lowestMonthly}/mo, $${lowestDown} down`);
    }

    // 4. TOTAL MATCHES
    const totalMatches = directMatches.length + nearbyMatches.length;
    console.log(`\n🎯 TOTAL MATCHES: ${totalMatches} properties`);

    if (totalMatches === 0) {
      console.log('   ⚠️ NO MATCHES FOUND!');
      if (allInCityAndNearby.length > 0) {
        console.log('   💡 Suggestion: Increase budget or expand search radius');
      } else {
        console.log('   💡 Suggestion: No properties in this area');
      }
    }
  }

  // SYSTEM-WIDE STATISTICS
  console.log('\n\n' + '='.repeat(70));
  console.log('📈 SYSTEM-WIDE MATCHING STATISTICS');
  console.log('='.repeat(70));

  // Check how many properties have nearbyCities configured
  const withNearbyCities = allProperties.filter(p =>
    p.nearbyCities && Array.isArray(p.nearbyCities) && p.nearbyCities.length > 0
  );

  console.log(`\nNearbyCities Configuration:`);
  console.log(`   ${withNearbyCities.length}/${allProperties.length} properties have nearby cities`);
  console.log(`   ${((withNearbyCities.length/allProperties.length)*100).toFixed(1)}% coverage`);

  // Check property distribution by state
  const stateCount = {};
  allProperties.forEach(p => {
    stateCount[p.state] = (stateCount[p.state] || 0) + 1;
  });

  console.log(`\nProperty Distribution by State:`);
  Object.entries(stateCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([state, count]) => {
      console.log(`   ${state}: ${count} properties`);
    });

  // Check average monthly payments
  const validPayments = allProperties
    .filter(p => p.monthlyPayment && p.monthlyPayment > 0)
    .map(p => p.monthlyPayment);

  if (validPayments.length > 0) {
    const avgPayment = Math.round(validPayments.reduce((a, b) => a + b, 0) / validPayments.length);
    const minPayment = Math.min(...validPayments);
    const maxPayment = Math.max(...validPayments);

    console.log(`\nMonthly Payment Range:`);
    console.log(`   Min: $${minPayment}`);
    console.log(`   Avg: $${avgPayment}`);
    console.log(`   Max: $${maxPayment}`);
  }

  console.log('\n✅ MATCHING SYSTEM TEST COMPLETE');
}

testMatchingSystem()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });