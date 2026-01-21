import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function findBuyer() {
  const email = 'midamerica.invest@gmail.com';

  console.log(`\nSearching for buyer with email: ${email}\n`);

  // Search by email
  const snapshot = await db.collection('buyerProfiles')
    .where('email', '==', email)
    .limit(5)
    .get();

  console.log(`Found ${snapshot.size} buyers:\n`);

  if (snapshot.empty) {
    // Try case-insensitive search by getting all and filtering
    console.log('Trying broader search...\n');
    const allBuyers = await db.collection('buyerProfiles').limit(500).get();

    const matches = allBuyers.docs.filter(doc => {
      const data = doc.data();
      return data.email?.toLowerCase() === email.toLowerCase() ||
             data.firstName?.toLowerCase().includes('midamerica') ||
             data.lastName?.toLowerCase().includes('invest');
    });

    console.log(`Found ${matches.length} potential matches:\n`);
    matches.forEach(doc => {
      const data = doc.data();
      console.log('---');
      console.log('DocID:', doc.id);
      console.log('Name:', data.firstName, data.lastName);
      console.log('Phone:', data.phone);
      console.log('Email:', data.email);
      console.log('isAvailableForPurchase:', data.isAvailableForPurchase);
      console.log('isActive:', data.isActive);
    });
  } else {
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log('---');
      console.log('DocID:', doc.id);
      console.log('Name:', data.firstName, data.lastName);
      console.log('Phone:', data.phone);
      console.log('Email:', data.email);
      console.log('isAvailableForPurchase:', data.isAvailableForPurchase);
      console.log('isActive:', data.isActive);
    });
  }
}

findBuyer()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
