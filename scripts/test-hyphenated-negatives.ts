/**
 * Test script to verify hyphenated negative keywords are caught
 */

import { hasNegativeKeywords } from '../src/lib/negative-keywords';

const testCases = [
  {
    description: 'needed. No wholesalers/assignable offers will be considered, per the Seller. No Seller-financing offered.',
    expected: true,
    reason: 'Should catch "No Seller-financing offered"'
  },
  {
    description: 'make a great rental or first home for a buyer! Call today for more information or a private showing. (No wholesalers or seller financing offers)',
    expected: true,
    reason: 'Should catch "No wholesalers or seller financing offers"'
  },
  {
    description: 'Investor Special! This 3 Bedroom 1 Bathroom Home would be Great to add to your portfolio! With over 2.5 Acres, the possibilities are endless. Selling AS-IS. NO Wholesale, Assignments or Seller Finance Offers will be accepted. Make your appointment today!',
    expected: true,
    reason: 'Should catch "Seller Finance Offers will be accepted" pattern'
  },
  {
    description: 'Great property with owner financing available',
    expected: false,
    reason: 'Should pass - no negative keywords'
  }
];

console.log('Testing Hyphenated Negative Keywords\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = hasNegativeKeywords(testCase.description);
  const success = result.hasNegative === testCase.expected;

  if (success) {
    passed++;
    console.log(`\n✅ PASS: ${testCase.reason}`);
  } else {
    failed++;
    console.log(`\n❌ FAIL: ${testCase.reason}`);
    console.log(`   Expected: ${testCase.expected ? 'Should be rejected' : 'Should pass'}`);
    console.log(`   Got: ${result.hasNegative ? 'Rejected' : 'Passed'}`);
  }

  console.log(`   Description: "${testCase.description.substring(0, 100)}..."`);

  if (result.hasNegative) {
    console.log(`   Matched negative keywords: ${result.matches.join(', ')}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed > 0) {
  process.exit(1);
}
