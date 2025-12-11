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

// Properties that are "Interested" in GHL but not agent_yes in Firebase
const propertiesToSync = [
  '377 Fountain Lake Dr',
  '4355 Cleopatra Rd',
];

// 665 Lancelot Ln - SOLD, skip it

async function main() {
  for (const address of propertiesToSync) {
    console.log(`\n=== Syncing: ${address} ===`);

    // Find in agent_outreach_queue
    const queue = await db.collection('agent_outreach_queue')
      .where('address', '>=', address.split(' ').slice(0, 3).join(' '))
      .where('address', '<=', address.split(' ').slice(0, 3).join(' ') + '\uf8ff')
      .limit(5)
      .get();

    if (queue.empty) {
      console.log('  NOT FOUND in agent_outreach_queue');
      continue;
    }

    const doc = queue.docs[0];
    const property = doc.data();

    console.log(`  Found: ${property.address}`);
    console.log(`  Current status: ${property.status}`);

    if (property.status === 'agent_yes') {
      console.log('  Already agent_yes, skipping');
      continue;
    }

    // Update to agent_yes
    await doc.ref.update({
      status: 'agent_yes',
      agentResponse: 'yes',
      agentResponseAt: new Date(),
      agentNote: 'Manually synced from GHL Interested stage',
      routedTo: 'zillow_imports',
      updatedAt: new Date(),
    });

    console.log('  ✅ Updated to agent_yes');

    // Add to zillow_imports
    const importData = {
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
      agentNote: 'Manually synced from GHL Interested stage',
      originalQueueId: doc.id,
      ownerFinanceVerified: true,
      isActive: true,
      importedAt: new Date(),
      lastStatusCheck: new Date(),
      lastScrapedAt: new Date(),
      rawData: property.rawData || null,
    };

    await db.collection('zillow_imports').add(importData);
    console.log('  ✅ Added to zillow_imports');
  }

  console.log('\n=== SYNC COMPLETE ===');
}

main().then(() => process.exit(0));
