import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

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

async function correctCount() {
  console.log('🔍 Correct count of "exported to website" properties...\n');

  // Read GHL CSV
  const csvContent = fs.readFileSync('/Users/abdullahabunasrah/Downloads/opportunities.csv', 'utf-8');
  const ghlRecords = csv.parse(csvContent, { columns: true, skip_empty_lines: true });

  // Filter for "exported to website" stage
  const exportedToWebsite = ghlRecords.filter((r: any) =>
    r.stage === 'exported to website'
  );

  console.log(`📊 GHL Total Opportunities: ${ghlRecords.length}`);
  console.log(`📊 GHL "exported to website": ${exportedToWebsite.length}`);

  // Get Firestore properties
  const propertiesSnapshot = await getDocs(collection(db, 'properties'));
  const firestoreProperties = new Map();

  propertiesSnapshot.docs.forEach(doc => {
    firestoreProperties.set(doc.id, {
      id: doc.id,
      address: doc.data().address,
      opportunityId: doc.data().opportunityId
    });
  });

  console.log(`📊 Firestore Properties: ${firestoreProperties.size}\n`);

  // Create set of GHL opportunity IDs for "exported to website"
  const exportedOpportunityIds = new Set(
    exportedToWebsite.map((r: any) => r['Opportunity ID']).filter(Boolean)
  );

  // Check how many are in Firestore
  let foundInFirestore = 0;
  let missingFromFirestore = 0;
  const missingProperties: any[] = [];

  exportedToWebsite.forEach((r: any) => {
    const oppId = r['Opportunity ID'];
    if (firestoreProperties.has(oppId)) {
      foundInFirestore++;
    } else {
      missingFromFirestore++;
      missingProperties.push(r);
    }
  });

  console.log(`✅ Found in Firestore: ${foundInFirestore}`);
  console.log(`❌ Missing from Firestore: ${missingFromFirestore}\n`);

  console.log(`📊 CORRECTED SUMMARY:`);
  console.log(`   "exported to website" in GHL: ${exportedToWebsite.length}`);
  console.log(`   Properties in Firestore: ${firestoreProperties.size}`);
  console.log(`   Expected to match: ${exportedToWebsite.length}`);
  console.log(`   Actually matched: ${foundInFirestore}`);
  console.log(`   Missing (should be synced): ${missingFromFirestore}`);

  if (missingFromFirestore > 0) {
    console.log(`\n🚨 MISSING "exported to website" PROPERTIES:\n`);
    missingProperties.slice(0, 20).forEach((r: any, i: number) => {
      console.log(`${i + 1}. ${r['Property Address']}, ${r['Property city']}, ${r['State ']}`);
      console.log(`   Price: $${r['Price ']}`);
      console.log(`   Opportunity ID: ${r['Opportunity ID']}\n`);
    });
  }

  // Also check: properties in Firestore but NOT in "exported to website" list
  let inFirestoreNotExported = 0;
  firestoreProperties.forEach((prop, id) => {
    if (!exportedOpportunityIds.has(id)) {
      inFirestoreNotExported++;
    }
  });

  console.log(`\n📍 Additional Info:`);
  console.log(`   Properties in Firestore but NOT "exported to website" in GHL: ${inFirestoreNotExported}`);
  console.log(`   (These may have been moved to other stages or deleted)`);
}

correctCount().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
