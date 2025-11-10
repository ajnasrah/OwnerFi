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

async function verifyOpportunityIdsMatch() {
  console.log('🔍 Verifying all Firestore document IDs match GHL opportunity IDs...\n');

  // Read GHL CSV
  const csvContent = fs.readFileSync('/Users/abdullahabunasrah/Downloads/opportunities.csv', 'utf-8');
  const ghlRecords = csv.parse(csvContent, { columns: true, skip_empty_lines: true });

  // Get "exported to website" properties from GHL
  const exportedToWebsite = ghlRecords.filter((r: any) => r.stage === 'exported to website');

  // Create map of GHL opportunity IDs to property data
  const ghlMap = new Map<string, any>();
  exportedToWebsite.forEach((r: any) => {
    const oppId = r['Opportunity ID'];
    if (oppId) {
      ghlMap.set(oppId, {
        opportunityId: oppId,
        address: r['Property Address'] || '',
        city: r['Property city'] || '',
        state: r['State '] || '',
        price: r['Price '] || ''
      });
    }
  });

  console.log(`📊 GHL "exported to website": ${ghlMap.size} properties\n`);

  // Get Firestore properties
  const propertiesSnapshot = await getDocs(collection(db, 'properties'));

  console.log(`📊 Firestore properties: ${propertiesSnapshot.size} properties\n`);
  console.log(`Checking each Firestore property...\n`);

  const results = {
    totalProperties: 0,
    matchingIds: 0,
    mismatchedIds: 0,
    missingOpportunityId: 0,
    testProperties: 0,
    mismatches: [] as any[]
  };

  propertiesSnapshot.docs.forEach(doc => {
    results.totalProperties++;
    const data = doc.data();
    const firestoreId = doc.id;
    const opportunityId = data.opportunityId;

    // Skip test properties
    if (firestoreId === 'EBMIeDvOjCaw5QK9sc2l' || firestoreId === 'test_rental_estimate_1762555331637') {
      results.testProperties++;
      console.log(`⚠️  ${results.totalProperties}. TEST PROPERTY (skipping): ${firestoreId}`);
      return;
    }

    // Check if opportunityId field exists
    if (!opportunityId) {
      results.missingOpportunityId++;
      console.log(`❌ ${results.totalProperties}. MISSING opportunityId field`);
      console.log(`   Firestore ID: ${firestoreId}`);
      console.log(`   Address: ${data.address}, ${data.city}, ${data.state}`);
      results.mismatches.push({
        firestoreId,
        opportunityId: null,
        address: `${data.address}, ${data.city}, ${data.state}`,
        issue: 'Missing opportunityId field'
      });
      return;
    }

    // Check if Firestore ID matches opportunityId field
    if (firestoreId !== opportunityId) {
      results.mismatchedIds++;
      console.log(`❌ ${results.totalProperties}. MISMATCH:`);
      console.log(`   Firestore document ID: ${firestoreId}`);
      console.log(`   opportunityId field:   ${opportunityId}`);
      console.log(`   Address: ${data.address}, ${data.city}, ${data.state}`);
      results.mismatches.push({
        firestoreId,
        opportunityId,
        address: `${data.address}, ${data.city}, ${data.state}`,
        issue: 'Document ID does not match opportunityId field'
      });
    } else {
      results.matchingIds++;

      // Also verify it matches GHL
      const ghlData = ghlMap.get(opportunityId);
      if (ghlData) {
        console.log(`✅ ${results.totalProperties}. MATCH: ${firestoreId} = ${opportunityId}`);
      } else {
        console.log(`⚠️  ${results.totalProperties}. ID MATCHES but NOT in GHL "exported to website": ${firestoreId}`);
      }
    }
  });

  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`📊 VERIFICATION SUMMARY`);
  console.log(`${'='.repeat(70)}\n`);

  console.log(`Total Firestore properties: ${results.totalProperties}`);
  console.log(`   └─ Test properties (excluded): ${results.testProperties}`);
  console.log(`   └─ Real properties: ${results.totalProperties - results.testProperties}\n`);

  console.log(`✅ Firestore ID matches opportunityId field: ${results.matchingIds}`);
  console.log(`❌ Firestore ID does NOT match opportunityId: ${results.mismatchedIds}`);
  console.log(`❌ Missing opportunityId field entirely: ${results.missingOpportunityId}\n`);

  const matchRate = ((results.matchingIds / (results.totalProperties - results.testProperties)) * 100).toFixed(2);
  console.log(`📈 Match Rate: ${matchRate}%\n`);

  if (results.mismatchedIds > 0 || results.missingOpportunityId > 0) {
    console.log(`\n⚠️  ISSUES FOUND:\n`);
    results.mismatches.forEach((m, i) => {
      console.log(`${i + 1}. ${m.address}`);
      console.log(`   Issue: ${m.issue}`);
      console.log(`   Firestore ID: ${m.firestoreId}`);
      console.log(`   opportunityId: ${m.opportunityId || 'null'}\n`);
    });

    console.log(`\n💡 RECOMMENDATION:`);
    console.log(`   These ${results.mismatchedIds + results.missingOpportunityId} properties have data inconsistencies.`);
    console.log(`   This should not happen if properties were created via the GHL webhook.`);
    console.log(`   They may have been created manually or via import scripts.\n`);
  } else {
    console.log(`✅ PERFECT! All Firestore document IDs match their opportunityId fields!\n`);
    console.log(`This means:`);
    console.log(`   • Properties were correctly created via GHL webhook`);
    console.log(`   • Document IDs use GHL opportunity IDs (correct architecture)`);
    console.log(`   • Data consistency is maintained\n`);
  }

  // Additional check: verify against GHL CSV
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 CROSS-REFERENCE WITH GHL`);
  console.log(`${'='.repeat(70)}\n`);

  let inBothSystems = 0;
  let onlyInFirestore = 0;
  let onlyInGHL = 0;

  const firestoreIds = new Set(
    propertiesSnapshot.docs
      .filter(doc => !['EBMIeDvOjCaw5QK9sc2l', 'test_rental_estimate_1762555331637'].includes(doc.id))
      .map(doc => doc.id)
  );

  firestoreIds.forEach(id => {
    if (ghlMap.has(id)) {
      inBothSystems++;
    } else {
      onlyInFirestore++;
    }
  });

  ghlMap.forEach((data, id) => {
    if (!firestoreIds.has(id)) {
      onlyInGHL++;
    }
  });

  console.log(`✅ In both Firestore AND GHL "exported to website": ${inBothSystems}`);
  console.log(`⚠️  In Firestore but NOT in GHL "exported to website": ${onlyInFirestore}`);
  console.log(`⚠️  In GHL "exported to website" but NOT in Firestore: ${onlyInGHL}\n`);

  if (inBothSystems === firestoreIds.size && onlyInGHL === 0) {
    console.log(`🎉 PERFECT SYNC! All opportunity IDs match between systems!\n`);
  }
}

verifyOpportunityIdsMatch().then(() => {
  console.log('✅ Done');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
