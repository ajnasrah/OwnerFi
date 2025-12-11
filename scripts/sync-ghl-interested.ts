import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

// Properties that are "Interested" in GHL with their firebase_ids
const interestedProperties = [
  { address: '377 Fountain Lake Dr', firebaseId: 'bmkJUNTAdIpEE5puzml6' },
  { address: '4355 Cleopatra Rd', firebaseId: 'MCRcB8eBSDlsZODHSvgI' },
  { address: '3 Dunfrettin Pl', firebaseId: 'Kkrj43Adc045utlkwz4q' },
  { address: '6905 Petworth Rd #6905', firebaseId: 'bBSX4sdng6AHoH71uF59' },
  { address: '7325 Knollwood Dr', firebaseId: 's8v99VFQkRU141Bi3ZfI' },
  { address: '5908 Glenhaven Pl', firebaseId: 'hBaLk7Cx2gYIoFnaDWzP' },
  { address: '1234 Smith Ave', firebaseId: 'HTSC9UByiKiK8xvU922c' },
  { address: '2217 Scott St', firebaseId: 'eONeCDfCaDOp3qb8SoJN' },
  { address: '124 Glendale St', firebaseId: '2IbhtbUMubyh5gaWc6OR' },
  { address: '300 E 3rd St APT 503', firebaseId: 'fSdh53FUlwsQYct0fMvy' },
  { address: '620 Williams Ave', firebaseId: 'n3TJYpRI26o8f6L0eblE' },
  { address: '207 Ross Ave', firebaseId: 'sEohmDbgViu7nH2Cu6hQ' },
  { address: '1802 N Houston Levee Rd', firebaseId: 'nZuC30zwCXsNpfLdMGrT' },
  { address: '2864 Summer Oaks Pl', firebaseId: 'g9LDNU7CJTPaLtAsxADG' },
  { address: '4843 Verne Rd', firebaseId: 'ddBnOIh5QMw2FJxULHPb' },
  { address: '14 Quail Creek Ct', firebaseId: 'Bl8RtgSLP7Wb7IqZkSUz' },
];

async function main() {
  console.log('=== SYNCING INTERESTED PROPERTIES ===\n');

  let synced = 0;
  let skipped = 0;
  let notFound = 0;

  for (const prop of interestedProperties) {
    console.log(`\n--- ${prop.address} ---`);

    // Get from agent_outreach_queue by firebaseId
    const docRef = db.collection('agent_outreach_queue').doc(prop.firebaseId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log('  ❌ NOT FOUND in agent_outreach_queue');
      notFound++;
      continue;
    }

    const property = doc.data()!;
    console.log(`  Current status: ${property.status}`);

    if (property.status === 'agent_yes') {
      console.log('  ✓ Already agent_yes, checking zillow_imports...');

      // Check if in zillow_imports
      const existing = await db.collection('zillow_imports')
        .where('originalQueueId', '==', prop.firebaseId)
        .limit(1)
        .get();

      if (!existing.empty) {
        console.log('  ✓ Already in zillow_imports, skipping');
        skipped++;
        continue;
      }
    }

    // Update to agent_yes
    await docRef.update({
      status: 'agent_yes',
      agentResponse: 'yes',
      agentResponseAt: new Date(),
      agentNote: 'Synced from GHL Interested stage',
      routedTo: 'zillow_imports',
      updatedAt: new Date(),
    });

    console.log('  ✅ Updated to agent_yes');

    // Check if already in zillow_imports
    const existingImport = await db.collection('zillow_imports')
      .where('originalQueueId', '==', prop.firebaseId)
      .limit(1)
      .get();

    if (!existingImport.empty) {
      console.log('  ✓ Already in zillow_imports');
      synced++;
      continue;
    }

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
      agentNote: 'Synced from GHL Interested stage',
      originalQueueId: prop.firebaseId,
      ownerFinanceVerified: true,
      isActive: true,
      importedAt: new Date(),
      lastStatusCheck: new Date(),
      lastScrapedAt: new Date(),
      rawData: property.rawData || null,
    });

    console.log('  ✅ Added to zillow_imports');
    synced++;
  }

  // Now remove agent_yes that are NOT in the interested list
  console.log('\n\n=== CLEANING UP STALE AGENT_YES ===\n');

  const allAgentYes = await db.collection('agent_outreach_queue')
    .where('status', '==', 'agent_yes')
    .get();

  const interestedIds = new Set(interestedProperties.map(p => p.firebaseId));
  let removed = 0;

  for (const doc of allAgentYes.docs) {
    if (!interestedIds.has(doc.id)) {
      const data = doc.data();
      console.log(`  Removing stale: ${data.address} (${doc.id})`);

      // Reset to sent_to_ghl since it's not actually confirmed
      await doc.ref.update({
        status: 'sent_to_ghl',
        agentResponse: null,
        agentResponseAt: null,
        agentNote: 'Reset - not in GHL Interested stage',
        routedTo: null,
        updatedAt: new Date(),
      });

      // Remove from zillow_imports if exists
      const imports = await db.collection('zillow_imports')
        .where('originalQueueId', '==', doc.id)
        .get();

      for (const importDoc of imports.docs) {
        console.log(`    Deleting from zillow_imports: ${importDoc.id}`);
        await importDoc.ref.delete();
      }

      removed++;
    }
  }

  console.log('\n=== SYNC COMPLETE ===');
  console.log(`Synced: ${synced}`);
  console.log(`Skipped (already done): ${skipped}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Removed stale: ${removed}`);
}

main().then(() => process.exit(0));
