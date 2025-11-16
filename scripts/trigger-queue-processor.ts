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
  const pending = await db.collection('scraper_queue').where('status', '==', 'pending').get();
  console.log(`Pending items in queue: ${pending.size}\n`);

  if (pending.size > 0) {
    console.log('Sample pending items:');
    pending.docs.slice(0, 5).forEach((doc: any, i: number) => {
      const data = doc.data();
      console.log(`  ${i + 1}. ${data.address} (${data.source})`);
    });

    // Trigger queue processor
    console.log('\n🚀 Triggering queue processor...\n');

    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.vercel.app';
    const CRON_SECRET = process.env.CRON_SECRET;

    if (!CRON_SECRET) {
      console.log('⚠️  CRON_SECRET not found');
      return;
    }

    const response = await fetch(`${BASE_URL}/api/cron/process-scraper-queue`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'User-Agent': 'test/1.0'
      }
    });

    console.log(`📊 Response: ${response.status} ${response.statusText}\n`);

    if (response.ok) {
      const result = await response.json();
      console.log('Results:');
      console.log(`  Properties saved: ${result.metrics.propertiesSaved}`);
      console.log(`  GHL sent: ${result.metrics.ghlWebhookSuccess}`);
      console.log(`  Filtered out: ${result.metrics.validationFailed}\n`);
    }
  } else {
    console.log('No pending items in queue\n');
  }
}

main().catch(console.error);
