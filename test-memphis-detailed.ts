import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase with full config
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

async function testMemphisVariations() {
  console.log('🔍 Testing Memphis property variations...\n');

  try {
    // Query all owner-financed properties
    const propertiesQuery = query(
      collection(db, 'zillow_imports'),
      where('ownerFinanceVerified', '==', true)
    );

    const snapshot = await getDocs(propertiesQuery);
    const allProperties = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        fullAddress: data.fullAddress,
        streetAddress: data.streetAddress,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
      };
    });

    console.log(`📊 Total properties in database: ${allProperties.length}\n`);

    // Find all unique city names that contain "memphis"
    const citiesWithMemphis = new Set<string>();
    const cityVariations: { [key: string]: number } = {};

    allProperties.forEach(property => {
      const city = property.city?.toLowerCase() || '';
      if (city.includes('memphis')) {
        citiesWithMemphis.add(property.city || '');
        cityVariations[property.city || ''] = (cityVariations[property.city || ''] || 0) + 1;
      }
    });

    console.log('🏘️  City variations containing "Memphis":');
    Object.entries(cityVariations)
      .sort((a, b) => b[1] - a[1])
      .forEach(([city, count]) => {
        console.log(`  - "${city}": ${count} properties`);
      });

    // Total Memphis properties
    const totalMemphis = Object.values(cityVariations).reduce((sum, count) => sum + count, 0);
    console.log(`\n📈 Total Memphis-area properties: ${totalMemphis}`);

    // Check TN properties
    const tnProperties = allProperties.filter(p => p.state?.toUpperCase() === 'TN');
    console.log(`\n📍 Total Tennessee properties: ${tnProperties.length}`);

    // Top 10 TN cities
    const tnCities: { [key: string]: number } = {};
    tnProperties.forEach(p => {
      const city = p.city || 'Unknown';
      tnCities[city] = (tnCities[city] || 0) + 1;
    });

    console.log('\n🏙️  Top Tennessee cities:');
    Object.entries(tnCities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([city, count]) => {
        console.log(`  ${count.toString().padStart(3)} - ${city}`);
      });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

testMemphisVariations();
