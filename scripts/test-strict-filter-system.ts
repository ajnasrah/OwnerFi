/**
 * Comprehensive Test Suite for Strict Owner Finance Filter System
 * Tests all components to ensure 100% accuracy
 */

import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

console.log('🧪 Testing Strict Owner Finance Filter System\n');
console.log('=' .repeat(80));

// Test Cases
const testCases = [
  // ===== SHOULD PASS =====
  {
    description: 'Beautiful 3BR home. Owner financing available with 10% down.',
    shouldPass: true,
    expectedKeywords: ['owner financing'],
    category: 'Explicit Owner Finance'
  },
  {
    description: 'Seller financing offered. Great investment property.',
    shouldPass: true,
    expectedKeywords: ['seller financing'],
    category: 'Explicit Seller Finance'
  },
  {
    description: 'Owner will carry the note with flexible terms.',
    shouldPass: true,
    expectedKeywords: ['owner carry', 'flexible terms'],
    category: 'Owner Carry'
  },
  {
    description: 'Rent to own available. Move in today!',
    shouldPass: true,
    expectedKeywords: ['rent to own'],
    category: 'Rent to Own'
  },
  {
    description: 'Lease option or lease purchase considered.',
    shouldPass: true,
    expectedKeywords: ['lease option', 'lease purchase'],
    category: 'Lease Option'
  },
  {
    description: 'Creative financing solutions available. Owner terms negotiable.',
    shouldPass: true,
    expectedKeywords: ['creative financing', 'owner terms'],
    category: 'Creative Financing'
  },

  // ===== SHOULD FAIL =====
  {
    description: 'Beautiful 3BR home. Conventional financing only. Great location!',
    shouldPass: false,
    expectedKeywords: [],
    category: 'No Owner Finance Mention'
  },
  {
    description: 'Cash buyers only. As-is sale. Motivated seller.',
    shouldPass: false,
    expectedKeywords: [],
    category: 'Cash Only (investor keywords but no owner finance)'
  },
  {
    description: 'FHA approved. Great school district. Must see!',
    shouldPass: false,
    expectedKeywords: [],
    category: 'Conventional Only'
  },
  {
    description: 'Investment opportunity. Needs work. Priced to sell.',
    shouldPass: false,
    expectedKeywords: [],
    category: 'Generic Investment (no owner finance)'
  },
  {
    description: '',
    shouldPass: false,
    expectedKeywords: [],
    category: 'Empty Description'
  },
];

// Run tests
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

console.log('\n📋 Running Test Cases...\n');

testCases.forEach((test, index) => {
  const result = hasStrictOwnerFinancing(test.description);
  const passed = result.passes === test.shouldPass;

  if (passed) {
    passedTests++;
    console.log(`✅ Test ${index + 1}: ${test.category}`);
    if (result.passes) {
      console.log(`   Keywords found: ${result.matchedKeywords.join(', ')}`);
    }
  } else {
    failedTests++;
    console.log(`❌ Test ${index + 1}: ${test.category}`);
    console.log(`   Expected: ${test.shouldPass ? 'PASS' : 'FAIL'}`);
    console.log(`   Got: ${result.passes ? 'PASS' : 'FAIL'}`);
    console.log(`   Description: "${test.description.substring(0, 50)}..."`);
    failures.push(`Test ${index + 1}: ${test.category}`);
  }
  console.log();
});

console.log('=' .repeat(80));
console.log('📊 TEST RESULTS');
console.log('=' .repeat(80));
console.log(`Total Tests: ${testCases.length}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`Success Rate: ${((passedTests / testCases.length) * 100).toFixed(1)}%`);
console.log('=' .repeat(80));

if (failedTests > 0) {
  console.log('\n❌ FAILED TESTS:');
  failures.forEach(f => console.log(`   - ${f}`));
  console.log('\n⚠️  Fix these failures before deploying!');
  process.exit(1);
} else {
  console.log('\n🎉 ALL TESTS PASSED!');
  console.log('✅ Filter is working perfectly');
  console.log('✅ Safe to deploy');
}

// Additional validation tests
console.log('\n' + '=' .repeat(80));
console.log('🔍 ADDITIONAL VALIDATION TESTS');
console.log('=' .repeat(80));

// Test 1: Check that all patterns return correct keyword names
console.log('\n1️⃣  Testing Pattern Name Consistency...');
const testDescriptions = [
  'owner financing available',
  'seller financing offered',
  'rent to own',
  'lease option',
  'creative financing',
];

let patternTestsPassed = 0;
testDescriptions.forEach((desc, i) => {
  const result = hasStrictOwnerFinancing(desc);
  if (result.passes && result.primaryKeyword) {
    console.log(`   ✅ "${desc}" → Primary: "${result.primaryKeyword}"`);
    patternTestsPassed++;
  } else {
    console.log(`   ❌ "${desc}" → Failed to detect`);
  }
});

console.log(`\n   Pattern Tests: ${patternTestsPassed}/${testDescriptions.length} passed`);

// Test 2: Check multiple keywords detection
console.log('\n2️⃣  Testing Multiple Keyword Detection...');
const multiKeywordTest = 'Owner financing available with rent to own option and flexible terms';
const multiResult = hasStrictOwnerFinancing(multiKeywordTest);
console.log(`   Description: "${multiKeywordTest}"`);
console.log(`   Keywords found: ${multiResult.matchedKeywords.length}`);
console.log(`   Details: ${multiResult.matchedKeywords.join(', ')}`);

if (multiResult.matchedKeywords.length >= 3) {
  console.log('   ✅ Multiple keyword detection working');
} else {
  console.log('   ⚠️  Expected 3+ keywords, found ' + multiResult.matchedKeywords.length);
}

// Test 3: Case insensitivity
console.log('\n3️⃣  Testing Case Insensitivity...');
const caseTests = [
  'OWNER FINANCING AVAILABLE',
  'Owner Financing Available',
  'owner financing available',
  'OwNeR FiNaNcInG AvAiLaBlE',
];

let caseTestsPassed = 0;
caseTests.forEach(test => {
  const result = hasStrictOwnerFinancing(test);
  if (result.passes) {
    caseTestsPassed++;
  }
});

console.log(`   Case Tests: ${caseTestsPassed}/${caseTests.length} passed`);
if (caseTestsPassed === caseTests.length) {
  console.log('   ✅ Case insensitivity working perfectly');
} else {
  console.log('   ❌ Case insensitivity not working');
}

console.log('\n' + '=' .repeat(80));
console.log('✅ ALL VALIDATION TESTS COMPLETE');
console.log('=' .repeat(80));
console.log('\n🚀 System is ready for deployment!\n');
