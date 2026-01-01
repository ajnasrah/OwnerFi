#!/usr/bin/env tsx
/**
 * Check actual workflow documents (not dedup docs)
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
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

async function check() {
  const brands = ['carz', 'ownerfi', 'vassdistro', 'abdullah', 'gaza'];

  for (const brand of brands) {
    console.log(`\n=== ${brand.toUpperCase()} ===`);

    const collection = `${brand}_workflow_queue`;

    // Get ALL docs in the collection to understand the structure
    const allDocs = await db.collection(collection)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    let actualWorkflows = 0;
    let dedupDocs = 0;
    let stuckWorkflows: any[] = [];

    for (const doc of allDocs.docs) {
      const id = doc.id;
      const data = doc.data();

      if (id.startsWith('dedup_')) {
        dedupDocs++;
        continue;
      }

      actualWorkflows++;

      if (data.status === 'video_processing') {
        stuckWorkflows.push({
          id,
          heygenVideoUrl: data.heygenVideoUrl,
          submagicDownloadUrl: data.submagicDownloadUrl,
          finalVideoUrl: data.finalVideoUrl,
          submagicProjectId: data.submagicProjectId || data.submagicVideoId,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        });
      }
    }

    console.log(`  Total docs: ${allDocs.size}`);
    console.log(`  Actual workflows: ${actualWorkflows}`);
    console.log(`  Dedup docs: ${dedupDocs}`);
    console.log(`  Stuck in video_processing: ${stuckWorkflows.length}`);

    if (stuckWorkflows.length > 0) {
      console.log('\n  Stuck workflows:');
      for (const w of stuckWorkflows.slice(0, 3)) {
        console.log(`    - ${w.id}`);
        console.log(`      Created: ${w.createdAt}`);
        console.log(`      Has heygenVideoUrl: ${!!w.heygenVideoUrl}`);
        console.log(`      Has submagicDownloadUrl: ${!!w.submagicDownloadUrl}`);
        console.log(`      Has submagicProjectId: ${!!w.submagicProjectId}`);
      }
    }
  }
}

check().catch(console.error);
