import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = getFirestore(app);

console.log('\n🧹 Cleaning up stuck jobs...\n');

// Get all jobs stuck in "scraping" status with 0% progress
const snapshot = await db
  .collection('scraper_jobs')
  .where('status', '==', 'scraping')
  .where('progress', '==', 0)
  .get();

console.log(`Found ${snapshot.size} stuck jobs`);

let updated = 0;

for (const doc of snapshot.docs) {
  const data = doc.data();
  const startedAt = data.startedAt?.toDate();
  const now = new Date();
  const ageMinutes = (now - startedAt) / 1000 / 60;

  // Only mark as error if older than 10 minutes
  if (ageMinutes > 10) {
    await doc.ref.update({
      status: 'error',
      error: 'Function killed by Vercel before completion (old bug, now fixed)',
    });
    updated++;
    console.log(`✓ Marked ${doc.id} as error (${ageMinutes.toFixed(0)} min old)`);
  } else {
    console.log(`  Skipping ${doc.id} (only ${ageMinutes.toFixed(0)} min old, might still be running)`);
  }
}

console.log(`\n✅ Updated ${updated} stuck jobs`);

process.exit(0);
