import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials:');
    console.error('FIREBASE_PROJECT_ID:', projectId ? '✓' : '✗');
    console.error('FIREBASE_CLIENT_EMAIL:', clientEmail ? '✓' : '✗');
    console.error('FIREBASE_PRIVATE_KEY:', privateKey ? '✓' : '✗');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

async function searchAddress(searchTerm: string) {
  console.log(`\n🔍 Searching for address: "${searchTerm}"\n`);

  try {
    // Search in zillow_imports collection
    const snapshot = await db.collection('zillow_imports').get();

    const matches: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const fullAddress = data.fullAddress || '';
      const streetAddress = data.streetAddress || '';
      const address = data.address || '';

      // Case-insensitive search across all address fields
      const searchLower = searchTerm.toLowerCase();
      if (
        fullAddress.toLowerCase().includes(searchLower) ||
        streetAddress.toLowerCase().includes(searchLower) ||
        address.toLowerCase().includes(searchLower)
      ) {
        matches.push({
          id: doc.id,
          fullAddress,
          streetAddress,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          price: data.price,
          ownerFinanceVerified: data.ownerFinanceVerified,
          status: data.status,
          foundAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
          zillowUrl: data.zillowUrl,
        });
      }
    });

    console.log(`\n✅ Found ${matches.length} matching properties:\n`);

    if (matches.length === 0) {
      console.log('❌ No properties found matching this address.');
      console.log('\nThis address is NOT in the database.');
    } else {
      matches.forEach((match, index) => {
        console.log(`\n--- Property ${index + 1} ---`);
        console.log(`ID: ${match.id}`);
        console.log(`Full Address: ${match.fullAddress}`);
        console.log(`Street: ${match.streetAddress}`);
        console.log(`City: ${match.city}, ${match.state} ${match.zipCode}`);
        console.log(`Price: $${match.price?.toLocaleString() || 'N/A'}`);
        console.log(`Owner Finance Verified: ${match.ownerFinanceVerified ? 'YES' : 'NO'}`);
        console.log(`Status: ${match.status || 'N/A'}`);
        console.log(`Found At: ${match.foundAt || 'N/A'}`);
        console.log(`Zillow URL: ${match.zillowUrl || 'N/A'}`);
      });

      console.log(`\n\n✅ This address IS in the database (${matches.length} ${matches.length === 1 ? 'match' : 'matches'} found).`);
    }

  } catch (error) {
    console.error('❌ Error searching:', error);
    throw error;
  }
}

// Search for the address from screenshot
const addressToSearch = '4233 Glenbrook Dr, Memphis, TN 38109';
searchAddress(addressToSearch)
  .then(() => {
    console.log('\n✅ Search complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Search failed:', error);
    process.exit(1);
  });
