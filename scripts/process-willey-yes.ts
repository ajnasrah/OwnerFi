import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function processWilleyYes() {
  const firebaseId = '7ncgg838VFhdSEwwpNN2';

  console.log(`\n🔄 Processing agent YES for property ${firebaseId}...\n`);

  // Get property from agent_outreach_queue
  const docRef = db.collection('agent_outreach_queue').doc(firebaseId);
  const doc = await docRef.get();

  if (!doc.exists) {
    console.log('❌ Property not found');
    return;
  }

  const property = doc.data()!;
  console.log(`✅ Found property: ${property.address}`);
  console.log(`   Deal Type: ${property.dealType}`);

  // Since it's potential_owner_finance, add to zillow_imports
  if (property.dealType === 'potential_owner_finance') {
    console.log('\n📥 Adding to zillow_imports...');

    await db.collection('zillow_imports').add({
      // Core identifiers
      zpid: property.zpid,
      url: property.url,

      // Address
      address: property.address || '',
      streetAddress: property.address || '',
      fullAddress: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
      city: property.city || '',
      state: property.state || '',
      zipCode: property.zipCode || '',

      // Pricing
      price: property.price || 0,
      listPrice: property.price || 0,
      zestimate: property.zestimate || null,

      // Property details
      bedrooms: property.beds || 0,
      bathrooms: property.baths || 0,
      livingArea: property.squareFeet || 0,
      homeType: property.propertyType || 'SINGLE_FAMILY',
      homeStatus: 'FOR_SALE',

      // Agent info
      agentName: property.agentName,
      agentPhoneNumber: property.agentPhone,
      agentEmail: property.agentEmail || null,

      // Description
      description: property.rawData?.description || '',

      // Financing Type Status
      financingType: 'Owner Finance',
      allFinancingTypes: ['Owner Finance'],
      financingTypeLabel: 'Owner Finance',

      // Source tracking
      source: 'agent_outreach',
      agentConfirmedOwnerFinance: true,
      agentConfirmedAt: new Date(),
      agentNote: 'Manually processed - webhook response was missed',
      originalQueueId: firebaseId,

      // Metadata
      importedAt: new Date(),
      lastStatusCheck: new Date(),
      lastScrapedAt: new Date(),

      // Full raw data for reference
      rawData: property.rawData || null,
    });

    console.log('✅ Added to zillow_imports');

    // Update agent_outreach_queue
    await docRef.update({
      status: 'agent_yes',
      agentResponse: 'yes',
      agentResponseAt: new Date(),
      agentNote: 'Manually processed - webhook response was missed',
      routedTo: 'zillow_imports',
      updatedAt: new Date(),
    });

    console.log('✅ Updated agent_outreach_queue status');
  }

  console.log('\n🎉 Done! Property is now in zillow_imports and will show on the website.');
}

processWilleyYes().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
