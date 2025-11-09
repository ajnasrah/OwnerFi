import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

// Load environment variables
dotenv.config({ path: '.env.local' });

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

async function compareProperties() {
  console.log('🔍 Comparing GHL opportunities with Firestore properties...\n');

  // Read GHL CSV
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const ghlRecords = csv.parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`📊 GHL Opportunities: ${ghlRecords.length} properties`);

  // Get Firestore properties
  const propertiesSnapshot = await getDocs(collection(db, 'properties'));
  const firestoreProperties = propertiesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  console.log(`📊 Firestore Properties: ${firestoreProperties.length} properties\n`);

  // Create sets for comparison
  // GHL uses "Property Address" field
  const ghlAddresses = new Set(
    ghlRecords
      .map((r: any) => r['Property Address']?.trim().toLowerCase())
      .filter((addr: string) => addr && addr !== '')
  );

  // Firestore uses "address" field
  const firestoreAddresses = new Set(
    firestoreProperties
      .map((p: any) => p.address?.trim().toLowerCase())
      .filter((addr: string) => addr && addr !== '')
  );

  console.log(`📍 Unique GHL addresses: ${ghlAddresses.size}`);
  console.log(`📍 Unique Firestore addresses: ${firestoreAddresses.size}\n`);

  // Find properties in GHL but not in Firestore
  const inGhlNotFirestore = ghlRecords.filter((r: any) => {
    const addr = r['Property Address']?.trim().toLowerCase();
    return addr && addr !== '' && !firestoreAddresses.has(addr);
  });

  console.log(`\n🔍 Properties in GHL but NOT in Firestore: ${inGhlNotFirestore.length}\n`);

  if (inGhlNotFirestore.length > 0) {
    console.log('First 20 missing properties:');
    inGhlNotFirestore.slice(0, 20).forEach((r: any, i: number) => {
      console.log(`\n${i + 1}. ${r['Property Address']}`);
      console.log(`   City: ${r['Property city']}, State: ${r['State ']}`);
      console.log(`   Stage: ${r['stage']}`);
      console.log(`   Price: ${r['Price ']}`);
      console.log(`   Opportunity ID: ${r['Opportunity ID']}`);
    });
  }

  // Find properties in Firestore but not in GHL (shouldn't happen but good to check)
  const inFirestoreNotGhl = firestoreProperties.filter((p: any) => {
    const addr = p.address?.trim().toLowerCase();
    return addr && addr !== '' && !ghlAddresses.has(addr);
  });

  console.log(`\n\n🔍 Properties in Firestore but NOT in GHL: ${inFirestoreNotGhl.length}\n`);

  if (inFirestoreNotGhl.length > 0) {
    console.log('First 10:');
    inFirestoreNotGhl.slice(0, 10).forEach((p: any, i: number) => {
      console.log(`\n${i + 1}. ${p.address}`);
      console.log(`   ID: ${p.id}`);
    });
  }

  // Summary
  console.log(`\n\n📊 SUMMARY:`);
  console.log(`   GHL Opportunities: ${ghlRecords.length}`);
  console.log(`   Firestore Properties: ${firestoreProperties.length}`);
  console.log(`   Difference: ${ghlRecords.length - firestoreProperties.length}`);
  console.log(`   Missing from Firestore: ${inGhlNotFirestore.length}`);
  console.log(`   Missing from GHL: ${inFirestoreNotGhl.length}`);
}

compareProperties().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
