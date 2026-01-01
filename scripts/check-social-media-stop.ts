#!/usr/bin/env tsx
/**
 * Check why social media stopped posting since Dec 18th
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

async function checkSocialMediaStop() {
  console.log('\n=== WHY DID SOCIAL MEDIA STOP ON DEC 18TH? ===\n');

  const brands = ['carz', 'ownerfi', 'vassdistro', 'abdullah', 'personal', 'gaza'];

  for (const brand of brands) {
    console.log(`\n📱 ${brand.toUpperCase()}:`);
    console.log('─'.repeat(60));

    const workflowCollection = `${brand}_workflow_queue`;

    // Get last 20 workflows to understand the pattern
    const workflowsSnapshot = await db.collection(workflowCollection)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    if (workflowsSnapshot.empty) {
      console.log('   No workflows found');
      continue;
    }

    // Find last COMPLETED workflow (actually posted)
    let lastCompleted: any = null;
    let lastCompletedDate: Date | null = null;

    // Group by status with dates
    const statusGroups: Record<string, { count: number; latestDate: Date | null; errors: string[] }> = {};

    for (const doc of workflowsSnapshot.docs) {
      const data = doc.data();
      const status = data.status || 'unknown';
      const createdAt = data.createdAt?.toDate?.() || null;
      const error = data.error || data.failureReason || '';

      if (!statusGroups[status]) {
        statusGroups[status] = { count: 0, latestDate: null, errors: [] };
      }
      statusGroups[status].count++;

      if (createdAt && (!statusGroups[status].latestDate || createdAt > statusGroups[status].latestDate)) {
        statusGroups[status].latestDate = createdAt;
      }

      if (error && !statusGroups[status].errors.includes(error.substring(0, 80))) {
        statusGroups[status].errors.push(error.substring(0, 80));
      }

      // Track last completed
      if ((status === 'completed' || status === 'posted') && !lastCompleted) {
        lastCompleted = data;
        lastCompletedDate = createdAt;
      }
    }

    // Report status distribution
    console.log('\n   Status breakdown (last 20 workflows):');
    for (const [status, info] of Object.entries(statusGroups)) {
      const dateStr = info.latestDate ? info.latestDate.toISOString().split('T')[0] : 'N/A';
      console.log(`     ${status}: ${info.count} (latest: ${dateStr})`);
      if (info.errors.length > 0) {
        console.log(`       Errors: ${info.errors.slice(0, 2).join(', ')}`);
      }
    }

    // Report last completed post
    if (lastCompletedDate) {
      const daysAgo = Math.floor((Date.now() - lastCompletedDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`\n   🎯 LAST SUCCESSFUL POST: ${lastCompletedDate.toISOString().split('T')[0]} (${daysAgo} days ago)`);
      console.log(`      Title: ${(lastCompleted?.title || lastCompleted?.articleTitle || 'N/A').substring(0, 50)}...`);
    } else {
      console.log('\n   ⚠️  No completed workflows found in recent history!');
    }

    // Check for stuck workflows
    const stuckStatuses = ['video_processing', 'heygen_processing', 'submagic_processing'];
    const stuckWorkflows = workflowsSnapshot.docs.filter(doc => {
      const status = doc.data().status;
      return stuckStatuses.includes(status);
    });

    if (stuckWorkflows.length > 0) {
      console.log(`\n   ⚠️  ${stuckWorkflows.length} workflows stuck in processing:`);
      for (const doc of stuckWorkflows.slice(0, 3)) {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.();
        const heygenVideoId = data.heygenVideoId || 'N/A';
        console.log(`      - ${data.status} since ${createdAt?.toISOString().split('T')[0] || 'N/A'}`);
        console.log(`        HeyGen ID: ${heygenVideoId}`);
      }
    }
  }

  // Check Late failures
  console.log('\n\n=== LATE POSTING FAILURES ===');
  console.log('─'.repeat(60));

  try {
    const failuresSnapshot = await db.collection('late_failures')
      .where('timestamp', '>=', new Date('2024-12-18'))
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    if (failuresSnapshot.empty) {
      console.log('No Late failures since Dec 18th');
    } else {
      console.log(`${failuresSnapshot.size} Late failures since Dec 18th:`);
      for (const doc of failuresSnapshot.docs) {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate?.();
        console.log(`\n   ${data.brand || 'unknown'} - ${timestamp?.toISOString().split('T')[0] || 'N/A'}`);
        console.log(`   Error: ${(data.error || 'N/A').substring(0, 80)}`);
      }
    }
  } catch (e: any) {
    console.log(`Error fetching Late failures: ${e.message}`);
  }

  // Check cron logs
  console.log('\n\n=== CRON LOGS ===');
  console.log('─'.repeat(60));

  try {
    const cronLogsSnapshot = await db.collection('cron_logs')
      .where('timestamp', '>=', new Date('2024-12-18'))
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    if (cronLogsSnapshot.empty) {
      console.log('No cron logs since Dec 18th');
    } else {
      console.log(`${cronLogsSnapshot.size} cron logs since Dec 18th:`);
      for (const doc of cronLogsSnapshot.docs) {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate?.();
        console.log(`\n   ${data.cronName || data.name || 'unknown'} - ${timestamp?.toISOString().split('T')[0] || 'N/A'}`);
        console.log(`   Status: ${data.status || 'N/A'}`);
        if (data.error) {
          console.log(`   Error: ${data.error.substring(0, 80)}`);
        }
      }
    }
  } catch (e: any) {
    console.log(`Error fetching cron logs: ${e.message}`);
  }

  // Check article availability
  console.log('\n\n=== ARTICLE AVAILABILITY ===');
  console.log('─'.repeat(60));

  for (const brand of brands) {
    const articlesCollection = `${brand}_articles`;

    try {
      // Check unprocessed articles with quality score >= 50
      const qualityArticles = await db.collection(articlesCollection)
        .where('processed', '==', false)
        .limit(10)
        .get();

      const highQuality = qualityArticles.docs.filter(doc => {
        const score = doc.data().qualityScore;
        return typeof score === 'number' && score >= 50;
      });

      console.log(`\n   ${brand}: ${highQuality.length} quality articles available (score >= 50)`);

      if (highQuality.length === 0) {
        console.log(`      ⚠️  NO quality articles! This is why no videos are being generated.`);

        // Show what we have
        const anyArticles = await db.collection(articlesCollection)
          .where('processed', '==', false)
          .limit(5)
          .get();

        if (!anyArticles.empty) {
          console.log(`      Unprocessed articles found, but scores are:`);
          anyArticles.docs.slice(0, 3).forEach(doc => {
            const d = doc.data();
            console.log(`        - "${(d.title || 'N/A').substring(0, 40)}..." score: ${d.qualityScore ?? 'not rated'}`);
          });
        }
      }
    } catch (e: any) {
      console.log(`   ${brand}: Error - ${e.message}`);
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('DIAGNOSIS COMPLETE');
  console.log('='.repeat(60));
}

checkSocialMediaStop().catch(console.error);
