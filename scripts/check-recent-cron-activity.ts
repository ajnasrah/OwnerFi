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

async function main() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log('=== CHECKING CRON ACTIVITY IN LAST 24H ===\n');
  console.log('Current time:', now.toISOString());
  console.log('Checking since:', oneDayAgo.toISOString());
  console.log('');

  // Check zillow_imports for recent additions (process-scraper-queue runs hourly)
  const recentImports = await db.collection('zillow_imports')
    .where('foundAt', '>', oneDayAgo)
    .orderBy('foundAt', 'desc')
    .limit(5)
    .get();

  console.log('=== zillow_imports (last 24h) ===');
  console.log('Count:', recentImports.size);
  recentImports.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${d.foundAt?.toDate?.().toISOString()} - ${d.fullAddress?.substring(0, 40)}`);
  });

  // Check agent_outreach_queue (runs 3x daily)
  const recentOutreach = await db.collection('agent_outreach_queue')
    .where('addedAt', '>', oneDayAgo)
    .orderBy('addedAt', 'desc')
    .limit(5)
    .get();

  console.log('\n=== agent_outreach_queue (last 24h) ===');
  console.log('Count:', recentOutreach.size);
  recentOutreach.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${d.addedAt?.toDate?.().toISOString()} - ${d.address?.substring(0, 40)}`);
  });

  // Check scraper_queue recent additions
  const recentQueue = await db.collection('scraper_queue')
    .where('addedAt', '>', oneDayAgo)
    .orderBy('addedAt', 'desc')
    .limit(5)
    .get();

  console.log('\n=== scraper_queue (last 24h) ===');
  console.log('Count:', recentQueue.size);
  recentQueue.docs.forEach(doc => {
    const d = doc.data();
    console.log(`  ${d.addedAt?.toDate?.().toISOString()} - ${d.source} - ${d.address?.substring(0, 30)}`);
  });

  // Check refresh status activity (runs hourly)
  const recentRefresh = await db.collection('zillow_imports')
    .where('lastStatusCheck', '>', oneDayAgo)
    .orderBy('lastStatusCheck', 'desc')
    .limit(5)
    .get();

  console.log('\n=== zillow_imports with status check (last 24h) ===');
  console.log('Count:', recentRefresh.size);
}

main().then(() => process.exit(0));
