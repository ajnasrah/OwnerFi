const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin SDK
const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = admin.firestore();

async function findPropertyByDetails() {
  console.log('========================================');
  console.log('SEARCHING FOR PROPERTY WITH PRICE 169000');
  console.log('========================================\n');

  try {
    // Search for properties with price 169000
    const snapshot = await db.collection('properties')
      .where('price', '==', 169000)
      .get();

    if (snapshot.empty) {
      // Try with listPrice field
      const snapshot2 = await db.collection('properties')
        .where('listPrice', '==', 169000)
        .get();

      if (snapshot2.empty) {
        console.log('❌ No properties found with price 169000');

        // Let's check all properties with interest rate 6.75
        console.log('\nSearching for properties with interest rate 6.75%...\n');

        const allProps = await db.collection('properties').get();
        const propsWithRate = [];

        allProps.forEach(doc => {
          const data = doc.data();
          if (data.interestRate === 6.75) {
            propsWithRate.push({
              id: doc.id,
              price: data.price || data.listPrice,
              address: data.address,
              interestRate: data.interestRate,
              monthlyPayment: data.monthlyPayment,
              downPaymentPercent: data.downPaymentPercent
            });
          }
        });

        if (propsWithRate.length > 0) {
          console.log(`Found ${propsWithRate.length} properties with 6.75% interest rate:`);
          propsWithRate.forEach(prop => {
            console.log(`\n  ID: ${prop.id}`);
            console.log(`  Price: $${prop.price}`);
            console.log(`  Address: ${prop.address}`);
            console.log(`  Interest Rate: ${prop.interestRate}%`);
            console.log(`  Monthly Payment: $${prop.monthlyPayment}`);
            console.log(`  Down Payment: ${prop.downPaymentPercent}%`);
          });
        } else {
          console.log('No properties found with 6.75% interest rate');
        }
      } else {
        processSnapshot(snapshot2);
      }
    } else {
      processSnapshot(snapshot);
    }

    // Also check the image URL to find the exact property
    console.log('\n========================================');
    console.log('SEARCHING BY IMAGE URL');
    console.log('========================================\n');

    const imageUrl = 'https://photos.zillowstatic.com/fp/5983b351639c610b562dff0b83d09a1d-cc_ft_1536.webp';
    const allProperties = await db.collection('properties').get();

    let foundByImage = false;
    allProperties.forEach(doc => {
      const data = doc.data();
      if (data.imageUrls && Array.isArray(data.imageUrls)) {
        if (data.imageUrls.some(url => url.includes('5983b351639c610b562dff0b83d09a1d'))) {
          foundByImage = true;
          console.log('✅ FOUND PROPERTY BY IMAGE URL:');
          console.log(`  ID: ${doc.id}`);
          console.log(`  Price: $${data.price || data.listPrice}`);
          console.log(`  Address: ${data.address}`);
          console.log(`  Interest Rate: ${data.interestRate || 'NOT SET'}`);
          console.log(`  Monthly Payment: $${data.monthlyPayment || 'NOT SET'}`);
          console.log(`  Down Payment: ${data.downPaymentPercent || data.downPayment || 'NOT SET'}%`);
          console.log(`  Opportunity ID: ${data.opportunityId || 'NOT SET'}`);

          console.log('\n  Full Financial Data:');
          console.log(`    interestRate: ${data.interestRate}`);
          console.log(`    monthlyPayment: ${data.monthlyPayment}`);
          console.log(`    downPaymentAmount: ${data.downPaymentAmount}`);
          console.log(`    downPaymentPercent: ${data.downPaymentPercent}`);
          console.log(`    downPayment: ${data.downPayment}`);
          console.log(`    termYears: ${data.termYears}`);
          console.log(`    balloonYears: ${data.balloonYears}`);
          console.log(`    balloonPayment: ${data.balloonPayment}`);
        }
      }
    });

    if (!foundByImage) {
      console.log('❌ Property not found by image URL');
    }

  } catch (error) {
    console.error('Error searching for property:', error);
  }
}

function processSnapshot(snapshot) {
  console.log(`Found ${snapshot.size} properties with price 169000:\n`);

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log('========================================');
    console.log(`Property ID: ${doc.id}`);
    console.log('========================================');
    console.log(`Address: ${data.address}`);
    console.log(`City: ${data.city}, ${data.state}`);
    console.log(`Price: $${data.price || data.listPrice}`);
    console.log(`Interest Rate: ${data.interestRate || 'NOT SET'}%`);
    console.log(`Monthly Payment: $${data.monthlyPayment || 'NOT SET'}`);
    console.log(`Down Payment: ${data.downPaymentPercent || data.downPayment || 'NOT SET'}%`);
    console.log(`Opportunity ID: ${data.opportunityId || 'NOT SET'}`);

    console.log('\nAll Financial Fields:');
    console.log(`  interestRate: ${data.interestRate}`);
    console.log(`  monthlyPayment: ${data.monthlyPayment}`);
    console.log(`  downPaymentAmount: ${data.downPaymentAmount}`);
    console.log(`  downPaymentPercent: ${data.downPaymentPercent}`);
    console.log(`  downPayment: ${data.downPayment}`);
    console.log(`  termYears: ${data.termYears}`);
    console.log(`  balloonYears: ${data.balloonYears}`);
    console.log(`  balloonPayment: ${data.balloonPayment}`);

    if (data.imageUrls && data.imageUrls.length > 0) {
      console.log(`\nImage URL: ${data.imageUrls[0]}`);
    }
    console.log('\n');
  });
}

// Run the search
findPropertyByDetails()
  .then(() => {
    console.log('\nSearch completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Search failed:', error);
    process.exit(1);
  });