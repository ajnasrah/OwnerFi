import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

// The 16 missing opportunity IDs
const TARGET_IDS = [
  'XaDgL7spivEAFs6SoTCw',  // 603 N Highway 95
  'feMN1TbH8JR5ENTUV0Se',  // 2403/2409/2411 Fulton St
  'OziWrhkzOqzx9zaQD4wi',  // 1301 Watrous Ave
  'CWY8BUS6iCIctdfGq8fA',  // 405 Elizabeth St
  'Y1rtVsWUKITMWK5yxKY9',  // 911 W D Ave
  'tSjtZCKOVFRUai2tXpZP',  // 1008 N Ridge Pl
  'wIAy0AzRQHDIAJMpdbuO',  // 610 E Zion St N
  'Kpsuy1FiyIOXMCjK4REv',  // 3731 Indian Mound Trl
  'LreecXMZl6sUxkyAGPB6',  // 621 Stonehenge Dr
  'wELLLnRw4kzJba59BZgu',  // 224 Celestial Ridge Dr
  'riuiXe0MrnI9g4yerMhA',  // 179 E Finland St
  'dCPGtGlMq6wMpIMUvBhk',  // 358 S Kinler St
  'rV5q1mXoFWbyAwrWfZ7e',  // 402 N Lincoln Ave
  'salXW7ti3Z36Vnd63i5E',  // 2842 LUCOMA Drive
  'rcuP9y5jXJe58nk6I7Vt',  // 509 N 6th St
  'ek3YGXdQGSaXT1fpGbqm'   // 3730 E Davis Rd
];

async function verifyAll16Imported() {
  console.log('🔍 Verifying all 16 properties are now in Firestore...\n');

  // Get all Firestore properties
  const propertiesSnapshot = await getDocs(collection(db, 'properties'));
  const firestoreIds = new Set(propertiesSnapshot.docs.map(doc => doc.id));

  console.log(`📊 Total Firestore properties: ${firestoreIds.size}\n`);

  let foundCount = 0;
  let missingCount = 0;
  const missing: string[] = [];

  TARGET_IDS.forEach((id, index) => {
    if (firestoreIds.has(id)) {
      console.log(`✅ ${index + 1}. ${id} - FOUND`);
      foundCount++;
    } else {
      console.log(`❌ ${index + 1}. ${id} - MISSING`);
      missingCount++;
      missing.push(id);
    }
  });

  console.log(`\n📊 VERIFICATION SUMMARY:`);
  console.log(`   Total target properties: ${TARGET_IDS.length}`);
  console.log(`   ✅ Found in Firestore: ${foundCount}`);
  console.log(`   ❌ Still missing: ${missingCount}`);

  if (missingCount === 0) {
    console.log(`\n🎉 SUCCESS! All 16 properties are now in Firestore!`);
  } else {
    console.log(`\n⚠️  Still missing ${missingCount} properties:`);
    missing.forEach(id => console.log(`   - ${id}`));
  }
}

verifyAll16Imported().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
