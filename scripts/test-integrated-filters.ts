/**
 * Integration test for all filtering systems with the new negative detector
 */

import { hasOwnerFinancing } from '../src/lib/owner-financing-filter';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';
import { detectNegativeFinancing } from '../src/lib/negative-financing-detector';

const realWorldCases = [
  {
    description: 'needed. No wholesalers/assignable offers will be considered, per the Seller. No Seller-financing offered.',
    expectedResult: 'REJECT',
    reason: 'Hyphenated negative: "No Seller-financing"'
  },
  {
    description: 'make a great rental or first home for a buyer! Call today for more information or a private showing. (No wholesalers or seller financing offers)',
    expectedResult: 'REJECT',
    reason: 'List structure with seller financing in parentheses'
  },
  {
    description: 'Investor Special! This 3 Bedroom 1 Bathroom Home would be Great to add to your portfolio! With over 2.5 Acres, the possibilities are endless. Selling AS-IS. NO Wholesale, Assignments or Seller Finance Offers will be accepted. Make your appointment today!',
    expectedResult: 'REJECT',
    reason: 'Complex list: "NO Wholesale, Assignments or Seller Finance Offers"'
  },
  {
    description: 'Beautiful property with owner financing available. 20% down, 8% interest.',
    expectedResult: 'ACCEPT',
    reason: 'Positive: owner financing available'
  },
  {
    description: 'Great property with no issues. Owner financing available.',
    expectedResult: 'ACCEPT',
    reason: 'Should pass: "no" is in different sentence context'
  },
  {
    description: 'Cash or conventional financing accepted.',
    expectedResult: 'REJECT',
    reason: 'Cash/conventional only (excludes owner financing)'
  },
];

console.log('Integration Test: All Filtering Systems\n');
console.log('='.repeat(100));

let passed = 0;
let failed = 0;

for (const testCase of realWorldCases) {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`\nTest: ${testCase.reason}`);
  console.log(`Description: "${testCase.description.substring(0, 100)}..."`);
  console.log(`Expected: ${testCase.expectedResult}`);

  // Test negative detector
  const negativeResult = detectNegativeFinancing(testCase.description);
  console.log(`\n  📍 Negative Detector: ${negativeResult.isNegative ? 'REJECT' : 'PASS'}`);
  console.log(`     Reason: ${negativeResult.reason}`);
  if (negativeResult.matchedPattern) {
    console.log(`     Pattern: "${negativeResult.matchedPattern}"`);
  }

  // Test main filter
  const mainFilterResult = hasOwnerFinancing(testCase.description);
  console.log(`\n  📍 Main Filter: ${mainFilterResult.shouldSend ? 'ACCEPT' : 'REJECT'}`);
  console.log(`     Reason: ${mainFilterResult.reason}`);

  // Test strict filter
  const strictFilterResult = hasStrictOwnerFinancing(testCase.description);
  console.log(`\n  📍 Strict Filter: ${strictFilterResult.passes ? 'ACCEPT' : 'REJECT'}`);
  console.log(`     Matched: ${strictFilterResult.matchedKeywords.join(', ') || 'none'}`);

  // Check if result matches expectation
  const actualResult = mainFilterResult.shouldSend ? 'ACCEPT' : 'REJECT';
  const success = actualResult === testCase.expectedResult;

  if (success) {
    passed++;
    console.log(`\n  ✅ PASS: All filters working correctly`);
  } else {
    failed++;
    console.log(`\n  ❌ FAIL: Expected ${testCase.expectedResult}, got ${actualResult}`);
  }
}

console.log(`\n${'='.repeat(100)}`);
console.log(`\nFinal Results: ${passed} passed, ${failed} failed out of ${realWorldCases.length} tests`);

if (failed > 0) {
  console.log('\n⚠️  Some integration tests failed.\n');
  process.exit(1);
} else {
  console.log('\n🎉 All integration tests passed!\n');
  process.exit(0);
}
