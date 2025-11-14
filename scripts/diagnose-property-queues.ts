#!/usr/bin/env tsx
/**
 * Diagnose Property Queue Systems
 *
 * There are THREE different collections involved:
 * 1. property_rotation_queue - The rotating queue (should have queued/processing/completed)
 * 2. property_videos - Workflow tracking (deprecated?)
 * 3. propertyShowcaseWorkflows - Actual video workflows
 *
 * This script checks all three and identifies mismatches
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function diagnose() {
  console.log('🔍 Property Queue System Diagnosis\n');
  console.log('='.repeat(70));

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    return;
  }

  // Check 1: property_rotation_queue (the main queue)
  console.log('\n📋 1. property_rotation_queue (Main Rotation Queue)');
  console.log('-'.repeat(70));

  const rotationQueue = await db.collection('property_rotation_queue').get();
  console.log(`Total entries: ${rotationQueue.size}`);

  const rotationStats: Record<string, number> = {};
  rotationQueue.docs.forEach(doc => {
    const status = doc.data().status || 'undefined';
    rotationStats[status] = (rotationStats[status] || 0) + 1;
  });
  console.log('Status breakdown:', rotationStats);

  // Show a few examples
  if (rotationQueue.size > 0) {
    console.log('\nSample entries (first 3):');
    rotationQueue.docs.slice(0, 3).forEach((doc, i) => {
      const data = doc.data();
      console.log(`  ${i + 1}. ${doc.id}`);
      console.log(`     Status: ${data.status}`);
      console.log(`     Position: ${data.position}`);
      console.log(`     Property ID: ${data.propertyId}`);
      console.log(`     Video count: ${data.videoCount || 0}`);
    });
  }

  // Check 2: property_videos (older workflow system?)
  console.log('\n\n📹 2. property_videos (Workflow Tracking)');
  console.log('-'.repeat(70));

  const propertyVideos = await db.collection('property_videos').get();
  console.log(`Total entries: ${propertyVideos.size}`);

  const videoStats: Record<string, number> = {};
  propertyVideos.docs.forEach(doc => {
    const status = doc.data().status || 'undefined';
    videoStats[status] = (videoStats[status] || 0) + 1;
  });
  console.log('Status breakdown:', videoStats);

  if (propertyVideos.size > 0) {
    console.log('\nSample entries (first 3):');
    propertyVideos.docs.slice(0, 3).forEach((doc, i) => {
      const data = doc.data();
      const age = Date.now() - (data.createdAt || 0);
      const ageHours = Math.floor(age / (1000 * 60 * 60));
      console.log(`  ${i + 1}. ${doc.id}`);
      console.log(`     Status: ${data.status}`);
      console.log(`     Property ID: ${data.propertyId}`);
      console.log(`     Created: ${ageHours}h ago`);
    });
  }

  // Check 3: propertyShowcaseWorkflows (actual HeyGen workflows)
  console.log('\n\n🎬 3. propertyShowcaseWorkflows (HeyGen Video Workflows)');
  console.log('-'.repeat(70));

  const showcaseWorkflows = await db.collection('propertyShowcaseWorkflows').get();
  console.log(`Total entries: ${showcaseWorkflows.size}`);

  const showcaseStats: Record<string, number> = {};
  showcaseWorkflows.docs.forEach(doc => {
    const status = doc.data().status || 'undefined';
    showcaseStats[status] = (showcaseStats[status] || 0) + 1;
  });
  console.log('Status breakdown:', showcaseStats);

  // Focus on pending workflows
  const pendingWorkflows = showcaseWorkflows.docs.filter(doc => doc.data().status === 'pending');
  console.log(`\n⚠️  PENDING workflows: ${pendingWorkflows.length}`);

  if (pendingWorkflows.length > 0) {
    console.log('\nFirst 10 pending workflows:');
    pendingWorkflows.slice(0, 10).forEach((doc, i) => {
      const data = doc.data();
      const age = Date.now() - (data.createdAt || 0);
      const ageHours = Math.floor(age / (1000 * 60 * 60));
      const ageMinutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
      console.log(`  ${i + 1}. ${doc.id}`);
      console.log(`     Property: ${data.propertyId}`);
      console.log(`     Age: ${ageHours}h ${ageMinutes}m`);
      console.log(`     Has HeyGen ID: ${!!data.heygenVideoId}`);
      console.log(`     Variant: ${data.variant || 'unknown'}`);
    });
  }

  // Check 4: Cross-reference to find issues
  console.log('\n\n🔍 4. Cross-Reference Analysis');
  console.log('-'.repeat(70));

  // Get all property IDs from each collection
  const rotationPropertyIds = new Set(rotationQueue.docs.map(d => d.data().propertyId));
  const videoPropertyIds = new Set(propertyVideos.docs.map(d => d.data().propertyId));
  const showcasePropertyIds = new Set(showcaseWorkflows.docs.map(d => d.data().propertyId));

  console.log(`\nUnique properties in rotation queue: ${rotationPropertyIds.size}`);
  console.log(`Unique properties in property_videos: ${videoPropertyIds.size}`);
  console.log(`Unique properties in showcase workflows: ${showcasePropertyIds.size}`);

  // Check for properties in rotation queue that have no workflows
  const rotationWithoutWorkflows = Array.from(rotationPropertyIds).filter(
    id => !showcasePropertyIds.has(id)
  );
  console.log(`\nProperties in rotation queue WITHOUT workflows: ${rotationWithoutWorkflows.length}`);
  if (rotationWithoutWorkflows.length > 0 && rotationWithoutWorkflows.length <= 5) {
    console.log('  Examples:', rotationWithoutWorkflows.slice(0, 5));
  }

  // Check for pending workflows with no rotation queue entry
  const pendingPropertyIds = pendingWorkflows.map(d => d.data().propertyId);
  const pendingWithoutQueue = pendingPropertyIds.filter(id => !rotationPropertyIds.has(id));
  console.log(`\nPending workflows WITHOUT rotation queue entry: ${pendingWithoutQueue.length}`);
  if (pendingWithoutQueue.length > 0 && pendingWithoutQueue.length <= 5) {
    console.log('  Examples:', pendingWithoutQueue.slice(0, 5));
  }

  // Summary
  console.log('\n\n📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ property_rotation_queue: ${rotationQueue.size} entries`);
  console.log(`   - ${rotationStats['queued'] || 0} queued`);
  console.log(`   - ${rotationStats['processing'] || 0} processing`);
  console.log(`   - ${rotationStats['completed'] || 0} completed`);
  console.log();
  console.log(`📹 property_videos: ${propertyVideos.size} entries`);
  console.log(`   - ${videoStats['pending'] || 0} pending`);
  console.log(`   - ${videoStats['completed'] || 0} completed`);
  console.log();
  console.log(`🎬 propertyShowcaseWorkflows: ${showcaseWorkflows.size} entries`);
  console.log(`   - ${showcaseStats['pending'] || 0} PENDING ⚠️`);
  console.log(`   - ${showcaseStats['heygen_processing'] || 0} heygen_processing`);
  console.log(`   - ${showcaseStats['completed'] || 0} completed`);
  console.log(`   - ${showcaseStats['failed'] || 0} failed`);

  if (showcaseStats['pending'] > 0) {
    console.log('\n⚠️  ISSUE DETECTED: 30+ pending workflows stuck!');
    console.log('   This suggests workflows were created but never picked up by the processing pipeline.');
    console.log('\n💡 Possible causes:');
    console.log('   1. HeyGen API calls failing silently');
    console.log('   2. Worker process not picking up pending workflows');
    console.log('   3. Webhook callbacks not being received');
  }
}

diagnose().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
