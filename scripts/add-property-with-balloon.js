// Script to add a property with balloon payment calculation
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

// Helper to find nearby cities
const { findCitiesWithinRadius } = require('./nearby-cities-helper');

async function addPropertyWithBalloon() {
  try {
    // Property data from the screenshot
    const propertyData = {
      listPrice: 247400,
      monthlyPayment: 1789,
      downPaymentAmount: 37110,
      downPaymentPercent: 15,
      interestRate: 8,
      balloonYears: 5, // Assuming 5 year balloon

      // Calculate other fields based on the data
      address: 'Property Address TBD', // Will need actual address
      city: 'Memphis',
      state: 'TN',
      zipCode: '38116',
      opportunityName: 'Memphis Investment Property',
      propertyImageUrl: 'https://photos.zillowstatic.com/fp/f18e215b5a216bdae95b17fe383b8359-cc_ft_1536.webp',
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Calculate balloon payment
    const loanAmount = propertyData.listPrice - propertyData.downPaymentAmount;
    const monthlyRate = propertyData.interestRate / 100 / 12;
    const totalTermMonths = 20 * 12; // Assuming 20 year amortization
    const balloonMonths = propertyData.balloonYears * 12;

    let balloonPaymentAmount = 0;
    if (monthlyRate > 0 && balloonMonths > 0) {
      // Calculate principal paid during balloon period
      const principalPaid = loanAmount *
        (Math.pow(1 + monthlyRate, balloonMonths) - 1) /
        (Math.pow(1 + monthlyRate, totalTermMonths) - 1);

      balloonPaymentAmount = Math.round(loanAmount - principalPaid);
    }

    propertyData.balloonPayment = balloonPaymentAmount;

    // Find nearby cities
    try {
      const nearbyCities = await findCitiesWithinRadius(
        propertyData.city,
        propertyData.state,
        30 // 30 mile radius
      );

      if (nearbyCities && nearbyCities.length > 0) {
        propertyData.nearbyCities = nearbyCities.map(city => city.name);
        propertyData.nearbyCitiesSource = 'comprehensive-database';
      }
    } catch (error) {
      console.log('Could not find nearby cities:', error.message);
    }

    // Add to database
    const docRef = await db.collection('properties').add(propertyData);

    console.log('Successfully added property with ID:', docRef.id);
    console.log('Property details:');
    console.log('- List Price: $' + propertyData.listPrice.toLocaleString());
    console.log('- Monthly Payment: $' + propertyData.monthlyPayment.toLocaleString());
    console.log('- Down Payment: $' + propertyData.downPaymentAmount.toLocaleString() + ' (' + propertyData.downPaymentPercent + '%)');
    console.log('- Interest Rate: ' + propertyData.interestRate + '%');
    console.log('- Balloon Years: ' + propertyData.balloonYears);
    console.log('- Balloon Payment: $' + balloonPaymentAmount.toLocaleString());
    console.log('- Nearby Cities: ' + (propertyData.nearbyCities ? propertyData.nearbyCities.join(', ') : 'None'));

  } catch (error) {
    console.error('Error adding property:', error);
  } finally {
    await admin.app().delete();
  }
}

// Run the script
addPropertyWithBalloon();