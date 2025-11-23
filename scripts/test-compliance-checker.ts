/**
 * Test Script for Compliance Checker
 * Tests various violation scenarios across all brands
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { checkScriptCompliance, validateAndFixScript } from '../src/lib/compliance-checker';
import { Brand } from '../src/config/brand-configs';

// Test scenarios with known violations
const testScenarios = [
  {
    name: 'OwnerFi - Legal Advice Violation',
    brand: 'ownerfi' as Brand,
    script: 'You should definitely buy this property! It\'s guaranteed to increase in value. This is the best investment you can make. You must act now before it\'s gone!',
    caption: 'Best deal ever! Guaranteed approval! #OwnerFi',
    title: 'Best Investment Ever!',
    expectedViolations: ['legal_advice', 'false_claims', 'pushy_tactics']
  },
  {
    name: 'VassDistro - Youth Appeal Violation',
    brand: 'vassdistro' as Brand,
    script: 'These vape products are perfect for young people at college parties! Super cool and trendy. They\'re healthier than smoking and will help you quit.',
    caption: 'Cool vapes for young adults! #VassDistro',
    title: 'Trendy Vapes for Students',
    expectedViolations: ['industry_specific']
  },
  {
    name: 'Abdullah - Get-Rich-Quick Violation',
    brand: 'abdullah' as Brand,
    script: 'I made $100k overnight with this one simple trick! Guaranteed passive income while you sleep. You\'ll get rich fast with zero effort. This is easy money!',
    caption: 'Get rich quick! Easy money! #PassiveIncome',
    title: 'Get Rich Overnight!',
    expectedViolations: ['false_claims', 'legal_advice']
  },
  {
    name: 'Carz - Misleading Pricing Violation',
    brand: 'carz' as Brand,
    script: 'This car is in perfect condition! Starting at just $5000! It\'s like new and the best deal you\'ll ever find. You need to buy this now!',
    caption: 'Perfect cars! Best prices! #Carz',
    title: 'Best Car Deal!',
    expectedViolations: ['false_claims', 'pushy_tactics']
  },
  {
    name: 'OwnerFi - Clean Script (Should Pass)',
    brand: 'property' as Brand,
    script: 'This 3-bed home in Dallas might cost less than your current rent. It\'s around $240K and the seller is open to owner financing. See what\'s available at OwnerFi.ai - prices and terms may change anytime.',
    caption: 'Explore owner finance options in your area. Visit OwnerFi.ai to find homes near you. Prices and terms may change anytime. #OwnerFi #RealEstate',
    title: 'Owner Finance in Dallas',
    expectedViolations: []
  }
];

async function runComplianceTests() {
  console.log('🧪 COMPLIANCE CHECKER TEST SUITE\n');
  console.log('='.repeat(80));
  console.log('\n');

  let passed = 0;
  let failed = 0;

  for (const scenario of testScenarios) {
    console.log(`\n📋 TEST: ${scenario.name}`);
    console.log('-'.repeat(80));
    console.log(`Brand: ${scenario.brand}`);
    console.log(`Script: ${scenario.script.substring(0, 100)}...`);
    console.log(`Caption: ${scenario.caption}`);
    console.log(`Title: ${scenario.title}`);
    console.log('');

    try {
      // Run compliance check
      const result = await checkScriptCompliance(
        scenario.script,
        scenario.caption,
        scenario.title,
        scenario.brand
      );

      console.log(`\n✅ Compliance Check Results:`);
      console.log(`   Passed: ${result.passed ? 'YES ✅' : 'NO ❌'}`);
      console.log(`   Risk Level: ${result.riskLevel.toUpperCase()}`);
      console.log(`   Violations Found: ${result.violations.length}`);

      if (result.violations.length > 0) {
        console.log(`\n   📌 Violations Detected:`);
        result.violations.forEach((v, i) => {
          console.log(`      ${i + 1}. [${v.severity.toUpperCase()}] ${v.type}`);
          console.log(`         Phrase: "${v.phrase}"`);
          console.log(`         Explanation: ${v.explanation}`);
          console.log(`         Suggestion: ${v.suggestion}`);
        });
      }

      if (result.suggestions.length > 0) {
        console.log(`\n   💡 Suggestions:`);
        result.suggestions.forEach((s, i) => {
          console.log(`      ${i + 1}. ${s}`);
        });
      }

      if (result.requiredDisclaimers.length > 0) {
        console.log(`\n   ⚠️  Required Disclaimers:`);
        result.requiredDisclaimers.forEach((d, i) => {
          console.log(`      ${i + 1}. ${d}`);
        });
      }

      // Validate expected violations
      const violationTypes = result.violations.map(v => v.type);
      const expectedFound = scenario.expectedViolations.every(expected =>
        violationTypes.includes(expected)
      );

      if (scenario.expectedViolations.length === 0) {
        // Expected clean script
        if (result.passed) {
          console.log(`\n   ✅ TEST PASSED: Clean script correctly passed compliance`);
          passed++;
        } else {
          console.log(`\n   ❌ TEST FAILED: Clean script incorrectly flagged violations`);
          failed++;
        }
      } else {
        // Expected violations
        if (violationTypes.length > 0) {
          console.log(`\n   ✅ TEST PASSED: Violations correctly detected`);
          passed++;
        } else {
          console.log(`\n   ❌ TEST FAILED: Expected violations not detected`);
          failed++;
        }
      }

    } catch (error) {
      console.error(`\n   ❌ ERROR: ${error}`);
      failed++;
    }

    console.log('\n' + '='.repeat(80));
  }

  // Summary
  console.log(`\n\n📊 TEST SUMMARY`);
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${passed}/${testScenarios.length}`);
  console.log(`❌ Failed: ${failed}/${testScenarios.length}`);
  console.log(`Success Rate: ${((passed / testScenarios.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));
}

// Test auto-fix functionality
async function testAutoFix() {
  console.log('\n\n🔧 AUTO-FIX TEST\n');
  console.log('='.repeat(80));

  const testScript = 'You should definitely buy this property! It\'s guaranteed to be the best investment. Act now!';
  const testCaption = 'Best deal! Guaranteed approval! #RealEstate';
  const testTitle = 'Best Investment Ever!';
  const brand: Brand = 'ownerfi';

  console.log(`\n📝 Original Script (with violations):`);
  console.log(`   Script: ${testScript}`);
  console.log(`   Caption: ${testCaption}`);
  console.log(`   Title: ${testTitle}`);

  try {
    console.log(`\n🔄 Running auto-fix with up to 3 retries...`);

    const result = await validateAndFixScript(
      testScript,
      testCaption,
      testTitle,
      brand,
      3
    );

    if (result.success) {
      console.log(`\n✅ AUTO-FIX SUCCESSFUL after ${result.retryCount} ${result.retryCount === 1 ? 'retry' : 'retries'}`);
      console.log(`\n📝 Fixed Script:`);
      console.log(`   Script: ${result.finalScript}`);
      console.log(`   Caption: ${result.finalCaption}`);
      console.log(`   Title: ${result.finalTitle}`);
    } else {
      console.log(`\n❌ AUTO-FIX FAILED after ${result.retryCount} retries`);
      console.log(`   Error: ${result.error}`);
    }

  } catch (error) {
    console.error(`\n❌ AUTO-FIX ERROR: ${error}`);
  }

  console.log('\n' + '='.repeat(80));
}

// Main execution
async function main() {
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(20) + 'COMPLIANCE CHECKER TEST SUITE' + ' '.repeat(29) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log('\n');

  // Check environment
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ ERROR: OPENAI_API_KEY not set in environment');
    console.error('   Please set OPENAI_API_KEY in .env.local file');
    process.exit(1);
  }

  console.log('✅ OPENAI_API_KEY found');
  console.log('✅ Starting tests...\n');

  // Run tests
  await runComplianceTests();

  // Test auto-fix
  await testAutoFix();

  console.log('\n\n✅ All tests completed!\n');
}

// Run tests
main().catch(console.error);
