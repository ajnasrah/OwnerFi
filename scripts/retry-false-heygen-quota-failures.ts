#!/usr/bin/env tsx
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const BRANDS = ['carz', 'ownerfi', 'benefit', 'abdullah', 'gaza'];

async function main() {
  console.log('🔍 Finding false HeyGen quota failures...\n');

  let totalFound = 0;
  let totalRetried = 0;

  for (const brand of BRANDS) {
    try {
      const collectionName = `${brand}_workflow_queue`;
      const snapshot = await db.collection(collectionName).where('status', '==', 'failed').limit(50).get();

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const error = data.error || '';

        if (error.includes('HeyGen quota insufficient') || error.includes('0 credits remaining')) {
          totalFound++;
          console.log(`🔧 Retrying ${brand}/${doc.id.substring(0, 25)}...`);

          await doc.ref.update({
            status: 'pending',
            error: null,
            retriedAt: new Date(),
            retryReason: 'HeyGen quota API bug fixed',
          });

          totalRetried++;
          console.log(`   ✅ Reset\n`);
          await new Promise(r => setTimeout(r, 100));
        }
      }
    } catch (e) {}
  }

  console.log(`\n✅ Reset ${totalRetried}/${totalFound} workflows\n`);
}

main().catch(console.error);
