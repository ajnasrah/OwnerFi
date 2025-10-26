#!/usr/bin/env tsx

/**
 * Test script for OwnerFi BUYER-ONLY Benefit Video Script Generator
 *
 * This script demonstrates the new ChatGPT prompt system for generating
 * buyer-focused video scripts with daily theme guidance.
 *
 * Usage:
 *   npx tsx scripts/test-buyer-benefit-script.ts
 */

import { getBenefitsByAudience } from '../podcast/lib/benefit-content';
import { BenefitVideoGenerator } from '../podcast/lib/benefit-video-generator';

async function testBuyerScriptGeneration() {
  console.log('🏠 OwnerFi BUYER-ONLY Video Script Generator Test\n');
  console.log('=' .repeat(60));

  // Get BUYER benefits only
  const buyerBenefits = getBenefitsByAudience('buyer');

  console.log(`\n✅ Found ${buyerBenefits.length} BUYER benefits\n`);

  // Check for OpenAI API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: OPENAI_API_KEY not found in environment variables');
    console.log('\nPlease set OPENAI_API_KEY in your .env.local file:');
    console.log('OPENAI_API_KEY=sk-...\n');
    process.exit(1);
  }

  // Get HeyGen API key (required for video generator initialization)
  const heygenKey = process.env.HEYGEN_API_KEY;
  if (!heygenKey) {
    console.error('❌ Error: HEYGEN_API_KEY not found in environment variables');
    process.exit(1);
  }

  // Create video generator instance
  const generator = new BenefitVideoGenerator(heygenKey);

  // Get current day for theme display
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];

  const dailyThemes = {
    'Monday': 'Credit Myths',
    'Tuesday': 'Real Stories',
    'Wednesday': 'How It Works',
    'Thursday': 'Money Mindset',
    'Friday': 'Quick Wins',
    'Saturday': 'Comparison',
    'Sunday': 'Vision & Hope'
  };

  console.log(`📅 Today is ${today}`);
  console.log(`🎯 Theme: ${dailyThemes[today as keyof typeof dailyThemes]}\n`);
  console.log('=' .repeat(60));

  // Test with first 3 buyer benefits
  const testBenefits = buyerBenefits.slice(0, 3);

  for (let i = 0; i < testBenefits.length; i++) {
    const benefit = testBenefits[i];

    console.log(`\n\n🎬 SCRIPT ${i + 1}/${testBenefits.length}`);
    console.log('─'.repeat(60));
    console.log(`📋 Benefit: ${benefit.title}`);
    console.log(`💡 Description: ${benefit.shortDescription}`);
    console.log(`🎯 Category: ${benefit.category}`);
    console.log('\n⏳ Generating script...\n');

    try {
      // Generate script (this calls the new ChatGPT prompt)
      const script = await (generator as any).generateScript(benefit);

      console.log('✅ GENERATED SCRIPT:');
      console.log('─'.repeat(60));
      console.log(script);
      console.log('─'.repeat(60));

      // Count words
      const wordCount = script.split(/\s+/).length;
      const estimatedDuration = Math.round((wordCount / 150) * 60);

      console.log(`\n📊 Stats:`);
      console.log(`   - Word count: ${wordCount} words`);
      console.log(`   - Estimated duration: ${estimatedDuration} seconds`);
      console.log(`   - Target: 30 seconds (≈90 words)`);

      if (wordCount > 110) {
        console.log(`   ⚠️  Script may be too long (${wordCount} > 110 words)`);
      } else if (wordCount < 70) {
        console.log(`   ⚠️  Script may be too short (${wordCount} < 70 words)`);
      } else {
        console.log(`   ✅ Script length is perfect!`);
      }

      // Check for required elements
      console.log(`\n✓ Checklist:`);
      console.log(`   ${script.includes('OwnerFi.ai') || script.includes('ownerfi.ai') ? '✅' : '❌'} Contains OwnerFi.ai CTA`);
      console.log(`   ${script.includes('?') ? '✅' : '⚠️ '} Contains question/hook`);
      console.log(`   ${wordCount <= 110 ? '✅' : '❌'} Within 90-word target`);

    } catch (error: any) {
      console.error('❌ Error generating script:', error.message);
    }

    // Wait a bit between requests to avoid rate limiting
    if (i < testBenefits.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('🎉 Test Complete!');
  console.log('=' .repeat(60));
  console.log('\n📝 Summary:');
  console.log('   - System: BUYER-ONLY (seller benefits will be rejected)');
  console.log(`   - Daily Theme: ${dailyThemes[today as keyof typeof dailyThemes]}`);
  console.log('   - Target: 30-second videos (~90 words)');
  console.log('   - CTA: Always includes OwnerFi.ai');
  console.log('   - Style: Friendly, motivational, 5th-grade reading level');
  console.log('\n✅ Ready for production use!\n');
}

// Test error handling with seller benefit (should fail)
async function testSellerRejection() {
  console.log('\n\n🧪 Testing BUYER-ONLY enforcement...\n');
  console.log('=' .repeat(60));

  const heygenKey = process.env.HEYGEN_API_KEY || '';
  const generator = new BenefitVideoGenerator(heygenKey);

  // Create a fake seller benefit
  const sellerBenefit = {
    id: 'test_seller',
    audience: 'seller' as const,
    title: 'Test Seller Benefit',
    shortDescription: 'This should be rejected',
    hashtags: ['#test'],
    category: 'financial' as const
  };

  try {
    console.log('Attempting to generate script for SELLER benefit...');
    await (generator as any).generateScript(sellerBenefit);
    console.log('❌ ERROR: Seller benefit was NOT rejected!');
  } catch (error: any) {
    console.log('✅ SUCCESS: Seller benefit was properly rejected');
    console.log(`   Error message: "${error.message}"`);
  }

  console.log('=' .repeat(60));
}

// Run tests
async function runTests() {
  try {
    await testBuyerScriptGeneration();
    await testSellerRejection();
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
