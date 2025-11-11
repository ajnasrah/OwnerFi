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

async function verifyMatching() {
  console.log('🔍 Verifying Opportunity ID matching between GHL and Firestore...\n');

  // Read GHL CSV
  const csvContent = fs.readFileSync('/Users/abdullahabunasrah/Downloads/opportunities.csv', 'utf-8');
  const ghlRecords = csv.parse(csvContent, { columns: true, skip_empty_lines: true });

  // Get Firestore properties
  const propertiesSnapshot = await getDocs(collection(db, 'properties'));
  const firestoreProperties = new Map();

  propertiesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    firestoreProperties.set(doc.id, {
      id: doc.id,
      opportunityId: data.opportunityId,
      address: data.address,
      source: data.source
    });
  });

  console.log(`📊 GHL Records: ${ghlRecords.length}`);
  console.log(`📊 Firestore Properties: ${firestoreProperties.size}\n`);

  // Check how many use opportunityId
  let matchedByOpportunityId = 0;
  let unmatchedInFirestore = 0;
  let matchedByAddress = 0;

  const ghlOpportunityIds = new Set(
    ghlRecords.map((r: any) => r['Opportunity ID']).filter(Boolean)
  );

  // Check each Firestore property
  firestoreProperties.forEach((prop, propId) => {
    if (ghlOpportunityIds.has(propId)) {
      matchedByOpportunityId++;
    } else if (ghlOpportunityIds.has(prop.opportunityId)) {
      matchedByOpportunityId++;
    } else {
      unmatchedInFirestore++;
    }
  });

  console.log(`📍 Matching Results:`);
  console.log(`   ✅ Matched by Opportunity ID: ${matchedByOpportunityId}`);
  console.log(`   ❌ Not found in GHL: ${unmatchedInFirestore}`);

  // Check if property IDs ARE opportunity IDs
  let propertiesUsingOpportunityIdAsId = 0;
  firestoreProperties.forEach((prop) => {
    if (prop.opportunityId === prop.id) {
      propertiesUsingOpportunityIdAsId++;
    }
  });

  console.log(`\n📌 Property ID Structure:`);
  console.log(`   Properties using opportunityId as ID: ${propertiesUsingOpportunityIdAsId}/${firestoreProperties.size}`);

  // Show examples
  console.log(`\n📋 Sample Firestore Properties:\n`);
  let count = 0;
  for (const [id, prop] of firestoreProperties) {
    if (count >= 5) break;
    console.log(`${count + 1}. ID: ${id}`);
    console.log(`   opportunityId: ${prop.opportunityId || 'MISSING'}`);
    console.log(`   address: ${prop.address}`);
    console.log(`   source: ${prop.source}`);
    console.log(`   Match status: ${ghlOpportunityIds.has(id) ? '✅ Found in GHL' : '❌ Not in GHL'}\n`);
    count++;
  }
}

verifyMatching().then(() => {
  console.log('✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
