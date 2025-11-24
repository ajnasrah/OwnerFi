/**
 * Test Negative Keyword Filter
 *
 * Verifies that the negative keyword filter correctly identifies properties
 * that explicitly say "NO owner finance"
 */

import { hasNegativeKeywords } from '../src/lib/negative-keywords';

console.log('🧪 Testing Negative Keyword Filter\n');

// Test cases with expected results
const testCases = [
  {
    description: 'Beautiful 3BR home. Cash only, no financing. Recently renovated.',
    shouldBlock: true,
    reason: 'Contains "cash only"',
  },
  {
    description: 'Great property! No owner financing available. Conventional only.',
    shouldBlock: true,
    reason: 'Contains "no owner financing available"',
  },
  {
    description: 'Investor special! No creative or owner financed offers.',
    shouldBlock: true,
    reason: 'Contains "no creative or owner financed offers"',
  },
  {
    description: 'Charming home. Owner financing available! Motivated seller.',
    shouldBlock: false,
    reason: 'Has positive keywords, no negative keywords',
  },
  {
    description: 'Price reduced. Make an offer! Flexible terms.',
    shouldBlock: false,
    reason: 'No negative keywords',
  },
  {
    description: 'Renovated kitchen with all new appliances.',
    shouldBlock: false,
    reason: 'No financing keywords at all',
  },
  {
    description: 'Seller will not carry. Cash or conventional financing only.',
    shouldBlock: true,
    reason: 'Contains "seller will not carry" and "conventional financing only"',
  },
  {
    description: 'No wholesalers, no assignments, no owner financing.',
    shouldBlock: true,
    reason: 'Contains "no owner financing"',
  },
  {
    description: 'Owner financing is not available. Bank financing required.',
    shouldBlock: true,
    reason: 'Contains "owner financing is not available"',
  },
  {
    description: 'Great neighborhood! Now accepting offers.',
    shouldBlock: false,
    reason: 'Word "now" should not trigger "no" filter (word boundary)',
  },
];

let passed = 0;
let failed = 0;

console.log('Running test cases...\n');

testCases.forEach((test, index) => {
  const result = hasNegativeKeywords(test.description);
  const blocked = result.hasNegative;

  const isCorrect = blocked === test.shouldBlock;

  if (isCorrect) {
    console.log(`✅ Test ${index + 1} PASSED`);
    passed++;
  } else {
    console.log(`❌ Test ${index + 1} FAILED`);
    failed++;
  }

  console.log(`   Description: "${test.description.substring(0, 60)}..."`);
  console.log(`   Expected: ${test.shouldBlock ? 'BLOCK' : 'ALLOW'}`);
  console.log(`   Got: ${blocked ? 'BLOCK' : 'ALLOW'}`);
  console.log(`   Reason: ${test.reason}`);

  if (result.matches.length > 0) {
    console.log(`   Matched keywords: ${result.matches.slice(0, 3).join(', ')}`);
  }

  console.log('');
});

console.log('═══════════════════════════════════════');
console.log(`Total: ${testCases.length} tests`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('═══════════════════════════════════════');

if (failed === 0) {
  console.log('\n🎉 All tests passed! Negative keyword filter is working correctly.\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failed} test(s) failed. Please review the filter logic.\n`);
  process.exit(1);
}
