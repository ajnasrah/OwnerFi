const admin = require('firebase-admin');
const serviceAccount = require('./ownerfi-55c5f-firebase-adminsdk-gw3zs-3b95b96171.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const testBuyers = [
  // Dallas area buyers
  {
    firstName: 'Michael',
    lastName: 'Johnson',
    email: 'michael.johnson@test.com',
    phone: '214-555-0101',
    preferredCity: 'Dallas',
    preferredState: 'TX',
    searchRadius: 10,
    maxMonthlyPayment: 2500,
    maxDownPayment: 15000,
    minBedrooms: 3,
    minBathrooms: 2
  },
  {
    firstName: 'Sarah',
    lastName: 'Williams',
    email: 'sarah.williams@test.com',
    phone: '972-555-0102',
    preferredCity: 'Irving',
    preferredState: 'TX',
    searchRadius: 15,
    maxMonthlyPayment: 2000,
    maxDownPayment: 10000,
    minBedrooms: 2,
    minBathrooms: 1
  },
  {
    firstName: 'James',
    lastName: 'Brown',
    email: 'james.brown@test.com',
    phone: '469-555-0103',
    preferredCity: 'Arlington',
    preferredState: 'TX',
    searchRadius: 20,
    maxMonthlyPayment: 3000,
    maxDownPayment: 20000,
    minBedrooms: 4,
    minBathrooms: 2
  },
  
  // Houston area buyers
  {
    firstName: 'Emily',
    lastName: 'Davis',
    email: 'emily.davis@test.com',
    phone: '713-555-0104',
    preferredCity: 'Houston',
    preferredState: 'TX',
    searchRadius: 25,
    maxMonthlyPayment: 2800,
    maxDownPayment: 18000,
    minBedrooms: 3,
    minBathrooms: 2
  },
  
  // Miami area buyers
  {
    firstName: 'Robert',
    lastName: 'Martinez',
    email: 'robert.martinez@test.com',
    phone: '305-555-0105',
    preferredCity: 'Miami',
    preferredState: 'FL',
    searchRadius: 15,
    maxMonthlyPayment: 3500,
    maxDownPayment: 25000,
    minBedrooms: 3,
    minBathrooms: 2
  },
  {
    firstName: 'Maria',
    lastName: 'Garcia',
    email: 'maria.garcia@test.com',
    phone: '786-555-0106',
    preferredCity: 'Coral Gables',
    preferredState: 'FL',
    searchRadius: 10,
    maxMonthlyPayment: 4000,
    maxDownPayment: 30000,
    minBedrooms: 4,
    minBathrooms: 3
  },
  
  // Other Texas cities
  {
    firstName: 'David',
    lastName: 'Rodriguez',
    email: 'david.rodriguez@test.com',
    phone: '512-555-0107',
    preferredCity: 'San Antonio',
    preferredState: 'TX',
    searchRadius: 20,
    maxMonthlyPayment: 2200,
    maxDownPayment: 12000,
    minBedrooms: 3,
    minBathrooms: 2
  },
  {
    firstName: 'Jennifer',
    lastName: 'Miller',
    email: 'jennifer.miller@test.com',
    phone: '361-555-0108',
    preferredCity: 'Corpus Christi',
    preferredState: 'TX',
    searchRadius: 15,
    maxMonthlyPayment: 1800,
    maxDownPayment: 8000,
    minBedrooms: 2,
    minBathrooms: 1
  },
  
  // Florida cities
  {
    firstName: 'William',
    lastName: 'Wilson',
    email: 'william.wilson@test.com',
    phone: '407-555-0109',
    preferredCity: 'Orlando',
    preferredState: 'FL',
    searchRadius: 20,
    maxMonthlyPayment: 2600,
    maxDownPayment: 16000,
    minBedrooms: 3,
    minBathrooms: 2
  },
  {
    firstName: 'Lisa',
    lastName: 'Anderson',
    email: 'lisa.anderson@test.com',
    phone: '813-555-0110',
    preferredCity: 'Tampa',
    preferredState: 'FL',
    searchRadius: 25,
    maxMonthlyPayment: 2400,
    maxDownPayment: 14000,
    minBedrooms: 3,
    minBathrooms: 2
  }
];

async function createTestBuyers() {
  console.log('Creating test buyers...\n');
  
  for (const buyer of testBuyers) {
    try {
      // Create user account
      const userDoc = await db.collection('users').add({
        email: buyer.email,
        role: 'buyer',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Create buyer profile
      await db.collection('buyerProfiles').add({
        ...buyer,
        userId: userDoc.id,
        languages: ['English'],
        profileComplete: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✓ Created buyer: ${buyer.firstName} ${buyer.lastName}`);
      console.log(`  Location: ${buyer.preferredCity}, ${buyer.preferredState} (${buyer.searchRadius} mi radius)`);
      console.log(`  Budget: $${buyer.maxMonthlyPayment}/mo, $${buyer.maxDownPayment} down\n`);
      
    } catch (error) {
      console.error(`✗ Failed to create buyer ${buyer.firstName} ${buyer.lastName}:`, error.message);
    }
  }
  
  console.log('\nTest buyers creation complete!');
  process.exit(0);
}

createTestBuyers();