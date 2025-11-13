import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function checkTodaysProperties() {
  try {
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`\n📅 Checking properties added today (${today.toLocaleDateString()})`);
    console.log('='.repeat(80));

    // Query recent properties from GHL (no compound index needed)
    const propertiesSnapshot = await db.collection('properties')
      .where('source', '==', 'gohighlevel')
      .limit(200)
      .get();

    const todaysProperties = [];

    for (const doc of propertiesSnapshot.docs) {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date(data.dateAdded);

      if (createdAt >= today) {
        todaysProperties.push({
          id: doc.id,
          address: data.address,
          city: data.city,
          state: data.state,
          price: data.price,
          monthlyPayment: data.monthlyPayment,
          downPaymentAmount: data.downPaymentAmount,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
          status: data.status,
          isActive: data.isActive,
          createdAt: createdAt
        });
      }
    }

    // Sort by created date descending
    todaysProperties.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    console.log(`\n✅ Found ${todaysProperties.length} properties added today\n`);

    todaysProperties.forEach((prop, i) => {
      console.log(`${i + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
      console.log(`   ID: ${prop.id}`);
      console.log(`   Price: $${prop.price?.toLocaleString() || 'N/A'}`);
      console.log(`   Monthly: $${prop.monthlyPayment || 'N/A'} | Down: $${prop.downPaymentAmount?.toLocaleString() || 'N/A'}`);
      console.log(`   Beds/Baths: ${prop.bedrooms || 0}/${prop.bathrooms || 0}`);
      console.log(`   Status: ${prop.status} | Active: ${prop.isActive}`);
      console.log(`   Created: ${prop.createdAt.toLocaleString()}`);
      console.log('');
    });

    // Now check buyer profiles
    console.log('\n👥 Checking active buyer profiles');
    console.log('='.repeat(80));

    const buyersSnapshot = await db.collection('buyerProfiles')
      .where('isActive', '==', true)
      .get();

    console.log(`\n✅ Found ${buyersSnapshot.size} active buyers\n`);

    buyersSnapshot.docs.forEach((doc, i) => {
      const buyer = doc.data();
      const criteria = buyer.searchCriteria || {};
      const cities = criteria.cities || [buyer.preferredCity];

      console.log(`${i + 1}. ${buyer.firstName} ${buyer.lastName} (${buyer.phone})`);
      console.log(`   State: ${buyer.preferredState}`);
      console.log(`   Cities: ${cities.join(', ')}`);
      console.log(`   Max Monthly: $${criteria.maxMonthlyPayment || buyer.maxMonthlyPayment || 'N/A'}`);
      console.log(`   Max Down: $${criteria.maxDownPayment || buyer.maxDownPayment || 'N/A'}`);
      console.log(`   Min Beds: ${buyer.minBedrooms || 'any'} | Min Baths: ${buyer.minBathrooms || 'any'}`);
      console.log(`   Matched Properties: ${buyer.matchedPropertyIds?.length || 0}`);
      console.log('');
    });

    // Check for potential matches
    console.log('\n🔍 Analyzing potential matches for today\'s properties');
    console.log('='.repeat(80));

    for (const prop of todaysProperties) {
      console.log(`\nProperty: ${prop.address}, ${prop.city}, ${prop.state}`);
      console.log(`Price: $${prop.price?.toLocaleString()}, Monthly: $${prop.monthlyPayment}, Down: $${prop.downPaymentAmount?.toLocaleString()}`);

      const matches = [];

      for (const buyerDoc of buyersSnapshot.docs) {
        const buyer = buyerDoc.data();
        const criteria = buyer.searchCriteria || {};
        const buyerCities = criteria.cities || [buyer.preferredCity];

        // Check location match
        const locationMatch = buyer.preferredState === prop.state &&
          buyerCities.some((city: string) =>
            city.toLowerCase() === prop.city.toLowerCase()
          );

        if (!locationMatch) continue;

        // Check budget match (OR logic)
        const maxMonthly = criteria.maxMonthlyPayment || buyer.maxMonthlyPayment || 0;
        const maxDown = criteria.maxDownPayment || buyer.maxDownPayment || 0;
        const monthlyMatch = prop.monthlyPayment <= maxMonthly;
        const downMatch = prop.downPaymentAmount <= maxDown;
        const budgetMatch = monthlyMatch || downMatch;

        if (!budgetMatch) continue;

        // Check requirements
        const requirementsMatch =
          (!buyer.minBedrooms || prop.bedrooms >= buyer.minBedrooms) &&
          (!buyer.minBathrooms || prop.bathrooms >= buyer.minBathrooms);

        if (!requirementsMatch) continue;

        matches.push(`${buyer.firstName} ${buyer.lastName} (${buyer.phone})`);
      }

      if (matches.length > 0) {
        console.log(`   ✅ MATCHES: ${matches.join(', ')}`);
      } else {
        console.log(`   ❌ NO MATCHES`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTodaysProperties();
