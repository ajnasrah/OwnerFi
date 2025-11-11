#!/usr/bin/env tsx

/**
 * Retry stuck property videos that are in "posting" status
 *
 * This script:
 * 1. Finds all property videos stuck in "posting" status
 * 2. For each one, triggers the /api/process-video endpoint to retry
 *
 * Usage:
 *   npx tsx scripts/retry-stuck-property-videos.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function retryStuckPropertyVideos() {
  console.log('🔍 Finding stuck property videos...\n');

  try {
    // Get all property videos stuck in "posting" status
    const q = query(
      collection(db, 'property_videos'),
      where('status', '==', 'posting')
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('✅ No stuck property videos found!');
      process.exit(0);
    }

    console.log(`Found ${snapshot.size} stuck property videos\n`);
    console.log('='.repeat(70));

    for (const docSnap of snapshot.docs) {
      const workflowId = docSnap.id;
      const data = docSnap.data();

      console.log(`\n📹 Workflow: ${workflowId}`);
      console.log(`   Property: ${data.address || 'Unknown'}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Created: ${new Date(data.createdAt).toLocaleString()}`);
      console.log(`   Submagic Project ID: ${data.submagicProjectId || 'MISSING'}`);
      console.log(`   Submagic Download URL: ${data.submagicDownloadUrl ? 'YES' : 'NO'}`);
      console.log(`   Final Video URL: ${data.finalVideoUrl || 'MISSING'}`);

      // Check if we have a Submagic project ID or download URL
      if (!data.submagicProjectId && !data.submagicDownloadUrl) {
        console.log('   ⚠️  No Submagic data - cannot retry');
        continue;
      }

      // Trigger the process-video endpoint
      try {
        console.log('   🔄 Triggering /api/process-video endpoint...');

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
        const response = await fetch(`${baseUrl}/api/process-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brand: 'property',
            workflowId: workflowId,
            videoUrl: data.submagicDownloadUrl,
            submagicProjectId: data.submagicProjectId,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`   ✅ Retry triggered successfully!`);
          if (result.postId) {
            console.log(`   📱 Late Post ID: ${result.postId}`);
          }
        } else {
          const errorText = await response.text();
          console.log(`   ❌ Retry failed: ${response.status} - ${errorText}`);
        }
      } catch (error: any) {
        console.log(`   ❌ Error triggering retry: ${error.message}`);
      }

      console.log('─'.repeat(70));

      // Add a small delay between retries to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ Retry complete!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

retryStuckPropertyVideos();
