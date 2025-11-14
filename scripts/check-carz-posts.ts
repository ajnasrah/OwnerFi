#!/usr/bin/env ts-node
/**
 * Check Carz posting activity in last 24 hours
 */

import * as admin from 'firebase-admin';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function checkCarzPosts() {
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
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚗 CARZ INC POSTING ACTIVITY (Last 24h)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check completed workflows in last 24h
  const completedSnapshot = await db.collection('carz_workflow_queue')
    .where('completedAt', '>=', twentyFourHoursAgo)
    .orderBy('completedAt', 'desc')
    .get();

  console.log(`✅ Completed workflows: ${completedSnapshot.size}`);
  completedSnapshot.forEach(doc => {
    const data = doc.data();
    const completedDate = new Date(data.completedAt);
    console.log(`   - ${doc.id}`);
    console.log(`     Completed: ${completedDate.toISOString()}`);
    console.log(`     Title: ${data.title || data.articleTitle || 'N/A'}`);
    console.log(`     Late Post ID: ${data.latePostId || 'N/A'}`);
  });

  // Check posting status workflows
  const postingSnapshot = await db.collection('carz_workflow_queue')
    .where('status', '==', 'posting')
    .limit(10)
    .get();

  console.log(`\n📤 Currently in posting status: ${postingSnapshot.size}`);
  postingSnapshot.forEach(doc => {
    const data = doc.data();
    const updatedDate = new Date(data.updatedAt || data.createdAt);
    const stuckMinutes = Math.round((Date.now() - (data.updatedAt || data.createdAt || 0)) / 60000);
    console.log(`   - ${doc.id} (stuck ${stuckMinutes} minutes)`);
    console.log(`     Updated: ${updatedDate.toISOString()}`);
    console.log(`     Video URL: ${data.finalVideoUrl ? 'Yes' : 'No'}`);
  });

  // Check pending workflows
  const pendingSnapshot = await db.collection('carz_workflow_queue')
    .where('status', '==', 'pending')
    .limit(10)
    .get();

  console.log(`\n⏳ Pending workflows: ${pendingSnapshot.size}`);
  pendingSnapshot.forEach(doc => {
    const data = doc.data();
    const createdDate = new Date(data.createdAt);
    const waitMinutes = Math.round((Date.now() - (data.createdAt || 0)) / 60000);
    console.log(`   - ${doc.id} (waiting ${waitMinutes} minutes)`);
    console.log(`     Created: ${createdDate.toISOString()}`);
  });

  // Check video_processing status
  const videoProcessingSnapshot = await db.collection('carz_workflow_queue')
    .where('status', '==', 'video_processing')
    .limit(10)
    .get();

  console.log(`\n🎬 Video processing workflows: ${videoProcessingSnapshot.size}`);
  videoProcessingSnapshot.forEach(doc => {
    const data = doc.data();
    const updatedDate = new Date(data.updatedAt || data.createdAt);
    const stuckMinutes = Math.round((Date.now() - (data.updatedAt || data.createdAt || 0)) / 60000);
    console.log(`   - ${doc.id} (stuck ${stuckMinutes} minutes)`);
    console.log(`     Updated: ${updatedDate.toISOString()}`);
    console.log(`     SubMagic URL: ${data.submagicDownloadUrl ? 'Yes' : 'No'}`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Completed (24h): ${completedSnapshot.size}`);
  console.log(`Stuck in posting: ${postingSnapshot.size}`);
  console.log(`Stuck in video_processing: ${videoProcessingSnapshot.size}`);
  console.log(`Waiting in pending: ${pendingSnapshot.size}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (completedSnapshot.size < 5) {
    console.log('⚠️  WARNING: Only', completedSnapshot.size, 'posts completed in last 24h');
    console.log('   Expected: 5 posts per day for Carz Inc');
    console.log('\n💡 Possible causes:');
    console.log('   1. Workflows stuck in video_processing or posting');
    console.log('   2. Not enough pending workflows being created');
    console.log('   3. Cron job not triggering pending workflows');
  }
}

// Run the check
checkCarzPosts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
