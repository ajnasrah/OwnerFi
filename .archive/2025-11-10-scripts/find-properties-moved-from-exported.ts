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

async function findPropertiesMovedFromExported() {
  console.log('🔍 Finding properties that moved OUT of "exported to website" stage...\n');

  // Read GHL CSV
  const csvContent = fs.readFileSync('/Users/abdullahabunasrah/Downloads/opportunities.csv', 'utf-8');
  const ghlRecords = csv.parse(csvContent, { columns: true, skip_empty_lines: true });

  // Create map of ALL GHL opportunities with their stages
  const ghlStageMap = new Map<string, { stage: string; address: string; city: string; state: string }>();
  ghlRecords.forEach((r: any) => {
    const oppId = r['Opportunity ID'];
    if (oppId) {
      ghlStageMap.set(oppId, {
        stage: r.stage || 'unknown',
        address: r['Property Address'] || '',
        city: r['Property city'] || '',
        state: r['State '] || ''
      });
    }
  });

  // Get "exported to website" IDs
  const exportedToWebsiteIds = new Set(
    ghlRecords
      .filter((r: any) => r.stage === 'exported to website')
      .map((r: any) => r['Opportunity ID'])
      .filter(Boolean)
  );

  console.log(`📊 Total GHL opportunities: ${ghlStageMap.size}`);
  console.log(`📊 "exported to website" in GHL: ${exportedToWebsiteIds.size}`);

  // Get Firestore properties
  const propertiesSnapshot = await getDocs(collection(db, 'properties'));
  const firestoreProperties = propertiesSnapshot.docs.map(doc => ({
    id: doc.id,
    address: doc.data().address,
    city: doc.data().city,
    state: doc.data().state,
    price: doc.data().price
  }));

  console.log(`📊 Firestore properties: ${firestoreProperties.length}\n`);

  // Find properties in Firestore that are NOT in "exported to website" anymore
  const movedProperties: any[] = [];
  const deletedFromGHL: any[] = [];
  const stillExported: any[] = [];

  firestoreProperties.forEach(prop => {
    // Skip the 2 test properties
    if (prop.id === 'EBMIeDvOjCaw5QK9sc2l' || prop.id === 'test_rental_estimate_1762555331637') {
      return;
    }

    const ghlData = ghlStageMap.get(prop.id);

    if (!ghlData) {
      // Property is in Firestore but not in GHL at all
      deletedFromGHL.push(prop);
    } else if (ghlData.stage !== 'exported to website') {
      // Property is in Firestore but moved to a different stage
      movedProperties.push({
        ...prop,
        currentStage: ghlData.stage
      });
    } else {
      // Property is still in "exported to website"
      stillExported.push(prop);
    }
  });

  console.log(`📊 BREAKDOWN:\n`);
  console.log(`✅ Still in "exported to website": ${stillExported.length}`);
  console.log(`🔄 Moved to different stage: ${movedProperties.length}`);
  console.log(`❌ Deleted from GHL entirely: ${deletedFromGHL.length}\n`);

  if (movedProperties.length > 0) {
    console.log(`\n🔄 PROPERTIES THAT MOVED TO DIFFERENT STAGES:\n`);
    console.log(`These properties are in Firestore but NO LONGER in "exported to website" stage:\n`);

    // Group by stage
    const byStage = new Map<string, any[]>();
    movedProperties.forEach(prop => {
      const stage = prop.currentStage;
      if (!byStage.has(stage)) {
        byStage.set(stage, []);
      }
      byStage.get(stage)!.push(prop);
    });

    // Sort by count
    const sortedStages = Array.from(byStage.entries()).sort((a, b) => b[1].length - a[1].length);

    sortedStages.forEach(([stage, props]) => {
      console.log(`\n📍 Stage: "${stage}" (${props.length} properties)`);
      console.log(`${'='.repeat(60)}`);
      props.slice(0, 10).forEach((prop: any, i: number) => {
        console.log(`${i + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
        console.log(`   Firestore ID: ${prop.id}`);
        console.log(`   Price: $${prop.price}`);
        console.log(`   Current GHL Stage: ${prop.currentStage}`);
        console.log(``);
      });
      if (props.length > 10) {
        console.log(`   ... and ${props.length - 10} more\n`);
      }
    });
  }

  if (deletedFromGHL.length > 0) {
    console.log(`\n❌ PROPERTIES DELETED FROM GHL:\n`);
    deletedFromGHL.slice(0, 10).forEach((prop, i) => {
      console.log(`${i + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
      console.log(`   Firestore ID: ${prop.id}`);
      console.log(`   Price: $${prop.price}`);
      console.log(``);
    });
    if (deletedFromGHL.length > 10) {
      console.log(`   ... and ${deletedFromGHL.length - 10} more\n`);
    }
  }

  console.log(`\n\n📊 FINAL SUMMARY:`);
  console.log(`   Properties in Firestore: ${firestoreProperties.length - 2} (excluding 2 test properties)`);
  console.log(`   ✅ Still "exported to website": ${stillExported.length}`);
  console.log(`   🔄 Moved to different stage: ${movedProperties.length}`);
  console.log(`   ❌ Deleted from GHL: ${deletedFromGHL.length}`);
  console.log(`\n💡 ISSUE IDENTIFIED:`);

  if (movedProperties.length > 0 || deletedFromGHL.length > 0) {
    console.log(`   ${movedProperties.length + deletedFromGHL.length} properties should have been DELETED from Firestore`);
    console.log(`   but the GHL delete webhook was never triggered!\n`);
    console.log(`🔧 REASON:`);
    console.log(`   GHL workflows are NOT configured to call the delete webhook when:`);
    console.log(`   1. Properties move OUT of "exported to website" stage`);
    console.log(`   2. Properties are deleted from GHL`);
    console.log(`\n✅ SOLUTION:`);
    console.log(`   Configure GHL automation workflows to trigger delete webhook at:`);
    console.log(`   https://ownerfi.ai/api/gohighlevel/webhook/delete-property`);
    console.log(`\n   When:`);
    console.log(`   - Property moves FROM "exported to website" TO any other stage`);
    console.log(`   - Property is deleted from GHL`);
  } else {
    console.log(`   ✅ All Firestore properties are still in "exported to website" stage!`);
  }
}

findPropertiesMovedFromExported().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
