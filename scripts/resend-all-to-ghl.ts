import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
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
const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/2be65188-9b2e-43f1-a9d8-33d9907b375c';

async function resendAllPropertiesToGHL() {
  console.log('\n🚀 Starting to resend ALL properties to GHL webhook\n');

  try {
    // Get ALL properties that were previously sent to GHL (both success and failed)
    const snapshot = await db
      .collection('zillow_imports')
      .where('sentToGHL', '==', true)
      .get();

    console.log(`📊 Found ${snapshot.size} properties that were previously sent to GHL\n`);

    if (snapshot.empty) {
      console.log('❌ No properties found that were sent to GHL');
      return;
    }

    const properties = snapshot.docs.map(doc => ({
      id: doc.id,
      ref: doc.ref,
      ...doc.data(),
    }));

    // Filter for properties with contact info (agent OR broker phone)
    const propertiesWithContact = properties.filter(
      (prop: any) => prop.agentPhoneNumber || prop.brokerPhoneNumber
    );

    console.log(`📋 ${propertiesWithContact.length} properties have contact information\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    for (const property of propertiesWithContact) {
      const data: any = property;

      try {
        // Prepare webhook payload with CORRECT name field and phone fallback
        const webhookData = {
          firebase_id: data.id || '',
          property_id: data.zpid || '',
          full_address: data.fullAddress || '',
          street_address: data.streetAddress || '',
          city: data.city || '',
          state: data.state || '',
          zip: data.zipCode || '',
          bedrooms: data.bedrooms || 0,
          bathrooms: data.bathrooms || 0,
          square_foot: data.squareFoot || 0,
          building_type: data.buildingType || data.homeType || '',
          year_built: data.yearBuilt || 0,
          lot_square_foot: data.lotSquareFoot || 0,
          estimate: data.estimate || 0,
          hoa: data.hoa || 0,
          description: data.description || '',
          agent_name: data.agentName || '',
          // FALLBACK: If no agent phone, use broker phone
          agent_phone_number: data.agentPhoneNumber || data.brokerPhoneNumber || '',
          annual_tax_amount: data.annualTaxAmount || 0,
          price: data.price || 0,
          zillow_url: data.url || '',
          property_image: data.firstPropertyImage || '',
          broker_name: data.brokerName || '',
          broker_phone: data.brokerPhoneNumber || '',
        };

        console.log(`📤 Sending: ${webhookData.full_address}`);
        console.log(`   Agent: ${webhookData.agent_name || 'N/A'}`);
        console.log(`   Phone: ${webhookData.agent_phone_number || 'N/A'}`);

        // POST to GHL webhook
        const response = await fetch(GHL_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookData),
        });

        if (!response.ok) {
          const responseText = await response.text();
          throw new Error(`Webhook returned ${response.status}: ${responseText}`);
        }

        successCount++;
        console.log(`✅ Success!\n`);

        // Update Firebase with new send status
        await data.ref.update({
          sentToGHL: true,
          ghlSentAt: new Date(),
          ghlSendStatus: 'success',
          ghlSendError: null,
          resentToGHL: true,
          resentAt: new Date(),
        });

        // Small delay to avoid overwhelming the webhook
        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error: any) {
        errorCount++;
        errors.push({
          property: data.fullAddress || data.streetAddress || 'Unknown',
          zpid: data.zpid,
          error: error.message,
        });
        console.error(`❌ Error: ${error.message}\n`);

        // Update Firebase with failure status
        await data.ref.update({
          ghlSendStatus: 'failed',
          ghlSendError: error.message,
          resentToGHL: true,
          resentAt: new Date(),
        });
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 FINAL SUMMARY:`);
    console.log(`   Total Properties: ${propertiesWithContact.length}`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (errors.length > 0) {
      console.log('\n🔍 ERRORS:\n');
      errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err.property} (ZPID: ${err.zpid})`);
        console.log(`   Error: ${err.error}\n`);
      });
    }

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    throw error;
  }
}

// Run the script
resendAllPropertiesToGHL()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
