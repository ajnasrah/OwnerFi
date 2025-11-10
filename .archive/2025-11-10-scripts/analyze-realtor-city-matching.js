// Comprehensive analysis of realtor city matching logic
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

async function analyzeRealtorCityMatching() {
  try {
    console.log('=== COMPREHENSIVE REALTOR-BUYER CITY MATCHING ANALYSIS ===\n');

    // 1. Get all realtors and their service cities
    console.log('STEP 1: ANALYZING REALTOR SERVICE CITIES\n');
    const realtorsSnapshot = await db.collection('users')
      .where('role', '==', 'realtor')
      .get();

    console.log(`Total realtors in system: ${realtorsSnapshot.size}\n`);

    const realtorServiceAreas = [];
    realtorsSnapshot.forEach(doc => {
      const realtor = doc.data();
      const realtorInfo = {
        id: doc.id,
        name: `${realtor.realtorData?.firstName || ''} ${realtor.realtorData?.lastName || ''}`,
        email: realtor.email,
        primaryCity: null,
        nearbyCities: [],
        allServiceCities: [],
        serviceCitiesField: realtor.realtorData?.serviceCities || []
      };

      // Check different possible fields for cities
      if (realtor.realtorData?.serviceArea) {
        const serviceArea = realtor.realtorData.serviceArea;

        // Primary city
        if (serviceArea.primaryCity) {
          if (typeof serviceArea.primaryCity === 'object') {
            realtorInfo.primaryCity = serviceArea.primaryCity.name;
          } else {
            realtorInfo.primaryCity = serviceArea.primaryCity;
          }
        }

        // Nearby cities
        if (serviceArea.nearbyCities && Array.isArray(serviceArea.nearbyCities)) {
          realtorInfo.nearbyCities = serviceArea.nearbyCities.map(city => {
            if (typeof city === 'object') {
              return city.name || 'Unknown';
            }
            return city;
          });
        }
      }

      // Combine all cities this realtor serves
      if (realtorInfo.primaryCity) {
        realtorInfo.allServiceCities.push(realtorInfo.primaryCity);
      }
      realtorInfo.allServiceCities.push(...realtorInfo.nearbyCities);
      realtorInfo.allServiceCities.push(...realtorInfo.serviceCitiesField);

      // Remove duplicates and clean up
      realtorInfo.allServiceCities = [...new Set(realtorInfo.allServiceCities)]
        .filter(city => city && city !== 'Unknown')
        .map(city => city.toLowerCase().trim());

      realtorServiceAreas.push(realtorInfo);
    });

    // Display realtor service areas
    console.log('REALTOR SERVICE AREAS:');
    realtorServiceAreas.forEach(realtor => {
      console.log(`\n${realtor.name} (${realtor.email}):`);
      console.log(`  Primary City: ${realtor.primaryCity || 'Not set'}`);
      console.log(`  Nearby Cities: ${realtor.nearbyCities.length > 0 ? realtor.nearbyCities.join(', ') : 'None'}`);
      console.log(`  Service Cities Field: ${realtor.serviceCitiesField.length > 0 ? realtor.serviceCitiesField.join(', ') : 'None'}`);
      console.log(`  ALL CITIES SERVED: ${realtor.allServiceCities.join(', ') || 'None'}`);
      console.log(`  Total Cities Served: ${realtor.allServiceCities.length}`);
    });

    // 2. Get all buyer profiles and their cities
    console.log('\n\nSTEP 2: ANALYZING BUYER LOCATIONS\n');
    const buyersSnapshot = await db.collection('buyerProfiles').get();
    console.log(`Total buyer profiles: ${buyersSnapshot.size}`);

    const buyersByCity = {};
    const availableBuyersByCity = {};
    const allBuyers = [];

    buyersSnapshot.forEach(doc => {
      const buyer = { id: doc.id, ...doc.data() };
      allBuyers.push(buyer);

      // Get buyer's city (check multiple fields)
      const buyerCity = (buyer.preferredCity || buyer.city || 'Unknown').toLowerCase().trim();

      // Count all buyers by city
      if (!buyersByCity[buyerCity]) {
        buyersByCity[buyerCity] = [];
      }
      buyersByCity[buyerCity].push(buyer);

      // Count available buyers by city
      if (buyer.isAvailableForPurchase && buyer.isActive && buyer.profileComplete) {
        if (!availableBuyersByCity[buyerCity]) {
          availableBuyersByCity[buyerCity] = [];
        }
        availableBuyersByCity[buyerCity].push(buyer);
      }
    });

    console.log('\nBUYERS BY CITY:');
    Object.keys(buyersByCity).sort().forEach(city => {
      const total = buyersByCity[city].length;
      const available = availableBuyersByCity[city]?.length || 0;
      console.log(`  ${city}: ${total} total, ${available} available`);
    });

    // 3. Analyze matching for a specific realtor (find one serving Dallas)
    console.log('\n\nSTEP 3: ANALYZING DALLAS REALTOR MATCHING\n');

    const dallasRealtor = realtorServiceAreas.find(r =>
      r.allServiceCities.includes('dallas')
    );

    if (dallasRealtor) {
      console.log(`Analyzing realtor: ${dallasRealtor.name}`);
      console.log(`Cities served: ${dallasRealtor.allServiceCities.join(', ')}`);

      // Calculate how many buyers should match
      let totalPotentialLeads = 0;
      let totalAvailableLeads = 0;
      const matchedBuyers = [];

      dallasRealtor.allServiceCities.forEach(city => {
        const cityBuyers = buyersByCity[city] || [];
        const availableCityBuyers = availableBuyersByCity[city] || [];

        console.log(`\n  ${city}:`);
        console.log(`    - Total buyers: ${cityBuyers.length}`);
        console.log(`    - Available buyers: ${availableCityBuyers.length}`);

        totalPotentialLeads += cityBuyers.length;
        totalAvailableLeads += availableCityBuyers.length;

        availableCityBuyers.forEach(buyer => {
          matchedBuyers.push({
            ...buyer,
            matchedCity: city
          });
        });
      });

      console.log(`\n  TOTAL POTENTIAL LEADS: ${totalPotentialLeads}`);
      console.log(`  TOTAL AVAILABLE LEADS: ${totalAvailableLeads}`);
      console.log(`  (Should see ${totalAvailableLeads} leads in dashboard)\n`);

      // List all matched buyers
      console.log('  MATCHED BUYERS:');
      matchedBuyers.forEach((buyer, index) => {
        console.log(`    ${index + 1}. ${buyer.firstName} ${buyer.lastName} - ${buyer.matchedCity}`);
      });
    } else {
      console.log('No realtor found serving Dallas');
    }

    // 4. Check the actual query logic being used
    console.log('\n\nSTEP 4: TESTING ACTUAL QUERY LOGIC\n');

    // This is what the app is doing (filtering by state first)
    const txBuyers = await db.collection('buyerProfiles')
      .where('preferredState', '==', 'TX')
      .where('isAvailableForPurchase', '==', true)
      .where('isActive', '==', true)
      .where('profileComplete', '==', true)
      .get();

    console.log(`Query by state (TX) returns: ${txBuyers.size} buyers`);

    // Count by city
    const txCities = {};
    txBuyers.forEach(doc => {
      const buyer = doc.data();
      const city = (buyer.preferredCity || buyer.city || 'Unknown').toLowerCase();
      if (!txCities[city]) {
        txCities[city] = 0;
      }
      txCities[city]++;
    });

    console.log('TX buyers by city from query:');
    Object.keys(txCities).forEach(city => {
      console.log(`  ${city}: ${txCities[city]}`);
    });

    // 5. Identify the problem
    console.log('\n\nSTEP 5: PROBLEM IDENTIFICATION\n');
    console.log('ISSUES FOUND:');
    console.log('1. The query filters by STATE first (preferredState == TX)');
    console.log('2. This misses buyers who have city set but not preferredState');
    console.log('3. The city matching happens AFTER the state query');
    console.log('4. Realtors serve CITIES not states - a realtor might serve cities across state borders');
    console.log('5. Some buyers have "state" field instead of "preferredState" field');

    // Check for field inconsistencies
    console.log('\nFIELD INCONSISTENCIES:');
    let missingPreferredState = 0;
    let hasStateButNotPreferred = 0;

    allBuyers.forEach(buyer => {
      if (!buyer.preferredState) {
        missingPreferredState++;
        if (buyer.state) {
          hasStateButNotPreferred++;
        }
      }
    });

    console.log(`  Buyers missing preferredState: ${missingPreferredState}`);
    console.log(`  Buyers with 'state' but not 'preferredState': ${hasStateButNotPreferred}`);

    console.log('\n\nRECOMMENDED FIX:');
    console.log('1. Query buyers by city names directly (no state filter)');
    console.log('2. Use Firestore "in" operator to query multiple cities at once');
    console.log('3. Or query all available buyers and filter by city in memory');
    console.log('4. Standardize all buyer profiles to use consistent field names');

  } catch (error) {
    console.error('Error analyzing city matching:', error);
  } finally {
    await admin.app().delete();
  }
}

// Run the analysis
analyzeRealtorCityMatching();