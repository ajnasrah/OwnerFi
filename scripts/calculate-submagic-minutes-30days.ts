#!/usr/bin/env tsx

/**
 * Calculate total minutes of videos sent to Submagic in the last 30 days
 */

import * as dotenv from 'dotenv';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function calculateSubmagicMinutes() {
  console.log('📊 Calculating Submagic video minutes for last 30 days...\n');

  // Calculate date 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoTimestamp = thirtyDaysAgo.getTime();

  console.log(`📅 Searching from: ${thirtyDaysAgo.toISOString()}`);
  console.log(`📅 To: ${new Date().toISOString()}\n`);

  try {
    // Query cost_entries for Submagic service
    // First get all submagic entries, then filter by date in memory
    const costEntriesSnapshot = await db.collection('cost_entries')
      .where('service', '==', 'submagic')
      .get();

    console.log(`📦 Found ${costEntriesSnapshot.size} total Submagic cost entries`);

    // Filter by date in memory
    const recentEntries = costEntriesSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.timestamp >= thirtyDaysAgoTimestamp;
    });

    console.log(`📦 ${recentEntries.length} entries from last 30 days\n`);

    let totalVideos = 0;
    let totalCost = 0;
    const videosByBrand: Record<string, number> = {};
    const costByBrand: Record<string, number> = {};

    // Collect video metadata to calculate total minutes
    const videoMetadata: Array<{
      brand: string;
      timestamp: number;
      duration?: number;
      workflowId?: string;
      cost: number;
    }> = [];

    recentEntries.forEach((doc) => {
      const data = doc.data();
      const brand = data.brand || 'unknown';
      const cost = data.costUSD || 0;
      const units = data.units || 1; // Each unit = 1 video

      totalVideos += units;
      totalCost += cost;

      if (!videosByBrand[brand]) {
        videosByBrand[brand] = 0;
        costByBrand[brand] = 0;
      }
      videosByBrand[brand] += units;
      costByBrand[brand] += cost;

      videoMetadata.push({
        brand,
        timestamp: data.timestamp,
        duration: data.metadata?.duration,
        workflowId: data.workflowId,
        cost,
      });
    });

    // Now fetch actual video durations from workflows
    console.log('🔍 Fetching video durations from workflows...\n');

    const workflowIds = videoMetadata
      .map(v => v.workflowId)
      .filter((id): id is string => !!id);

    let totalDurationSeconds = 0;
    let videosWithDuration = 0;
    let videosWithoutDuration = 0;

    // Fetch workflows in batches (Firestore has a limit of 10 for 'in' queries)
    const batchSize = 10;
    for (let i = 0; i < workflowIds.length; i += batchSize) {
      const batch = workflowIds.slice(i, i + batchSize);

      if (batch.length > 0) {
        const workflowsSnapshot = await db.collection('workflows')
          .where('__name__', 'in', batch)
          .get();

        workflowsSnapshot.forEach((doc) => {
          const workflow = doc.data();

          // Try to find duration in various fields
          let duration = 0;

          if (workflow.videoDuration) {
            duration = workflow.videoDuration;
          } else if (workflow.metadata?.duration) {
            duration = workflow.metadata.duration;
          } else if (workflow.heygenResponse?.duration) {
            duration = workflow.heygenResponse.duration;
          }

          if (duration > 0) {
            totalDurationSeconds += duration;
            videosWithDuration++;
          } else {
            videosWithoutDuration++;
          }
        });
      }
    }

    // If we couldn't find durations in workflows, estimate based on average
    // Property videos are typically 30-60 seconds, let's use 45 as average
    const AVERAGE_VIDEO_DURATION_SECONDS = 45;

    if (videosWithoutDuration > 0) {
      console.log(`⚠️  ${videosWithoutDuration} videos don't have duration metadata`);
      console.log(`📊 Using average duration of ${AVERAGE_VIDEO_DURATION_SECONDS}s for missing data\n`);
      totalDurationSeconds += (videosWithoutDuration * AVERAGE_VIDEO_DURATION_SECONDS);
    }

    const totalMinutes = totalDurationSeconds / 60;
    const totalHours = totalMinutes / 60;

    // Print results
    console.log('═'.repeat(60));
    console.log('📊 SUBMAGIC USAGE - LAST 30 DAYS');
    console.log('═'.repeat(60));
    console.log(`\n🎬 Total Videos: ${totalVideos.toLocaleString()}`);
    console.log(`⏱️  Total Duration: ${totalMinutes.toFixed(2)} minutes (${totalHours.toFixed(2)} hours)`);
    console.log(`💰 Total Cost: $${totalCost.toFixed(2)}`);
    console.log(`📈 Average Cost per Video: $${(totalCost / totalVideos).toFixed(4)}`);

    if (videosWithDuration > 0) {
      const avgDuration = totalDurationSeconds / totalVideos;
      console.log(`⏰ Average Video Duration: ${avgDuration.toFixed(1)}s (${(avgDuration / 60).toFixed(2)} min)`);
    }

    console.log('\n📊 BREAKDOWN BY BRAND:');
    console.log('─'.repeat(60));

    Object.entries(videosByBrand)
      .sort(([, a], [, b]) => b - a)
      .forEach(([brand, count]) => {
        const cost = costByBrand[brand] || 0;
        const percentage = (count / totalVideos * 100).toFixed(1);
        console.log(`  ${brand.padEnd(20)} ${count.toString().padStart(4)} videos (${percentage}%)  $${cost.toFixed(2)}`);
      });

    console.log('\n' + '═'.repeat(60));
    console.log(`\n✅ Total: ${totalMinutes.toFixed(2)} minutes sent to Submagic in last 30 days`);
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error calculating Submagic minutes:', error);
    throw error;
  }
}

// Run the script
calculateSubmagicMinutes()
  .then(() => {
    console.log('✅ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
