import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
    })
  });
}

const db = getFirestore();

async function analyze() {
  // Sample failed items to see what's happening
  const failedSample = await db.collection('scraper_queue')
    .where('status', '==', 'failed')
    .limit(20)
    .get();

  console.log('=== FAILED QUEUE ITEMS SAMPLE ===\n');
  
  const sources: { [key: string]: number } = {};
  
  failedSample.docs.forEach((doc, i) => {
    const d = doc.data();
    const source = d.source || 'unknown';
    sources[source] = (sources[source] || 0) + 1;
    
    if (i < 5) {
      console.log(`Item ${i + 1}:`);
      console.log(`  Source: ${source}`);
      console.log(`  URL: ${d.url?.substring(0, 70)}...`);
      console.log(`  Status: ${d.status}`);
      console.log(`  Retry Count: ${d.retryCount || 0}`);
      console.log(`  Added: ${d.addedAt?.toDate?.()?.toISOString() || 'N/A'}`);
      console.log('');
    }
  });

  console.log('=== SOURCES BREAKDOWN (sample of 20 failed) ===');
  Object.entries(sources).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });

  // Also check pending sources
  const pendingSample = await db.collection('scraper_queue')
    .where('status', '==', 'pending')
    .limit(50)
    .get();

  const pendingSources: { [key: string]: number } = {};
  pendingSample.docs.forEach(doc => {
    const source = doc.data().source || 'unknown';
    pendingSources[source] = (pendingSources[source] || 0) + 1;
  });

  console.log('\n=== PENDING SOURCES (sample of 50) ===');
  Object.entries(pendingSources).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });

  process.exit(0);
}
analyze();
