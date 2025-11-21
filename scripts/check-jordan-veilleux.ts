/**
 * Check Jordan Veilleux buyer profile and Memphis properties
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkJordanVeilleux() {
  try {
    console.log('🔍 Searching for Jordan Veilleux...\n');

    // Search for Jordan Veilleux in buyerProfiles collection
    const buyersSnapshot = await getDocs(collection(db, 'buyerProfiles'));

    const allBuyers: any[] = [];
    buyersSnapshot.forEach((doc) => {
      allBuyers.push({ id: doc.id, ...doc.data() });
    });

    const matches = allBuyers.filter((b: any) =>
      b.name?.toLowerCase().includes('jordan') ||
      b.name?.toLowerCase().includes('veilleux') ||
      b.email?.toLowerCase().includes('jordan') ||
      b.email?.toLowerCase().includes('veilleux')
    );

    console.log(`Found ${matches.length} matching buyer(s)\n`);

    if (matches.length === 0) {
      console.log('❌ No buyers found matching "Jordan Veilleux"');
      console.log('\nSearching all buyers with "Memphis" in their cities...');

      const memphisBuyers = allBuyers.filter((b: any) => {
        const cities = b.cities || [];
        return cities.some((city: string) => city.toLowerCase().includes('memphis'));
      });

      console.log(`Found ${memphisBuyers.length} Memphis buyers total`);
      memphisBuyers.slice(0, 5).forEach((b: any) => {
        console.log(`  - ${b.name} (${b.email}) - ${b.cities?.join(', ')}`);
      });

      return;
    }

    // Display the buyer info
    const buyer = matches[0];
    console.log('✅ BUYER PROFILE:');
    console.log(`   Name: ${buyer.name}`);
    console.log(`   Email: ${buyer.email}`);
    console.log(`   Phone: ${buyer.phone || 'N/A'}`);
    console.log(`   Cities: ${buyer.cities?.join(', ') || 'N/A'}`);
    console.log(`   Budget: $${buyer.minBudget || 0} - $${buyer.maxBudget || 0}`);
    console.log(`   Min Beds: ${buyer.minBedrooms || 'N/A'}`);
    console.log(`   Min Baths: ${buyer.minBathrooms || 'N/A'}`);
    console.log(`   Created: ${buyer.createdAt}`);
    console.log(`   ID: ${buyer.id}\n`);

    // Now check Memphis properties (ALL statuses)
    console.log('🏠 Checking Memphis properties...\n');

    // First check all Memphis properties regardless of status
    const allMemphisQuery = query(
      collection(db, 'properties'),
      where('city', '==', 'Memphis')
    );

    const allMemphisSnapshot = await getDocs(allMemphisQuery);
    const allMemphisProperties: any[] = [];
    allMemphisSnapshot.forEach((doc) => {
      allMemphisProperties.push({ id: doc.id, ...doc.data() });
    });

    console.log(`Found ${allMemphisProperties.length} total Memphis properties (all statuses)\n`);

    // Count by status
    const statusCounts: Record<string, number> = {};
    allMemphisProperties.forEach((p) => {
      const status = p.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('Properties by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    const propertiesQuery = query(
      collection(db, 'properties'),
      where('city', '==', 'Memphis'),
      where('status', '==', 'available')
    );

    const propertiesSnapshot = await getDocs(propertiesQuery);
    const properties: any[] = [];
    propertiesSnapshot.forEach((doc) => {
      properties.push({ id: doc.id, ...doc.data() });
    });

    console.log(`\nFound ${properties.length} available Memphis properties\n`);

    if (properties.length > 0) {
      console.log('Sample properties:');
      properties.slice(0, 10).forEach((p: any) => {
        console.log(`  - ${p.address}, ${p.city}, ${p.state}`);
        console.log(`    Price: $${p.price}, Beds: ${p.bedrooms}, Baths: ${p.bathrooms}`);
        console.log(`    ID: ${p.id}\n`);
      });
    }

    // Check if there are properties that match the buyer's criteria
    console.log('\n🎯 Checking properties that match buyer criteria...\n');

    const matchingProperties = properties.filter((p: any) => {
      const priceMatch = (!buyer.minBudget || p.price >= buyer.minBudget) &&
                        (!buyer.maxBudget || p.price <= buyer.maxBudget);
      const bedroomsMatch = !buyer.minBedrooms || (p.bedrooms && p.bedrooms >= buyer.minBedrooms);
      const bathroomsMatch = !buyer.minBathrooms || (p.bathrooms && p.bathrooms >= buyer.minBathrooms);

      return priceMatch && bedroomsMatch && bathroomsMatch;
    });

    console.log(`${matchingProperties.length} properties match the buyer's criteria`);

    if (matchingProperties.length > 0) {
      console.log('\nMatching properties:');
      matchingProperties.forEach((p: any) => {
        console.log(`  ✅ ${p.address}, ${p.city}, ${p.state}`);
        console.log(`     Price: $${p.price}, Beds: ${p.bedrooms}, Baths: ${p.bathrooms}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkJordanVeilleux().catch(console.error);
