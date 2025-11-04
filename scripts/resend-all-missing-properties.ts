import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { sanitizeDescription } from '../src/lib/description-sanitizer';
import * as fs from 'fs';

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

// Load missing property IDs from CSV
function loadMissingPropertyIds(): string[] {
  const csvPath = '/Users/abdullahabunasrah/Desktop/ownerfi/missing-ghl-properties.csv';
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  // Skip header, extract Firebase IDs
  const ids = lines.slice(1)
    .map(line => line.split(',')[0])
    .filter(id => id && id.trim().length > 0);

  return ids;
}

interface SendResult {
  firebaseId: string;
  address: string;
  status: 'success' | 'failed' | 'not_found';
  statusCode?: number;
  webhookId?: string;
  error?: string;
  duration?: number;
}

async function sendPropertyToGHL(firebaseId: string, index: number, total: number): Promise<SendResult> {
  try {
    console.log(`\n[${ index + 1}/${total}] Fetching property ${firebaseId}...`);

    const doc = await db.collection('zillow_imports').doc(firebaseId).get();

    if (!doc.exists) {
      console.log(`   ❌ Not found in Firebase`);
      return {
        firebaseId,
        address: 'Unknown',
        status: 'not_found',
        error: 'Document not found',
      };
    }

    const data = doc.data();
    const address = data.fullAddress || data.streetAddress || 'Unknown';

    console.log(`   📍 ${address}`);
    console.log(`   👤 ${data.agentName} (${data.agentPhoneNumber})`);

    // Prepare webhook payload
    const webhookPayload = {
      firebase_id: firebaseId,
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
      description: sanitizeDescription(data.description || ''),
      agent_name: data.agentName || '',
      agent_phone_number: data.agentPhoneNumber || data.brokerPhoneNumber || '',
      annual_tax_amount: data.annualTaxAmount || 0,
      price: data.price || 0,
      zillow_url: data.url || data.hdpUrl || '',
      property_image: data.firstPropertyImage || '',
      broker_name: data.brokerName || '',
      broker_phone: data.brokerPhoneNumber || '',
    };

    // Send to GHL
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

    if (response.ok) {
      console.log(`   ✅ Success (${duration}ms) - Webhook ID: ${responseBody.id || 'N/A'}`);

      // Update Firebase
      await db.collection('zillow_imports').doc(firebaseId).update({
        ghlResentAt: new Date(),
        ghlResendStatus: 'success',
        ghlResendError: null,
        lastResendAttempt: new Date(),
        ghlWebhookId: responseBody.id || null,
      });

      return {
        firebaseId,
        address,
        status: 'success',
        statusCode: response.status,
        webhookId: responseBody.id,
        duration,
      };
    } else {
      console.log(`   ❌ Failed - HTTP ${response.status}`);

      await db.collection('zillow_imports').doc(firebaseId).update({
        ghlResendStatus: 'failed',
        ghlResendError: `Status ${response.status}: ${JSON.stringify(responseBody)}`,
        lastResendAttempt: new Date(),
      });

      return {
        firebaseId,
        address,
        status: 'failed',
        statusCode: response.status,
        error: JSON.stringify(responseBody),
        duration,
      };
    }
  } catch (error: any) {
    console.log(`   💥 Exception: ${error.message}`);

    try {
      await db.collection('zillow_imports').doc(firebaseId).update({
        ghlResendStatus: 'failed',
        ghlResendError: `Exception: ${error.message}`,
        lastResendAttempt: new Date(),
      });
    } catch (updateError) {
      console.log(`   ⚠️  Failed to update Firebase:`, updateError);
    }

    return {
      firebaseId,
      address: 'Unknown',
      status: 'failed',
      error: error.message,
    };
  }
}

