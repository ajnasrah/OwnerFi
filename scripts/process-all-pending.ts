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

async function main() {
  console.log('🚀 Processing ALL Pending Queue Items\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.vercel.app';
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET) {
    console.log('⚠️  CRON_SECRET not found');
    return;
  }

  let totalSaved = 0;
  let totalGHL = 0;
  let totalFiltered = 0;
  let round = 0;

  while (true) {
    // Check pending count
    const pending = await db.collection('scraper_queue').where('status', '==', 'pending').get();

    if (pending.size === 0) {
      console.log('\n✅ No more pending items!\n');
      break;
    }

    round++;
    console.log(`\n📋 Round ${round}: ${pending.size} pending items`);
    console.log('⏳ Processing batch of 25...\n');

    try {
      const response = await fetch(`${BASE_URL}/api/cron/process-scraper-queue`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CRON_SECRET}`,
          'User-Agent': 'process-all/1.0'
        }
      });

      if (!response.ok) {
        console.log(`❌ Failed: ${response.status} ${response.statusText}`);
        break;
      }

      const result = await response.json();

      console.log(`✅ Round ${round} complete:`);
      console.log(`   Properties saved: ${result.metrics.propertiesSaved}`);
      console.log(`   GHL sent: ${result.metrics.ghlWebhookSuccess}`);
      console.log(`   Filtered out: ${result.metrics.validationFailed}`);

      totalSaved += result.metrics.propertiesSaved || 0;
      totalGHL += result.metrics.ghlWebhookSuccess || 0;
      totalFiltered += result.metrics.validationFailed || 0;

      // Small delay between rounds
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
      break;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('🎉 ALL PENDING ITEMS PROCESSED!\n');
  console.log(`📊 Total Results:`);
  console.log(`   ✅ Properties saved: ${totalSaved}`);
  console.log(`   📤 Sent to GHL: ${totalGHL}`);
  console.log(`   ⏭️  Filtered out: ${totalFiltered}`);
  console.log(`   🔄 Rounds: ${round}\n`);
}

main().catch(console.error);
