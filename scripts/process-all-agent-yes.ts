import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

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

async function processAllAsYes() {
  console.log('\n🔄 Processing ALL sent_to_ghl properties as agent YES...\n');

  // Get all properties with sent_to_ghl status
  const snapshot = await db.collection('agent_outreach_queue')
    .where('status', '==', 'sent_to_ghl')
    .get();

  console.log(`Found ${snapshot.size} properties to process\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const doc of snapshot.docs) {
    const property = doc.data();
    const firebaseId = doc.id;

    try {
      // Route based on deal type
      if (property.dealType === 'potential_owner_finance') {
        // Add to zillow_imports
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
          agentNote: 'Bulk processed - agent confirmed via GHL',
          originalQueueId: firebaseId,

          // Metadata
          importedAt: new Date(),
          lastStatusCheck: new Date(),
          lastScrapedAt: new Date(),

          // Raw data
          rawData: property.rawData || null,
        });

        // Update queue status
        await db.collection('agent_outreach_queue').doc(firebaseId).update({
          status: 'agent_yes',
          agentResponse: 'yes',
          agentResponseAt: new Date(),
          agentNote: 'Bulk processed - agent confirmed via GHL',
          routedTo: 'zillow_imports',
          updatedAt: new Date(),
        });

        successCount++;
        console.log(`✅ ${successCount}. ${property.address}, ${property.city} → zillow_imports`);

      } else if (property.dealType === 'cash_deal') {
        // Add to cash_deals
        const discountPercent = property.priceToZestimateRatio
          ? Math.round((1 - property.priceToZestimateRatio) * 100)
          : 0;

        await db.collection('cash_deals').add({
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
          zestimate: property.zestimate || 0,
          priceToZestimateRatio: property.priceToZestimateRatio || 0,
          discountPercent: discountPercent,
          bedrooms: property.beds || 0,
          bathrooms: property.baths || 0,
          livingArea: property.squareFeet || 0,
          homeType: property.propertyType || 'SINGLE_FAMILY',
          homeStatus: 'FOR_SALE',
          agentName: property.agentName,
          agentPhoneNumber: property.agentPhone,
          agentEmail: property.agentEmail || null,
          description: property.rawData?.description || '',
          source: 'agent_outreach',
          agentConfirmedMotivated: true,
          agentConfirmedAt: new Date(),
          agentNote: 'Bulk processed - agent confirmed via GHL',
          originalQueueId: firebaseId,
          importedAt: new Date(),
          lastStatusCheck: new Date(),
          lastScrapedAt: new Date(),
          rawData: property.rawData || null,
        });

        await db.collection('agent_outreach_queue').doc(firebaseId).update({
          status: 'agent_yes',
          agentResponse: 'yes',
          agentResponseAt: new Date(),
          agentNote: 'Bulk processed - agent confirmed via GHL',
          routedTo: 'cash_deals',
          updatedAt: new Date(),
        });

        successCount++;
        console.log(`✅ ${successCount}. ${property.address}, ${property.city} → cash_deals`);
      }

    } catch (error: any) {
      errorCount++;
      console.log(`❌ Error processing ${property.address}: ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log(`🎉 DONE!`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('========================================\n');
}

processAllAsYes().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