async function resendAllMissingProperties() {
  console.log('🚀 RESENDING ALL MISSING PROPERTIES TO GHL\n');
  console.log('='.repeat(80));

  // Load missing property IDs
  console.log('📄 Loading missing properties from CSV...');
  const propertyIds = loadMissingPropertyIds();
  console.log(`   Found ${propertyIds.length} properties to send\n`);
  console.log('='.repeat(80));

  const results: SendResult[] = [];
  let successCount = 0;
  let failedCount = 0;
  let notFoundCount = 0;

  const startTime = Date.now();

  // Process in batches of 10 with progress updates
  for (let i = 0; i < propertyIds.length; i++) {
    const propertyId = propertyIds[i];

    const result = await sendPropertyToGHL(propertyId, i, propertyIds.length);
    results.push(result);

    if (result.status === 'success') {
      successCount++;
    } else if (result.status === 'failed') {
      failedCount++;
    } else {
      notFoundCount++;
    }

    // Progress update every 10 properties
    if ((i + 1) % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = ((i + 1) / (Date.now() - startTime) * 1000).toFixed(1);
      console.log(`\n📊 Progress: ${i + 1}/${propertyIds.length} (${((i + 1) / propertyIds.length * 100).toFixed(1)}%)`);
      console.log(`   ✅ Success: ${successCount} | ❌ Failed: ${failedCount} | 📭 Not Found: ${notFoundCount}`);
      console.log(`   ⏱️  Elapsed: ${elapsed}s | Rate: ${rate} props/sec`);
      console.log(`   ⏳ ETA: ${((propertyIds.length - i - 1) / parseFloat(rate)).toFixed(0)}s`);
    }

    // Rate limiting: 300ms delay between requests
    if (i < propertyIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Final summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(80));
  console.log(`\n✅ Successfully sent:  ${successCount}/${propertyIds.length} (${(successCount / propertyIds.length * 100).toFixed(1)}%)`);
  console.log(`❌ Failed to send:     ${failedCount}/${propertyIds.length} (${(failedCount / propertyIds.length * 100).toFixed(1)}%)`);
  console.log(`📭 Not found:          ${notFoundCount}/${propertyIds.length} (${(notFoundCount / propertyIds.length * 100).toFixed(1)}%)`);
  console.log(`\n⏱️  Total Duration: ${totalDuration}s`);
  console.log(`📈 Average Rate: ${(propertyIds.length / parseFloat(totalDuration)).toFixed(1)} properties/sec`);

  // Show failed properties if any
  const failedResults = results.filter(r => r.status === 'failed');
  if (failedResults.length > 0) {
    console.log(`\n\n❌ FAILED PROPERTIES (${failedResults.length}):`);
    console.log('='.repeat(80));
    failedResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.address}`);
      console.log(`   Firebase ID: ${result.firebaseId}`);
      console.log(`   Status Code: ${result.statusCode || 'N/A'}`);
      console.log(`   Error: ${result.error || 'Unknown'}`);
    });
  }

  // Export detailed results to CSV
  console.log('\n\n💾 Exporting detailed results...');
  const csvLines = [
    'Firebase ID,Address,Status,Status Code,Webhook ID,Duration (ms),Error'
  ];

  results.forEach(result => {
    csvLines.push([
      result.firebaseId,
      `"${result.address}"`,
      result.status,
      result.statusCode || '',
      result.webhookId || '',
      result.duration || '',
      `"${result.error || ''}"`,
    ].join(','));
  });

  const outputPath = '/Users/abdullahabunasrah/Desktop/ownerfi/resend-results.csv';
  fs.writeFileSync(outputPath, csvLines.join('\n'));
  console.log(`   ✅ Results saved to: ${outputPath}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ RESEND OPERATION COMPLETED');
  console.log('='.repeat(80));
  console.log('\n💡 NEXT STEPS:');
  console.log('   1. Wait 5-10 minutes for GHL to process all webhooks');
  console.log('   2. Export fresh opportunities CSV from GHL');
  console.log('   3. Run analysis script again to verify properties appeared');
  console.log('   4. Check resend-results.csv for detailed per-property status\n');

  return {
    total: propertyIds.length,
    success: successCount,
    failed: failedCount,
    notFound: notFoundCount,
    duration: parseFloat(totalDuration),
  };
}

// Run the resend
resendAllMissingProperties()
  .then((summary) => {
    console.log('🎉 Script execution completed successfully\n');
    process.exit(summary.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
