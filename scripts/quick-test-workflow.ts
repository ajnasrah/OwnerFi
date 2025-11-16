import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

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

/**
 * Quick test: Add 3 sample URLs to queue and trigger processor
 */

// 3 random owner financing properties from Zillow (for testing)
const TEST_URLS = [
  {
    url: 'https://www.zillow.com/homedetails/305-Raleigh-Ave-Hampton-VA-23661/74397857_zpid/',
    address: '305 Raleigh Ave, Hampton, VA 23661',
    price: '172000',
  },
  {
    url: 'https://www.zillow.com/homedetails/545-Jerry-Ln-Haines-City-FL-33844/401731336_zpid/',
    address: '545 Jerry Ln, Haines City, FL 33844',
    price: '325000',
  },
  {
    url: 'https://www.zillow.com/homedetails/4218-N-15th-Ave-Phoenix-AZ-85015/7772027_zpid/',
    address: '4218 N 15th Ave, Phoenix, AZ 85015',
    price: '449999',
  },
];

async function main() {
  console.log('🧪 QUICK TEST: Queue → Strict Filter Workflow\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Add 3 test URLs to queue
  console.log('📋 Adding 3 test URLs to scraper_queue...\n');

  let added = 0;
  let skipped = 0;

  for (const testUrl of TEST_URLS) {
    // Quick duplicate check
    const existing = await db
      .collection('scraper_queue')
      .where('url', '==', testUrl.url)
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log(`⏭️  ${testUrl.address} - already in queue`);
      skipped++;
      continue;
    }

    await db.collection('scraper_queue').add({
      url: testUrl.url,
      address: testUrl.address,
      price: testUrl.price,
      status: 'pending',
      addedAt: new Date(),
      source: 'quick_test',
    });

    console.log(`✅ ${testUrl.address} - added to queue`);
    added++;
  }

  console.log(`\n📊 Added: ${added}, Skipped: ${skipped}\n`);

  if (added === 0) {
    console.log('⚠️  All URLs already in queue. Test complete!\n');
    return;
  }

  // Trigger queue processor
  console.log('🚀 Triggering queue processor...\n');

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.vercel.app';
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET) {
    console.log('⚠️  CRON_SECRET not found.');
    return;
  }

  try {
    console.log('⏳ Processing queue (this may take 1-2 minutes)...\n');

    const response = await fetch(`${BASE_URL}/api/cron/process-scraper-queue`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'User-Agent': 'quick-test/1.0'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.log(`❌ Queue processor returned: ${response.status}`);
      console.log(`   ${text}\n`);
      return;
    }

    const result = await response.json();

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 QUEUE PROCESSOR RESULTS:\n');
    console.log(`   Queue items processed: ${result.metrics.queueItemsProcessed}`);
    console.log(`   Apify items returned: ${result.metrics.apifyItemsReturned}`);
    console.log(`   Transform succeeded: ${result.metrics.transformSucceeded}`);
    console.log(`   Validation failed: ${result.metrics.validationFailed}`);
    console.log(`   Duplicates skipped: ${result.metrics.duplicatesSkipped}`);
    console.log(`   🎯 Properties saved: ${result.metrics.propertiesSaved}`);
    console.log(`   GHL webhook success: ${result.metrics.ghlWebhookSuccess}`);
    console.log(`   GHL webhook failed: ${result.metrics.ghlWebhookFailed}\n`);

    console.log('═══════════════════════════════════════════════════════════\n');

    if (result.metrics.propertiesSaved > 0) {
      console.log('🎉 SUCCESS! Workflow is working!\n');
      console.log('✅ URLs added to queue');
      console.log('✅ Detail scraper got descriptions');
      console.log('✅ Strict filter verified owner financing keywords');
      console.log(`✅ ${result.metrics.propertiesSaved} verified properties saved`);
      console.log(`✅ ${result.metrics.ghlWebhookSuccess} sent to GHL\n`);

      // Show what got saved
      console.log('📋 Checking what got saved...\n');

      const saved = await db
        .collection('zillow_imports')
        .where('ownerFinanceVerified', '==', true)
        .orderBy('foundAt', 'desc')
        .limit(result.metrics.propertiesSaved)
        .get();

      saved.docs.forEach((doc, i) => {
        const data = doc.data();
        console.log(`   ${i + 1}. ${data.fullAddress || data.address}`);
        console.log(`      Keywords: ${data.matchedKeywords?.join(', ') || 'N/A'}`);
      });

      console.log('\n');

    } else {
      console.log('⚠️  No properties saved\n');
      console.log('   This could mean:');
      console.log('   1. None passed strict filter (no owner financing keywords)');
      console.log('   2. All were duplicates');
      console.log('   3. All failed validation\n');

      if (result.metrics.validationFailed > 0) {
        console.log(`   ${result.metrics.validationFailed} properties filtered out by strict filter`);
        console.log('   This is GOOD - it means the filter is working!\n');
      }
    }

  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
  }
}

main().catch(console.error);
