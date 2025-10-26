#!/usr/bin/env tsx

/**
 * Complete or cancel stuck HeyGen video workflows
 *
 * Usage:
 *   npx tsx scripts/complete-stuck-workflows.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface WorkflowData {
  status: string;
  propertyAddress?: string;
  heygenVideoId?: string;
  createdAt?: any;
  variant?: string;
  error?: string;
}

async function checkHeyGenVideoStatus(videoId: string): Promise<any> {
  const apiKey = process.env.HEYGEN_API_KEY;

  if (!apiKey) {
    throw new Error('HEYGEN_API_KEY not found');
  }

  const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: {
      'accept': 'application/json',
      'x-api-key': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`HeyGen API error: ${response.status}`);
  }

  return await response.json();
}

async function completeStuckWorkflows() {
  console.log('🔍 Checking for stuck HeyGen workflows...\n');

  try {
    // Get workflows stuck in heygen_processing
    const q = query(
      collection(db, 'property_video_workflows'),
      where('status', '==', 'heygen_processing'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('✅ No stuck workflows found!');
      process.exit(0);
    }

    console.log(`Found ${snapshot.size} workflows stuck in heygen_processing\n`);
    console.log('=' .repeat(60));

    for (const workflowDoc of snapshot.docs) {
      const data = workflowDoc.data() as WorkflowData;
      const workflowId = workflowDoc.id;
      const createdAt = data.createdAt?.toDate();
      const ageMinutes = createdAt ? Math.round((Date.now() - createdAt.getTime()) / 60000) : 0;

      console.log(`\nWorkflow: ${workflowId}`);
      console.log(`Property: ${data.propertyAddress || 'unknown'}`);
      console.log(`HeyGen Video ID: ${data.heygenVideoId || 'missing'}`);
      console.log(`Age: ${ageMinutes} minutes`);
      console.log(`Variant: ${data.variant || 'unknown'}`);

      if (!data.heygenVideoId) {
        console.log('⚠️  No HeyGen video ID - marking as failed');

        await updateDoc(doc(db, 'property_video_workflows', workflowId), {
          status: 'failed',
          error: 'No HeyGen video ID found',
          updatedAt: new Date()
        });

        console.log('✅ Marked as failed');
        continue;
      }

      // Check HeyGen status
      try {
        console.log('Checking HeyGen video status...');
        const heygenStatus = await checkHeyGenVideoStatus(data.heygenVideoId);

        console.log(`HeyGen Status: ${heygenStatus.data?.status || 'unknown'}`);

        if (heygenStatus.data?.status === 'completed') {
          const videoUrl = heygenStatus.data.video_url;
          console.log(`✅ Video completed! URL: ${videoUrl}`);

          // Update workflow to move to next step
          await updateDoc(doc(db, 'property_video_workflows', workflowId), {
            status: 'heygen_completed',
            heygenVideoUrl: videoUrl,
            updatedAt: new Date()
          });

          console.log('✅ Updated workflow to heygen_completed');

        } else if (heygenStatus.data?.status === 'failed') {
          console.log('❌ HeyGen video failed');

          await updateDoc(doc(db, 'property_video_workflows', workflowId), {
            status: 'failed',
            error: `HeyGen failed: ${heygenStatus.data?.error || 'unknown'}`,
            updatedAt: new Date()
          });

          console.log('✅ Marked workflow as failed');

        } else if (heygenStatus.data?.status === 'processing') {
          if (ageMinutes > 60) {
            console.log('⚠️  Video still processing after 60+ minutes - may be stuck');
            console.log('   Consider canceling and retrying');
          } else {
            console.log('⏳ Still processing - this is normal');
          }
        }

      } catch (error: any) {
        console.error(`❌ Error checking HeyGen status: ${error.message}`);

        if (ageMinutes > 60) {
          console.log('⚠️  Workflow is old (60+ min) - marking as failed');

          await updateDoc(doc(db, 'property_video_workflows', workflowId), {
            status: 'failed',
            error: `Timeout after ${ageMinutes} minutes`,
            updatedAt: new Date()
          });

          console.log('✅ Marked as failed due to timeout');
        }
      }

      console.log('─'.repeat(60));
    }

    console.log('\n✅ Check complete!');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

completeStuckWorkflows();
