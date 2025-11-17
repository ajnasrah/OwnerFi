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

async function testMemphisSearch() {
  console.log('🔍 Testing Memphis property search...\n');

  try {
    // Query all owner-financed properties (what the API fetches)
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

    console.log(`📊 Total properties in database: ${allProperties.length}`);

    // Filter for Memphis properties (case-insensitive)
    const memphisProperties = allProperties.filter(property => {
      const searchFields = [
        property.fullAddress,
        property.streetAddress,
        property.city,
        property.state,
        property.zipCode,
        property.id
      ]
        .filter(Boolean)
        .map(f => f.toString().toLowerCase());

      return searchFields.some(field => field.includes('memphis'));
    });

    console.log(`\n🏘️  Memphis properties found: ${memphisProperties.length}\n`);

    if (memphisProperties.length > 0) {
      console.log('Sample Memphis properties:');
      memphisProperties.slice(0, 10).forEach((prop, i) => {
        console.log(`  ${i + 1}. ${prop.streetAddress || prop.fullAddress} - ${prop.city}, ${prop.state} ${prop.zipCode}`);
      });

      if (memphisProperties.length > 10) {
        console.log(`  ... and ${memphisProperties.length - 10} more`);
      }
    }

    console.log('\n✅ Search test completed!');
    console.log(`Expected: ~50 properties`);
    console.log(`Found: ${memphisProperties.length} properties`);

    if (memphisProperties.length >= 45 && memphisProperties.length <= 55) {
      console.log('✅ PASS: Memphis property count is in expected range');
    } else {
      console.log('⚠️  WARNING: Memphis property count differs from expected ~50');
    }

  } catch (error) {
    console.error('❌ Error testing search:', error);
    process.exit(1);
  }

  process.exit(0);
}

testMemphisSearch();
