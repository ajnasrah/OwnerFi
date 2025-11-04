import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import csv from 'csv-parser';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function findAllMissing() {
  console.log('\n🔍 Finding all missing properties...\n');

  // Get all Firebase Opportunity IDs
  const propertiesSnapshot = await db.collection('properties').get();
  const firebaseOppIds = new Set<string>();

  propertiesSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.opportunityId) {
      firebaseOppIds.add(data.opportunityId);
    }
  });

  console.log(`📊 Firebase has ${firebaseOppIds.size} properties with Opportunity IDs\n`);

  // Get all GHL exported Opportunity IDs using csv-parser
  const ghlExportedOppIds = new Set<string>();
  const ghlProperties: any[] = [];

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream('/Users/abdullahabunasrah/Downloads/opportunities.csv')
      .pipe(csv())
      .on('data', (row: any) => {
        const stage = (row.stage || '').trim().toLowerCase();
        const oppId = (row['Opportunity ID'] || '').trim();

        if (stage === 'exported to website' && oppId) {
          ghlExportedOppIds.add(oppId);
          ghlProperties.push(row);
        }
      })
      .on('end', () => resolve())
      .on('error', (error: Error) => reject(error));
  });

  console.log(`📊 GHL 'exported to website' has ${ghlExportedOppIds.size} properties with Opportunity IDs\n`);

  // Find missing
  const missingOppIds = Array.from(ghlExportedOppIds).filter(id => !firebaseOppIds.has(id));
  console.log(`❌ Missing from Firebase: ${missingOppIds.length}\n`);

  if (missingOppIds.length > 0) {
    console.log(`Missing Opportunity IDs (first 30):`);
    missingOppIds.slice(0, 30).forEach((oppId, idx) => {
      const prop = ghlProperties.find(p => p['Opportunity ID'] === oppId);
      if (prop) {
        console.log(`  ${idx + 1}. ${prop['Property Address']}, ${prop['Property city']} (${oppId})`);
      } else {
        console.log(`  ${idx + 1}. ${oppId}`);
      }
    });

    // Save all missing to file
    const missingProps = ghlProperties.filter(p => missingOppIds.includes(p['Opportunity ID']));
    fs.writeFileSync(
      '/Users/abdullahabunasrah/Desktop/ownerfi/all-missing-properties.json',
      JSON.stringify(missingProps, null, 2)
    );
    console.log(`\n📄 Saved all ${missingProps.length} missing properties to all-missing-properties.json`);
  } else {
    console.log('✅ No missing properties! Database is perfectly synced with GHL!\n');
  }
}

findAllMissing().catch(console.error);
