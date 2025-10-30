/**
 * COMPLETE Property Social Media System Diagnosis
 * Run with: npx tsx scripts/full-property-system-diagnosis.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

async function fullSystemDiagnosis() {
  console.log('🔍 COMPLETE PROPERTY SOCIAL MEDIA SYSTEM DIAGNOSIS\n');
  console.log('='.repeat(80));

  const now = Date.now();
  const issues: string[] = [];

  // ===============================================
  // STEP 1: Check property_videos collection
  // ===============================================
  console.log('\n📊 STEP 1: Checking property_videos collection...\n');

  try {
    const allVideosSnapshot = await db.collection('property_videos')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    console.log(`   Total property_videos found (last 50): ${allVideosSnapshot.size}`);

    if (allVideosSnapshot.size === 0) {
      issues.push('❌ NO property_videos documents found! Workflows are not being created at all!');
    }

    const statusCounts = {
      pending: 0,
      heygen_processing: 0,
      submagic_processing: 0,
      video_processing: 0,
      posting: 0,
      completed: 0,
      failed: 0
    };

    let oldestStuckWorkflow: any = null;
    let oldestStuckAge = 0;

    allVideosSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const status = data.status as keyof typeof statusCounts;
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }

      // Check for stuck workflows
      if (['pending', 'heygen_processing', 'submagic_processing', 'video_processing', 'posting'].includes(status)) {
        const stuckAge = now - (data.updatedAt || data.createdAt);
        if (stuckAge > oldestStuckAge) {
          oldestStuckAge = stuckAge;
          oldestStuckWorkflow = { id: doc.id, ...data, stuckHours: Math.round(stuckAge / (1000 * 60 * 60)) };
        }
      }
    });

    console.log('\n   Status breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      if (count > 0) {
        console.log(`      ${status}: ${count}`);
      }
    });

    if (oldestStuckWorkflow) {
      console.log(`\n   🚨 OLDEST STUCK WORKFLOW: ${oldestStuckWorkflow.id}`);
      console.log(`      Status: ${oldestStuckWorkflow.status}`);
      console.log(`      Stuck for: ${oldestStuckWorkflow.stuckHours} hours`);
      console.log(`      Property: ${oldestStuckWorkflow.address || 'N/A'}`);
      console.log(`      Has finalVideoUrl: ${!!oldestStuckWorkflow.finalVideoUrl}`);
      console.log(`      Has submagicProjectId: ${!!oldestStuckWorkflow.submagicProjectId}`);
      console.log(`      Has heygenVideoId: ${!!oldestStuckWorkflow.heygenVideoId}`);
      console.log(`      Retry count: ${oldestStuckWorkflow.retryCount || 0}`);
      if (oldestStuckWorkflow.error) {
        console.log(`      Error: ${oldestStuckWorkflow.error}`);
      }

      if (oldestStuckWorkflow.stuckHours > 24) {
        issues.push(`❌ Workflow stuck for ${oldestStuckWorkflow.stuckHours}h in "${oldestStuckWorkflow.status}"! Failsafe cron is NOT working!`);
      }
    }

    // Check last completed workflow
    const lastCompleted = allVideosSnapshot.docs.find(doc => doc.data().status === 'completed');
    if (lastCompleted) {
      const data = lastCompleted.data();
      const hoursAgo = Math.round((now - (data.completedAt || data.updatedAt)) / (1000 * 60 * 60));
      console.log(`\n   ✅ Last completed workflow: ${hoursAgo}h ago (${data.address || 'N/A'})`);

      if (hoursAgo > 48) {
        issues.push(`⚠️  Last completed workflow was ${hoursAgo}h ago. System may be broken!`);
      }
    } else {
      issues.push('❌ NO completed workflows found in last 50! System has never worked or is completely broken!');
    }

  } catch (error: any) {
    issues.push(`❌ Error querying property_videos: ${error.message}`);
    console.log(`   ❌ Error: ${error.message}`);
  }

  // ===============================================
  // STEP 2: Check if property video cron is creating workflows
  // ===============================================
  console.log('\n📊 STEP 2: Checking if cron is creating new workflows...\n');

  try {
    const last24h = now - (24 * 60 * 60 * 1000);
    const recentWorkflows = await db.collection('property_videos')
      .where('createdAt', '>', last24h)
      .get();

    console.log(`   Workflows created in last 24h: ${recentWorkflows.size}`);

    if (recentWorkflows.size === 0) {
      issues.push('❌ NO workflows created in last 24h! Cron is not running or failing!');
    } else if (recentWorkflows.size < 3) {
      issues.push(`⚠️  Only ${recentWorkflows.size} workflows created in 24h (expected ~5). Cron may be failing!`);
    }

  } catch (error: any) {
    console.log(`   ⚠️  Cannot query by createdAt (may need index): ${error.message}`);
  }

  // ===============================================
  // STEP 3: Check property_rotation_queue
  // ===============================================
  console.log('\n📊 STEP 3: Checking property_rotation_queue...\n');

  try {
    const queueSnapshot = await db.collection('property_rotation_queue')
      .get();

    const queueStats = {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    queueSnapshot.docs.forEach(doc => {
      const status = doc.data().status as keyof typeof queueStats;
      if (queueStats[status] !== undefined) {
        queueStats[status]++;
      }
    });

    console.log(`   Total properties in queue: ${queueSnapshot.size}`);
    console.log(`   Queued: ${queueStats.queued}`);
    console.log(`   Processing: ${queueStats.processing}`);
    console.log(`   Completed: ${queueStats.completed}`);

    if (queueStats.queued === 0 && queueStats.completed === queueSnapshot.size) {
      issues.push('⚠️  All properties in queue are "completed". Queue needs reset!');
    }

    if (queueStats.processing > 0) {
      issues.push(`❌ ${queueStats.processing} properties stuck in "processing" status! These should be auto-reset!`);
    }

  } catch (error: any) {
    issues.push(`❌ Error checking property_rotation_queue: ${error.message}`);
  }

  // ===============================================
  // STEP 4: Check for workflows stuck in specific statuses
  // ===============================================
  console.log('\n📊 STEP 4: Analyzing stuck workflows by status...\n');

  const tenMinutesAgo = now - (10 * 60 * 1000);

  for (const status of ['pending', 'heygen_processing', 'submagic_processing', 'video_processing', 'posting']) {
    try {
      // Try without index first (will work for small collections)
      const stuckDocs = await db.collection('property_videos')
        .where('status', '==', status)
        .limit(10)
        .get();

      const stuck = stuckDocs.docs.filter(doc => {
        const data = doc.data();
        return (data.updatedAt || data.createdAt) < tenMinutesAgo;
      });

      if (stuck.length > 0) {
        console.log(`\n   🚨 ${stuck.length} workflows stuck in "${status}" (>10 min):`);
        stuck.forEach(doc => {
          const data = doc.data();
          const stuckMin = Math.round((now - (data.updatedAt || data.createdAt)) / 60000);
          console.log(`      - ${doc.id}: ${stuckMin}min (retry: ${data.retryCount || 0})`);
        });

        issues.push(`❌ ${stuck.length} workflows stuck in "${status}" >10min! Failsafe is NOT working!`);
      }

    } catch (error: any) {
      console.log(`   ⚠️  Cannot check ${status} workflows: ${error.message}`);
    }
  }

  // ===============================================
  // STEP 5: Check actual property documents
  // ===============================================
  console.log('\n📊 STEP 5: Checking properties collection for workflow status...\n');

  try {
    const propertiesWithWorkflows = await db.collection('properties')
      .where('workflowStatus.stage', '!=', null)
      .limit(10)
      .get();

    console.log(`   Properties with workflowStatus: ${propertiesWithWorkflows.size}`);

    if (propertiesWithWorkflows.size > 0) {
      console.log('\n   Recent workflow statuses on properties:');
      propertiesWithWorkflows.docs.forEach(doc => {
        const data = doc.data();
        const ws = data.workflowStatus;
        if (ws) {
          const lastUpdated = ws.lastUpdated ? Math.round((now - ws.lastUpdated) / 60000) : 'N/A';
          console.log(`      - ${data.address}: ${ws.stage} (${lastUpdated}min ago)`);
        }
      });
    }

  } catch (error: any) {
    console.log(`   ⚠️  Cannot check properties workflowStatus: ${error.message}`);
  }

  // ===============================================
  // FINAL SUMMARY
  // ===============================================
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 DIAGNOSIS SUMMARY:\n');

  if (issues.length === 0) {
    console.log('   ✅ No critical issues detected! System appears healthy.');
  } else {
    console.log(`   Found ${issues.length} critical issues:\n`);
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  // ===============================================
  // RECOMMENDATIONS
  // ===============================================
  console.log('\n💡 RECOMMENDED ACTIONS:\n');

  if (issues.some(i => i.includes('NO property_videos documents'))) {
    console.log('   1. Property video system has NEVER run or collection was deleted');
    console.log('      → Check if property-video-cron is scheduled in vercel.json');
    console.log('      → Manually trigger: curl /api/property/video-cron');
  }

  if (issues.some(i => i.includes('NO workflows created in last 24h'))) {
    console.log('   2. Cron job is not creating new workflows');
    console.log('      → Check Vercel cron schedule');
    console.log('      → Check cron authentication');
    console.log('      → Manually trigger cron and check logs');
  }

  if (issues.some(i => i.includes('stuck') && i.includes('Failsafe is NOT working'))) {
    console.log('   3. Failsafe cron (/api/cron/check-stuck-posting) is broken');
    console.log('      → Deploy missing Firestore indexes');
    console.log('      → Check if cron is scheduled');
    console.log('      → Manually trigger failsafe cron');
  }

  if (issues.some(i => i.includes('All properties in queue are "completed"'))) {
    console.log('   4. Property rotation queue needs reset');
    console.log('      → Cron should auto-reset when all completed');
    console.log('      → Check queue reset logic in property-video-cron');
  }

  console.log('\n');
}

fullSystemDiagnosis().catch(console.error);
