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

async function findOrphanedProperties() {
  console.log('🔍 Finding properties in Firestore but NOT in "exported to website"...\n');

  // Read GHL CSV
  const csvContent = fs.readFileSync('/Users/abdullahabunasrah/Downloads/opportunities.csv', 'utf-8');
  const ghlRecords = csv.parse(csvContent, { columns: true, skip_empty_lines: true });

  // Get only "exported to website" opportunity IDs
  const exportedToWebsiteIds = new Set(
    ghlRecords
      .filter((r: any) => r.stage === 'exported to website')
      .map((r: any) => r['Opportunity ID'])
      .filter(Boolean)
  );

  console.log(`📊 "exported to website" in GHL: ${exportedToWebsiteIds.size}`);

  // Get all GHL opportunity IDs (any stage)
  const allGhlIds = new Set(
    ghlRecords
      .map((r: any) => r['Opportunity ID'])
      .filter(Boolean)
  );

  // Get Firestore properties
  const propertiesSnapshot = await getDocs(collection(db, 'properties'));
  const firestoreProperties = propertiesSnapshot.docs.map(doc => ({
    id: doc.id,
    address: doc.data().address,
    city: doc.data().city,
    state: doc.data().state,
    price: doc.data().price,
    opportunityId: doc.data().opportunityId,
    source: doc.data().source,
    createdAt: doc.data().createdAt,
    updatedAt: doc.data().updatedAt
  }));

  console.log(`📊 Firestore properties: ${firestoreProperties.length}\n`);

  // Find properties in Firestore but NOT in "exported to website"
  const orphanedProperties = firestoreProperties.filter(p =>
    !exportedToWebsiteIds.has(p.id)
  );

  console.log(`🔍 Properties in Firestore but NOT "exported to website": ${orphanedProperties.length}\n`);

  if (orphanedProperties.length > 0) {
    orphanedProperties.forEach((prop, i) => {
      // Check what stage they ARE in (if any)
      const ghlRecord = ghlRecords.find((r: any) => r['Opportunity ID'] === prop.id);
      const currentStage = ghlRecord?.stage || 'NOT IN GHL';
      const inGhlAtAll = allGhlIds.has(prop.id);

      console.log(`${i + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
      console.log(`   Firestore ID: ${prop.id}`);
      console.log(`   Price: $${prop.price}`);
      console.log(`   Source: ${prop.source}`);
      console.log(`   In GHL: ${inGhlAtAll ? '✅ YES' : '❌ NO'}`);
      console.log(`   Current GHL Stage: ${currentStage}`);

      if (ghlRecord) {
        console.log(`   GHL Contact: ${ghlRecord['Contact Name']}`);
        console.log(`   GHL Updated: ${ghlRecord['Updated on']}`);
      }

      console.log('');
    });
  }

  // Summary
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Properties in "exported to website" stage: ${exportedToWebsiteIds.size}`);
  console.log(`   Properties in Firestore: ${firestoreProperties.length}`);
  console.log(`   Properties in Firestore matched with "exported to website": ${firestoreProperties.length - orphanedProperties.length}`);
  console.log(`   Properties in Firestore but NOT "exported to website": ${orphanedProperties.length}`);

  if (orphanedProperties.length > 0) {
    console.log(`\n💡 These properties may have been:`);
    console.log(`   - Moved to a different stage (pending, not available, etc.)`);
    console.log(`   - Deleted from GHL`);
    console.log(`   - Never had "exported to website" stage`);
  }
}

findOrphanedProperties().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
