// Test script to create Dallas buyer scenario with exactly 4 properties
import admin from 'firebase-admin';
import serviceAccount from './serviceAccount.json' assert { type: 'json' };

// Initialize Firebase Admin (assuming credentials are set up)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// First, add 3 more Dallas properties to reach total of 4
const dallasProperties = [
  {
    id: 'dallas-test-1',
    address: '1234 Oak Street',
    city: 'Dallas',
    state: 'TX',
    zipCode: '75201',
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    listPrice: 285000,
    downPaymentAmount: 28500,
    monthlyPayment: 1450,
    interestRate: 7.0,
    termYears: 20,
    description: 'Beautiful 3BR/2BA home in Dallas',
    isActive: true,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
  },
  {
    id: 'dallas-test-2', 
    address: '5678 Elm Avenue',
    city: 'Dallas',
    state: 'TX',
    zipCode: '75202',
    bedrooms: 4,
    bathrooms: 3,
    squareFeet: 2200,
    listPrice: 350000,
    downPaymentAmount: 35000,
    monthlyPayment: 1800,
    interestRate: 7.0,
    termYears: 20,
    description: 'Spacious 4BR/3BA family home in Dallas',
    isActive: true,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
  },
  {
    id: 'dallas-test-3',
    address: '9012 Maple Drive', 
    city: 'Dallas',
    state: 'TX',
    zipCode: '75203',
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1650,
    listPrice: 295000,
    downPaymentAmount: 29500,
    monthlyPayment: 1520,
    interestRate: 7.0,
    termYears: 20,
    description: 'Charming 3BR/2BA home in Dallas',
    isActive: true,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
  }
];

// Create Dallas buyer with search criteria that matches all 4 properties
const dallasUser = {
  id: 'dallas-test-user',
  email: 'dallas.buyer@test.com',
  name: 'Dallas Test Buyer',
  role: 'buyer',
  createdAt: admin.firestore.Timestamp.now(),
  updatedAt: admin.firestore.Timestamp.now()
};

const dallasBuyer = {
  id: 'dallas-test-buyer',
  userId: 'dallas-test-user',
  firstName: 'Dallas',
  lastName: 'Buyer',
  email: 'dallas.buyer@test.com',
  phone: '214-555-0123',
  preferredCity: 'Dallas',
  preferredState: 'TX',
  searchRadius: 25,
  maxMonthlyPayment: 2000, // Higher than all 4 properties (1450, 1520, 1726, 1800)
  maxDownPayment: 40000,   // Higher than all 4 properties
  minBedrooms: 3,         // All properties have 3+ bedrooms
  minBathrooms: 2,        // All properties have 2+ bathrooms
  emailNotifications: true,
  smsNotifications: false,
  profileComplete: true,
  isActive: true,
  createdAt: admin.firestore.Timestamp.now(),
  updatedAt: admin.firestore.Timestamp.now()
};

async function setupDallasScenario() {
  try {
    console.log('🏠 Adding 3 more Dallas properties...');
    
    // Add the 3 new properties
    for (const property of dallasProperties) {
      await db.collection('properties').doc(property.id).set(property);
      console.log(`✅ Added property: ${property.address}`);
    }
    
    console.log('👤 Creating Dallas buyer...');
    
    // Create user
    await db.collection('users').doc(dallasUser.id).set(dallasUser);
    console.log(`✅ Created user: ${dallasUser.email}`);
    
    // Create buyer profile
    await db.collection('buyerProfiles').doc(dallasBuyer.id).set(dallasBuyer);
    console.log(`✅ Created buyer profile: ${dallasBuyer.firstName} ${dallasBuyer.lastName}`);
    
    console.log('\n🎯 Test Scenario Complete!');
    console.log('Dallas buyer search criteria:');
    console.log(`- City: ${dallasBuyer.preferredCity}`);
    console.log(`- Max Monthly Payment: $${dallasBuyer.maxMonthlyPayment}`);
    console.log(`- Max Down Payment: $${dallasBuyer.maxDownPayment}`);
    console.log(`- Min Bedrooms: ${dallasBuyer.minBedrooms}`);
    console.log(`- Min Bathrooms: ${dallasBuyer.minBathrooms}`);
    
    console.log('\n🏠 Should find 4 Dallas properties:');
    console.log('1. 14247 Greenhaw Lane - $1726.17/month, $31990 down');
    console.log('2. 1234 Oak Street - $1450/month, $28500 down');
    console.log('3. 5678 Elm Avenue - $1800/month, $35000 down');
    console.log('4. 9012 Maple Drive - $1520/month, $29500 down');
    
  } catch (error) {
    console.error('❌ Error setting up Dallas scenario:', error);
  }
}

async function testBuyerSearch() {
  console.log('\n🔍 Testing buyer search...');
  
  try {
    const response = await fetch('http://localhost:3001/api/buyer/properties?city=Dallas&maxMonthlyPayment=2000&maxDownPayment=40000');
    const data = await response.json();
    
    console.log(`\n✅ Search Results: Found ${data.total || data.properties?.length || 0} properties`);
    
    if (data.properties) {
      data.properties.forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.address} - $${prop.monthlyPayment}/month, $${prop.downPaymentAmount} down`);
      });
    }
    
    if ((data.properties?.length || 0) === 4) {
      console.log('\n🎉 SUCCESS! Dallas buyer finds exactly 4 properties as expected!');
    } else {
      console.log(`\n⚠️ Expected 4 properties, but found ${data.properties?.length || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing search:', error);
  }
}

// Run the setup
setupDallasScenario().then(() => {
  // Test the search after a short delay
  setTimeout(testBuyerSearch, 2000);
}).finally(() => {
  process.exit(0);
});