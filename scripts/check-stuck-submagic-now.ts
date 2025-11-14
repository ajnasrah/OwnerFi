#!/usr/bin/env ts-node
/**
 * Check currently stuck SubMagic videos and diagnose issues
 */

import * as admin from 'firebase-admin';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

interface StuckVideo {
  workflowId: string;
  brand: string;
  collectionName: string;
  submagicId: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  stuckMinutes: number;
}

async function checkStuckSubmagicVideos() {
  // Initialize Firebase Admin
  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  }

  const db = getFirestore();

  if (!SUBMAGIC_API_KEY) {
    console.error('❌ SUBMAGIC_API_KEY not configured');
    process.exit(1);
  }

  const brands = ['carz', 'ownerfi', 'vassdistro', 'benefit', 'abdullah', 'personal', 'property', 'podcast'];
  const stuckVideos: StuckVideo[] = [];

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 CHECKING STUCK SUBMAGIC VIDEOS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check all brand workflow queues
  for (const brand of brands) {
    const collectionName = `${brand}_workflow_queue`;
    console.log(`\n📂 Checking ${collectionName}...`);

    try {
      const snapshot = await db.collection(collectionName)
        .where('status', '==', 'submagic_processing')
        .limit(20)
        .get();
      console.log(`   Found ${snapshot.size} in submagic_processing`);

      snapshot.forEach(doc => {
        const data = doc.data();
        const stuckMinutes = Math.round((Date.now() - (data.updatedAt || data.createdAt || 0)) / 60000);

        stuckVideos.push({
          workflowId: doc.id,
          brand,
          collectionName,
          submagicId: data.submagicVideoId || data.submagicProjectId,
          status: data.status,
          createdAt: data.createdAt || 0,
          updatedAt: data.updatedAt || 0,
          stuckMinutes
        });

        console.log(`   - ${doc.id}: ${stuckMinutes} minutes (SubMagic ID: ${data.submagicVideoId || data.submagicProjectId || 'MISSING'})`);
      });
    } catch (error) {
      console.error(`   ❌ Error querying ${brand}:`, error);
    }
  }

  // Check property_videos collection
  console.log(`\n📂 Checking property_videos...`);
  try {
    const snapshot = await db.collection('property_videos')
      .where('status', '==', 'submagic_processing')
      .limit(20)
      .get();
    console.log(`   Found ${snapshot.size} in submagic_processing`);

    snapshot.forEach(doc => {
      const data = doc.data();
      const stuckMinutes = Math.round((Date.now() - (data.updatedAt || data.createdAt || 0)) / 60000);

      stuckVideos.push({
        workflowId: doc.id,
        brand: 'property',
        collectionName: 'property_videos',
        submagicId: data.submagicVideoId || data.submagicProjectId,
        status: data.status,
        createdAt: data.createdAt || 0,
        updatedAt: data.updatedAt || 0,
        stuckMinutes
      });

      console.log(`   - ${doc.id}: ${stuckMinutes} minutes (SubMagic ID: ${data.submagicVideoId || data.submagicProjectId || 'MISSING'})`);
    });
  } catch (error) {
    console.error(`   ❌ Error querying property_videos:`, error);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 SUMMARY: ${stuckVideos.length} stuck videos found`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check SubMagic API status for each stuck video
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 CHECKING SUBMAGIC API STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const video of stuckVideos) {
    if (!video.submagicId) {
      console.log(`\n❌ ${video.brand}/${video.workflowId}: No SubMagic ID!`);
      continue;
    }

    console.log(`\n🎬 ${video.brand}/${video.workflowId} (stuck ${video.stuckMinutes}min)`);
    console.log(`   SubMagic ID: ${video.submagicId}`);

    try {
      const response = await fetch(
        `https://api.submagic.co/v1/projects/${video.submagicId}`,
        {
          headers: { 'x-api-key': SUBMAGIC_API_KEY }
        }
      );

      if (!response.ok) {
        console.log(`   ❌ API Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text().catch(() => 'Unable to read error');
        console.log(`   Error: ${errorText}`);
        continue;
      }

      const data = await response.json();
      console.log(`   Status: ${data.status}`);
      console.log(`   Progress: ${data.progress || 'N/A'}%`);

      if (data.media_url || data.video_url || data.downloadUrl || data.download_url) {
        console.log(`   ✅ Download URL available: ${data.media_url || data.video_url || data.downloadUrl || data.download_url}`);
        console.log(`   ⚠️  VIDEO IS READY BUT WEBHOOK DIDN'T FIRE!`);
      } else {
        console.log(`   ⏳ Still processing (no download URL yet)`);
      }

      if (data.error) {
        console.log(`   ❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Exception:`, error);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ DIAGNOSIS COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the check
checkStuckSubmagicVideos()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
