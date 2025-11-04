import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '../src/lib/description-sanitizer';

// Initialize Firebase Admin
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('Missing Firebase credentials in environment variables');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = getFirestore(app);

// GHL Webhook URL
const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/U2B5lSlWrVBgVxHNq5AH/webhook-trigger/2be65188-9b2e-43f1-a9d8-33d9907b375c';

// Richard Breeze property
const PROPERTY_ID = '15HpTQjJktjRnx6TtwMj';

async function resendRichardBreezeProperty() {
  console.log('🔄 RESENDING RICHARD BREEZE PROPERTY\n');
  console.log('='.repeat(80));
  console.log('Target: 305 N Forest Ave, Tyler, TX 75702');
  console.log('Agent: Richard Breeze (214-502-9887)');
  console.log('Firebase ID:', PROPERTY_ID);
  console.log('='.repeat(80) + '\n');

  try {
    // Fetch property from Firebase
    console.log('📖 Fetching property from Firebase...');
    const doc = await db.collection('zillow_imports').doc(PROPERTY_ID).get();

    if (!doc.exists) {
      console.log('❌ Property not found in Firebase!');
      process.exit(1);
    }

    const data = doc.data();
    console.log('✅ Property found in Firebase\n');

    // Display full property details
    console.log('📍 FULL PROPERTY DETAILS:');
    console.log('='.repeat(80));
    console.log(`Address:        ${data.fullAddress}`);
    console.log(`Street:         ${data.streetAddress}`);
    console.log(`City:           ${data.city}`);
    console.log(`State:          ${data.state}`);
    console.log(`Zip:            ${data.zipCode}`);
    console.log(`ZPID:           ${data.zpid}`);
    console.log(`Price:          $${data.price?.toLocaleString()}`);
    console.log(`Bedrooms:       ${data.bedrooms}`);
    console.log(`Bathrooms:      ${data.bathrooms}`);
    console.log(`Square Feet:    ${data.squareFoot}`);
    console.log(`Year Built:     ${data.yearBuilt}`);
    console.log(`Lot Size:       ${data.lotSquareFoot} sqft`);
    console.log(`Building Type:  ${data.buildingType}`);
    console.log(`Agent Name:     ${data.agentName}`);
    console.log(`Agent Phone:    ${data.agentPhoneNumber}`);
    console.log(`Agent Email:    ${data.agentEmail || 'N/A'}`);
    console.log(`Broker Name:    ${data.brokerName}`);
    console.log(`Broker Phone:   ${data.brokerPhoneNumber || 'N/A'}`);
    console.log(`Estimate:       $${data.estimate?.toLocaleString() || 'N/A'}`);
    console.log(`HOA:            $${data.hoa || 0}`);
    console.log(`Annual Tax:     $${data.annualTaxAmount?.toLocaleString() || 'N/A'}`);
    console.log(`Description:    ${data.description?.length || 0} characters`);
    console.log(`Images:         ${data.photoCount || 0} photos`);
    console.log(`Primary Image:  ${data.firstPropertyImage ? 'Yes' : 'No'}`);
    console.log(`Zillow URL:     ${data.url || data.hdpUrl}`);
    console.log('='.repeat(80) + '\n');

    // Sanitize description
    const sanitizedDescription = sanitizeDescription(data.description || '');

    // Prepare webhook payload
    const webhookPayload = {
      firebase_id: PROPERTY_ID,
      property_id: data.zpid?.toString() || '',
      full_address: data.fullAddress || '',
      street_address: data.streetAddress || '',
      city: data.city || '',
      state: data.state || '',
      zip: data.zipCode || '',
      bedrooms: data.bedrooms || 0,
      bathrooms: data.bathrooms || 0,
      square_foot: data.squareFoot || 0,
      building_type: data.buildingType || '',
      year_built: data.yearBuilt || 0,
      lot_square_foot: data.lotSquareFoot || 0,
      estimate: data.estimate || 0,
      hoa: data.hoa || 0,
      description: sanitizedDescription,
      agent_name: data.agentName || '',
      agent_phone_number: data.agentPhoneNumber || data.brokerPhoneNumber || '',
      annual_tax_amount: data.annualTaxAmount || 0,
      price: data.price || 0,
      zillow_url: data.url || data.hdpUrl || '',
      property_image: data.firstPropertyImage || '',
      broker_name: data.brokerName || '',
      broker_phone: data.brokerPhoneNumber || '',
    };

    console.log('📦 WEBHOOK PAYLOAD:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(webhookPayload, null, 2));
    console.log('='.repeat(80) + '\n');

    console.log('🚀 Sending to GHL webhook...');
    console.log(`URL: ${GHL_WEBHOOK_URL}\n`);

    // Send to GHL webhook
    const startTime = Date.now();
    const response = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    const duration = Date.now() - startTime;
    const responseText = await response.text();
    let responseBody;

    try {
      responseBody = JSON.parse(responseText);
    } catch (e) {
      responseBody = responseText;
    }

    console.log('📥 GHL RESPONSE:');
    console.log('='.repeat(80));
    console.log(`Status Code:    ${response.status} ${response.statusText}`);
    console.log(`Duration:       ${duration}ms`);
    console.log(`Response Body:  ${JSON.stringify(responseBody, null, 2)}`);
    console.log('\nResponse Headers:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    console.log('='.repeat(80) + '\n');

    if (response.ok) {
      console.log('✅ SUCCESS: Webhook accepted by GHL!');
      console.log(`\nGHL Webhook ID: ${responseBody.id || 'N/A'}`);
      console.log(`GHL Status: ${responseBody.status || 'N/A'}\n`);

      // Update Firebase
      await db.collection('zillow_imports').doc(PROPERTY_ID).update({
        ghlResentAt: new Date(),
        ghlResendStatus: 'success',
        ghlResendError: null,
        lastResendAttempt: new Date(),
        ghlWebhookId: responseBody.id || null,
      });

      console.log('✅ Firebase updated with resend timestamp\n');

      console.log('='.repeat(80));
      console.log('📋 NEXT STEPS:');
      console.log('='.repeat(80));
      console.log('1. Wait 1-2 minutes for GHL to process the webhook');
      console.log('2. Search GHL for:');
      console.log(`   • Contact: Richard Breeze`);
      console.log(`   • Phone: 214-502-9887 or +12145029887`);
      console.log(`   • Webhook ID: ${responseBody.id || 'N/A'}`);
      console.log('3. Check which property address is showing:');
      console.log(`   • NEW: 305 N Forest Ave, Tyler, TX 75702 ($179,900)`);
      console.log(`   • OLD: 9161 Cave Branch Cv, Tyler, TX 75703 ($479,000)`);
      console.log('4. If OLD property still shows, this confirms GHL is rejecting');
      console.log('   duplicates based on phone number');
      console.log('='.repeat(80) + '\n');

    } else {
      console.log('❌ FAILED: GHL returned error status');
      console.log(`Error: ${response.status} - ${JSON.stringify(responseBody)}\n`);

      // Update Firebase with failure
      await db.collection('zillow_imports').doc(PROPERTY_ID).update({
        ghlResendStatus: 'failed',
        ghlResendError: `Status ${response.status}: ${JSON.stringify(responseBody)}`,
        lastResendAttempt: new Date(),
      });

      console.log('⚠️  Firebase updated with failure status\n');
    }

    console.log('✅ Script completed successfully\n');

  } catch (error: any) {
    console.error('💥 ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run
resendRichardBreezeProperty()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
