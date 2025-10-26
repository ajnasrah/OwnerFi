#!/usr/bin/env tsx
/**
 * Test Benefit Video Generation End-to-End
 *
 * This script tests the complete benefit video workflow:
 * 1. Scheduler state management
 * 2. Video generation via HeyGen
 * 3. Workflow tracking
 *
 * Usage: npx tsx scripts/test-benefit-generation.ts
 */

// Load environment variables
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { BenefitScheduler } from '../src/lib/benefit-scheduler';
import { BenefitVideoGenerator } from '../src/lib/benefit-video-generator';
import { getRandomBenefit, generateBenefitCaption, generateBenefitTitle } from '../src/lib/benefit-content';
import { addBenefitWorkflow, updateBenefitWorkflow } from '../src/lib/feed-store-firestore';

async function testBenefitGeneration() {
  console.log('🧪 BENEFIT VIDEO GENERATION TEST');
  console.log('=' .repeat(70));

  try {
    // Step 1: Check scheduler state
    console.log('\n📊 Step 1: Checking scheduler state...');
    const stats = await BenefitScheduler.getStats();
    console.log(`   Date: ${stats.date}`);
    console.log(`   Videos generated today: ${stats.videosGenerated}/${stats.dailyLimit}`);
    console.log(`   Videos needed: ${stats.videosNeeded}`);
    console.log(`   Recent benefit IDs: ${stats.recentBenefitIds.join(', ') || 'none'}`);

    if (stats.videosNeeded === 0) {
      console.log('\n⚠️  Daily limit reached. Run BenefitScheduler.forceReset() to reset for testing.');
      console.log('   Or wait until tomorrow for the counter to reset automatically.\n');
      return;
    }

    // Step 2: Select a benefit
    console.log('\n🎯 Step 2: Selecting random benefit...');
    const recentIds = await BenefitScheduler.getRecentBenefitIds();
    const benefit = getRandomBenefit(recentIds);

    if (!benefit) {
      console.error('❌ No available benefits (all recently used)');
      return;
    }

    console.log(`   Selected: ${benefit.title}`);
    console.log(`   ID: ${benefit.id}`);
    console.log(`   Category: ${benefit.category}`);

    // Step 3: Claim a slot
    console.log('\n🔒 Step 3: Claiming video slot atomically...');
    const claimed = await BenefitScheduler.claimVideoSlot(benefit.id);

    if (!claimed) {
      console.error('❌ Failed to claim slot (daily limit reached during claim)');
      return;
    }

    console.log('   ✅ Slot claimed successfully');

    // Step 4: Create workflow
    console.log('\n📝 Step 4: Creating workflow...');
    const workflow = await addBenefitWorkflow(benefit.id, 'buyer', benefit.title);
    console.log(`   Workflow ID: ${workflow.id}`);
    console.log(`   Status: ${workflow.status}`);

    // Step 5: Generate video
    console.log('\n🎬 Step 5: Generating video via HeyGen...');

    const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
    if (!HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY not found in environment');
    }

    const generator = new BenefitVideoGenerator(HEYGEN_API_KEY);

    try {
      const videoId = await generator.generateVideo(benefit, workflow.id);
      console.log(`   ✅ HeyGen video ID: ${videoId}`);

      // Step 6: Update workflow
      console.log('\n📋 Step 6: Updating workflow metadata...');
      await updateBenefitWorkflow(workflow.id, {
        heygenVideoId: videoId,
        caption: generateBenefitCaption(benefit),
        title: generateBenefitTitle(benefit)
      });

      console.log('   ✅ Workflow updated with video ID and caption');

      // Step 7: Show final state
      console.log('\n📊 Step 7: Final scheduler state...');
      const finalStats = await BenefitScheduler.getStats();
      console.log(`   Videos generated: ${finalStats.videosGenerated}/${finalStats.dailyLimit}`);
      console.log(`   Videos remaining: ${finalStats.videosNeeded}`);

      console.log('\n' + '='.repeat(70));
      console.log('✅ TEST COMPLETE - Video generation initiated!');
      console.log('='.repeat(70));
      console.log('\n📌 Next steps:');
      console.log('   1. HeyGen will process the video (webhook will fire when complete)');
      console.log('   2. Webhook will upload to R2 and send to Submagic');
      console.log('   3. Submagic will add captions (webhook will fire when complete)');
      console.log('   4. Final webhook will post to Late API');
      console.log('\n💡 Monitor progress at: /admin/social-dashboard');
      console.log(`   Workflow ID: ${workflow.id}\n`);

    } catch (videoError) {
      console.error('\n❌ Video generation failed:', videoError);

      // Mark workflow as failed
      await updateBenefitWorkflow(workflow.id, {
        status: 'failed',
        error: videoError instanceof Error ? videoError.message : 'Unknown error'
      });

      throw videoError;
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
}

// Run test
testBenefitGeneration();
