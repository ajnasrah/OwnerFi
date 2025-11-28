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
  const failed = await db.collection('scraper_queue').where('status', '==', 'failed').get();

  const errorCounts: Record<string, number> = {};
  failed.docs.forEach(doc => {
    const data = doc.data();
    const error = data.failureReason || data.error || 'No error message';
    // Truncate and normalize error messages
    const normalizedError = error.slice(0, 80);
    errorCounts[normalizedError] = (errorCounts[normalizedError] || 0) + 1;
  });

  console.log(`Total failed: ${failed.size}\n`);
  console.log('Error breakdown:');
  Object.entries(errorCounts)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .forEach(([error, count]) => {
      console.log(`  ${count}x: ${error}`);
    });

  // Show a few sample URLs
  console.log('\nSample failed URLs:');
  failed.docs.slice(0, 5).forEach(doc => {
    const data = doc.data();
    console.log(`  - ${data.url?.slice(0, 70)}...`);
    console.log(`    Error: ${data.error?.slice(0, 60) || 'none'}`);
  });
}

main().catch(console.error);
