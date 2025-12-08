import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

async function processNotInterested() {
  console.log('='.repeat(80));
  console.log('PROCESSING GHL "NOT INTERESTED" OPPORTUNITIES');
  console.log('='.repeat(80));

  // Read CSV
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`\nTotal records in CSV: ${records.length}`);

  // Filter by stage
  const notInterested = records.filter((r: any) =>
    r.stage?.toLowerCase().includes('not interested')
  );
  const interested = records.filter((r: any) =>
    r.stage?.toLowerCase().includes('interested') && !r.stage?.toLowerCase().includes('not')
  );
  const newStage = records.filter((r: any) => r.stage === 'New');
  const pending = records.filter((r: any) => r.stage?.toLowerCase().includes('pending'));

  console.log(`\n📊 STAGE BREAKDOWN:`);
  console.log(`   Not Interested: ${notInterested.length}`);
  console.log(`   Interested: ${interested.length}`);
  console.log(`   New: ${newStage.length}`);
  console.log(`   Pending: ${pending.length}`);

  // Process "not interested" - mark as agent_no
  console.log(`\n🔄 Marking ${notInterested.length} properties as 'agent_no'...`);

  let updated = 0;
  let notFound = 0;
  let alreadyNo = 0;

  for (const record of notInterested) {
    const firebaseId = record.firebase_id;
    if (!firebaseId) {
      console.log(`   ⚠️ No firebase_id for ${record['Property Address']}`);
      continue;
    }

    try {
      const docRef = db.collection('agent_outreach_queue').doc(firebaseId);
      const doc = await docRef.get();

      if (!doc.exists) {
        notFound++;
        continue;
      }

      const data = doc.data()!;
      if (data.status === 'agent_no') {
        alreadyNo++;
        continue;
      }

      await docRef.update({
        status: 'agent_no',
        agentResponse: 'no',
        agentResponseAt: new Date(),
        agentNote: 'Marked not interested via GHL export',
        routedTo: 'rejected',
        updatedAt: new Date(),
      });

      updated++;
      if (updated % 20 === 0) {
        console.log(`   Updated: ${updated}/${notInterested.length}`);
      }
    } catch (e: any) {
      console.log(`   ❌ Error updating ${firebaseId}: ${e.message}`);
    }
  }

  // Process "interested" - mark as agent_yes and route to zillow_imports
  console.log(`\n🔄 Processing ${interested.length} "Interested" properties...`);

  let yesUpdated = 0;
  for (const record of interested) {
    const firebaseId = record.firebase_id;
    if (!firebaseId) continue;

    try {
      const docRef = db.collection('agent_outreach_queue').doc(firebaseId);
      const doc = await docRef.get();

      if (!doc.exists) continue;

      const property = doc.data()!;
      if (property.status === 'agent_yes') continue;

      // Add to zillow_imports
      await db.collection('zillow_imports').add({
        zpid: property.zpid,
        url: property.url,
        address: property.address || '',
        streetAddress: property.address || '',
        fullAddress: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
        city: property.city || '',
        state: property.state || '',
        zipCode: property.zipCode || '',
        price: property.price || 0,
        listPrice: property.price || 0,
        zestimate: property.zestimate || null,
        bedrooms: property.beds || 0,
        bathrooms: property.baths || 0,
        livingArea: property.squareFeet || 0,
        homeType: property.propertyType || 'SINGLE_FAMILY',
        homeStatus: 'FOR_SALE',
        agentName: property.agentName,
        agentPhoneNumber: property.agentPhone,
        agentEmail: property.agentEmail || null,
        description: property.rawData?.description || '',
        financingType: 'Owner Finance',
        allFinancingTypes: ['Owner Finance'],
        financingTypeLabel: 'Owner Finance',
        source: 'agent_outreach',
        agentConfirmedOwnerFinance: true,
        agentConfirmedAt: new Date(),
        agentNote: 'Agent confirmed interested via GHL',
        originalQueueId: firebaseId,
        ownerFinanceVerified: true,
        isActive: true,
        importedAt: new Date(),
        lastStatusCheck: new Date(),
        lastScrapedAt: new Date(),
        rawData: property.rawData || null,
      });

      // Update queue status
      await docRef.update({
        status: 'agent_yes',
        agentResponse: 'yes',
        agentResponseAt: new Date(),
        agentNote: 'Agent confirmed interested via GHL',
        routedTo: 'zillow_imports',
        updatedAt: new Date(),
      });

      yesUpdated++;
      console.log(`   ✅ ${property.address} → zillow_imports`);
    } catch (e: any) {
      console.log(`   ❌ Error: ${e.message}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ Marked as agent_no (not interested): ${updated}`);
  console.log(`✅ Marked as agent_yes (interested): ${yesUpdated}`);
  console.log(`⏭️  Already marked no: ${alreadyNo}`);
  console.log(`⚠️  Not found in Firebase: ${notFound}`);
  console.log('\n');
}

processNotInterested()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
