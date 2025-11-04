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

// Firebase IDs of the first 5 missing properties
const MISSING_PROPERTY_IDS = [
  '0QHeRknFHBHgsQSjNKkI', // 716 N Joplin Ave, Tulsa, OK 74115
  '0fETyGfWVqW2gmvqXPnt', // 1517 Chapman St, Houston, TX 77009
  '0wfOOQJpYg8poXwgRmVs', // 2050 Egret Ave, New Braunfels, TX 78132
  '15HpTQjJktjRnx6TtwMj', // 305 N Forest Ave, Tyler, TX 75702
  '1rqiP2bNQAqVM3Rgm9Oa', // 908 Evesham Ave, Toledo, OH 43607
];

interface PropertyData {
  firebaseId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  agentPhone: string;
  brokerPhone: string;
  zpid: number;
  [key: string]: any;
}

async function sendPropertyToGHL(property: PropertyData, index: number): Promise<{
  success: boolean;
  error?: string;
  statusCode?: number;
  responseBody?: any;
}> {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📤 SENDING PROPERTY ${index + 1}/5`);
    console.log(`${'='.repeat(80)}`);
    console.log(`\n📍 Property Details:`);
    console.log(`   Address: ${property.fullAddress || property.streetAddress}`);
    console.log(`   City/State: ${property.city}, ${property.state} ${property.zipCode}`);
    console.log(`   Price: $${property.price?.toLocaleString()}`);
    console.log(`   ZPID: ${property.zpid}`);
    console.log(`   Agent Phone: ${property.agentPhoneNumber || 'N/A'}`);
    console.log(`   Broker Phone: ${property.brokerPhoneNumber || 'N/A'}`);
    console.log(`   Firebase ID: ${property.firebaseId}`);

    // Sanitize description for GHL
    const sanitizedDescription = sanitizeDescription(property.description || '');

    // Prepare webhook payload (exact same format as process-scraper-queue)
    const webhookPayload = {
      firebase_id: property.firebaseId,
      property_id: property.zpid?.toString() || '',
      full_address: property.fullAddress || '',
      street_address: property.streetAddress || '',
      city: property.city || '',
      state: property.state || '',
      zip: property.zipCode || '',
      bedrooms: property.bedrooms || 0,
      bathrooms: property.bathrooms || 0,
      square_foot: property.squareFoot || 0,
      building_type: property.buildingType || '',
      year_built: property.yearBuilt || 0,
      lot_square_foot: property.lotSquareFoot || 0,
      estimate: property.estimate || 0,
      hoa: property.hoa || 0,
      description: sanitizedDescription,
      agent_name: property.agentName || '',
      agent_phone_number: property.agentPhoneNumber || property.brokerPhoneNumber || '',
      annual_tax_amount: property.annualTaxAmount || 0,
      price: property.price || 0,
      zillow_url: property.url || property.hdpUrl || '',
      property_image: property.firstPropertyImage || '',
      broker_name: property.brokerName || '',
      broker_phone: property.brokerPhoneNumber || '',
    };

    console.log(`\n📦 Webhook Payload:`);
    console.log(JSON.stringify(webhookPayload, null, 2));

    console.log(`\n🚀 Sending to GHL webhook...`);
    console.log(`   URL: ${GHL_WEBHOOK_URL}`);

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

    console.log(`\n📥 Response Received (${duration}ms):`);
    console.log(`   Status Code: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`   Body:`, responseBody);

    if (response.ok) {
      console.log(`\n✅ SUCCESS: Property sent to GHL successfully!`);

      // Update Firebase with retry timestamp
      await db.collection('zillow_imports').doc(property.firebaseId).update({
        ghlResentAt: new Date(),
        ghlResendStatus: 'success',
        ghlResendError: null,
        lastResendAttempt: new Date(),
      });

      console.log(`   ✅ Firebase updated with resend success`);

      return {
        success: true,
        statusCode: response.status,
        responseBody,
      };
    } else {
      console.log(`\n❌ FAILED: GHL returned error status ${response.status}`);

      // Update Firebase with failure
      await db.collection('zillow_imports').doc(property.firebaseId).update({
        ghlResendStatus: 'failed',
        ghlResendError: `Status ${response.status}: ${JSON.stringify(responseBody)}`,
        lastResendAttempt: new Date(),
      });

      console.log(`   ⚠️  Firebase updated with resend failure`);

      return {
        success: false,
        error: `HTTP ${response.status}: ${JSON.stringify(responseBody)}`,
        statusCode: response.status,
        responseBody,
      };
    }
  } catch (error: any) {
    console.log(`\n💥 EXCEPTION: Error sending to GHL`);
    console.log(`   Error Type: ${error.constructor.name}`);
    console.log(`   Error Message: ${error.message}`);
    console.log(`   Stack Trace:`, error.stack);

    // Update Firebase with exception
    try {
      await db.collection('zillow_imports').doc(property.firebaseId).update({
        ghlResendStatus: 'failed',
        ghlResendError: `Exception: ${error.message}`,
        lastResendAttempt: new Date(),
      });
      console.log(`   ⚠️  Firebase updated with exception error`);
    } catch (updateError) {
      console.log(`   ❌ Failed to update Firebase:`, updateError);
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

async function resendMissingProperties() {
  console.log('🔄 RESENDING MISSING PROPERTIES TO GHL');
  console.log('='.repeat(80));
  console.log(`\nTarget: First 5 missing properties`);
  console.log(`Total to send: ${MISSING_PROPERTY_IDS.length}`);
  console.log(`\nThis script will:`);
  console.log(`  1. Fetch property data from Firebase`);
  console.log(`  2. Send to GHL webhook with detailed logging`);
  console.log(`  3. Capture all responses and errors`);
  console.log(`  4. Update Firebase with retry status`);
  console.log(`\n${'='.repeat(80)}\n`);

  const results = {
    total: MISSING_PROPERTY_IDS.length,
    success: 0,
    failed: 0,
    notFound: 0,
    details: [] as any[],
  };

  for (let i = 0; i < MISSING_PROPERTY_IDS.length; i++) {
    const firebaseId = MISSING_PROPERTY_IDS[i];

    try {
      // Fetch property from Firebase
      console.log(`\n📖 Fetching property ${i + 1}/${MISSING_PROPERTY_IDS.length} from Firebase...`);
      console.log(`   Firebase ID: ${firebaseId}`);

      const doc = await db.collection('zillow_imports').doc(firebaseId).get();

      if (!doc.exists) {
        console.log(`   ❌ Property not found in Firebase!`);
        results.notFound++;
        results.details.push({
          firebaseId,
          status: 'not_found',
          error: 'Document does not exist in Firebase',
        });
        continue;
      }

      const property = {
        firebaseId,
        ...doc.data(),
      } as PropertyData;

      console.log(`   ✅ Property found in Firebase`);

      // Send to GHL
      const result = await sendPropertyToGHL(property, i);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
      }

      results.details.push({
        firebaseId,
        address: property.fullAddress || property.streetAddress,
        status: result.success ? 'success' : 'failed',
        statusCode: result.statusCode,
        error: result.error,
        responseBody: result.responseBody,
      });

      // Rate limiting: wait 500ms between requests
      if (i < MISSING_PROPERTY_IDS.length - 1) {
        console.log(`\n⏳ Waiting 500ms before next request...\n`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error: any) {
      console.log(`\n💥 CRITICAL ERROR processing property ${firebaseId}:`);
      console.log(`   Error:`, error.message);
      results.failed++;
      results.details.push({
        firebaseId,
        status: 'error',
        error: error.message,
      });
    }
  }

  // Print final summary
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`\n✅ Successfully sent: ${results.success}/${results.total}`);
  console.log(`❌ Failed to send:    ${results.failed}/${results.total}`);
  console.log(`📭 Not found:         ${results.notFound}/${results.total}`);

  console.log(`\n\n📝 DETAILED RESULTS:\n`);
  results.details.forEach((detail, index) => {
    console.log(`${index + 1}. ${detail.address || detail.firebaseId}`);
    console.log(`   Status: ${detail.status}`);
    if (detail.statusCode) {
      console.log(`   HTTP Status: ${detail.statusCode}`);
    }
    if (detail.error) {
      console.log(`   Error: ${detail.error}`);
    }
    if (detail.responseBody) {
      console.log(`   Response:`, JSON.stringify(detail.responseBody).substring(0, 200));
    }
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('✅ Resend operation completed\n');

  return results;
}

// Run the resend
resendMissingProperties()
  .then((results) => {
    console.log('\n🎉 Script execution completed successfully');
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
