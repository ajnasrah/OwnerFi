import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

// Names from screenshot
const namesToSearch = [
  { first: 'joshua', last: 'dandrea', email: 'ddbinv4u@gmail.com' },
  { first: 'darren', last: 'debarros' },
  { first: 'a', last: 'c' },
  { first: 'antonio', last: 'lowder' },
  { first: 'lauren', last: 'johns' },
  { first: 'tina', last: 'izaguirre' },
  { first: 'thomas', last: 'mcknight' },
];

async function findBuyers() {
  console.log('\n=== Searching for buyers by name ===\n');

  // Get all buyer profiles
  const allBuyers = await db.collection('buyerProfiles').get();
  console.log(`Total buyers in database: ${allBuyers.size}\n`);

  for (const search of namesToSearch) {
    console.log(`\n--- Searching for: ${search.first} ${search.last} ---`);

    const matches = allBuyers.docs.filter(doc => {
      const data = doc.data();
      const firstName = (data.firstName || '').toLowerCase();
      const lastName = (data.lastName || '').toLowerCase();
      const email = (data.email || '').toLowerCase();

      // Check name match
      const nameMatch = firstName.includes(search.first.toLowerCase()) ||
                        lastName.includes(search.last.toLowerCase());

      // Check email match if provided
      const emailMatch = search.email ?
        email === search.email.toLowerCase() : false;

      return nameMatch || emailMatch;
    });

    if (matches.length === 0) {
      console.log('  ❌ NOT FOUND in database');
    } else {
      matches.forEach(doc => {
        const data = doc.data();
        console.log('  ✅ FOUND:');
        console.log('     DocID:', doc.id);
        console.log('     Name:', data.firstName, data.lastName);
        console.log('     Phone:', data.phone);
        console.log('     Email:', data.email);
        console.log('     isAvailableForPurchase:', data.isAvailableForPurchase);
        console.log('     isActive:', data.isActive);
      });
    }
  }

  // Also print summary of all buyers for reference
  console.log('\n\n=== All Buyers Summary ===\n');
  allBuyers.docs.slice(0, 30).forEach(doc => {
    const data = doc.data();
    console.log(`${data.firstName || '?'} ${data.lastName || '?'} | ${data.phone} | ${data.email} | avail: ${data.isAvailableForPurchase}`);
  });
}

findBuyers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
