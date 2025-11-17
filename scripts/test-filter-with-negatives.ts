import { hasOwnerFinancing } from '../src/lib/owner-financing-filter';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

/**
 * Test both filters with real examples from removed false positives
 */

console.log('\n🧪 TESTING FILTERS WITH NEGATIVE KEYWORDS\n');
console.log('='.repeat(80));

// Test cases from actual false positives we removed
const testCases = [
  {
    name: 'Explicit "no owner financing"',
    description: 'Great property! 3 bed 2 bath. No owner financing available.',
    shouldReject: true,
  },
  {
    name: 'Cash only',
    description: 'Investment opportunity. Cash only. No owner financing.',
    shouldReject: true,
  },
  {
    name: 'Cash or conventional',
    description: 'Beautiful home. Cash or conventional financing only. No seller financing.',
    shouldReject: true,
  },
  {
    name: 'Not interested in owner financing',
    description: 'Nice property. Seller is not interested in owner financing.',
    shouldReject: true,
  },
  {
    name: 'Truncated "no owner fin"',
    description: 'This property is part of a package. No owner fin',
    shouldReject: true,
  },
  {
    name: 'Will not carry',
    description: 'Fixer upper property. Owner will not carry. Cash required.',
    shouldReject: true,
  },
  {
    name: 'No seller carry back',
    description: 'Great investment. No seller carry back. Cash or hard money only.',
    shouldReject: true,
  },
  {
    name: 'POSITIVE - Owner financing available',
    description: 'Beautiful 3/2 home. Owner financing available with 20% down!',
    shouldReject: false,
  },
  {
    name: 'POSITIVE - Seller will carry',
    description: 'Investment property. Seller will carry with good terms.',
    shouldReject: false,
  },
  {
    name: 'POSITIVE - Creative financing',
    description: 'Nice home. Creative financing options available. Owner terms considered.',
    shouldReject: false,
  },
  {
    name: 'POSITIVE - Flexible terms',
    description: 'Great opportunity! Flexible financing terms available.',
    shouldReject: false,
  },
  {
    name: 'EDGE CASE - Both positive and negative',
    description: 'Would consider owner financing but no owner financing at this time. Cash only.',
    shouldReject: true, // Negative keywords should take precedence
  },
];

let passed = 0;
let failed = 0;

console.log('\n📋 Testing Regular Filter (owner-financing-filter.ts):\n');

testCases.forEach((test, i) => {
  const result = hasOwnerFinancing(test.description);
  const shouldPass = !test.shouldReject;
  const actuallyPassed = result.shouldSend;

  const correct = shouldPass === actuallyPassed;
  const icon = correct ? '✅' : '❌';

  console.log(`${icon} Test ${i + 1}: ${test.name}`);
  console.log(`   Expected: ${shouldPass ? 'PASS (send to GHL)' : 'REJECT (filter out)'}`);
  console.log(`   Actual:   ${actuallyPassed ? 'PASS' : 'REJECT'}`);
  console.log(`   Reason:   ${result.reason}`);

  if (correct) {
    passed++;
  } else {
    failed++;
    console.log(`   ⚠️  FILTER FAILED!`);
  }
  console.log();
});

console.log('='.repeat(80));
console.log('\n📋 Testing Strict Filter (owner-financing-filter-strict.ts):\n');

let strictPassed = 0;
let strictFailed = 0;

testCases.forEach((test, i) => {
  const result = hasStrictOwnerFinancing(test.description);
  const shouldPass = !test.shouldReject;
  const actuallyPassed = result.passes;

  const correct = shouldPass === actuallyPassed;
  const icon = correct ? '✅' : '❌';

  console.log(`${icon} Test ${i + 1}: ${test.name}`);
  console.log(`   Expected: ${shouldPass ? 'PASS (show to buyers)' : 'REJECT (filter out)'}`);
  console.log(`   Actual:   ${actuallyPassed ? 'PASS' : 'REJECT'}`);
  console.log(`   Keywords: ${result.matchedKeywords.join(', ') || 'none'}`);

  if (correct) {
    strictPassed++;
  } else {
    strictFailed++;
    console.log(`   ⚠️  FILTER FAILED!`);
  }
  console.log();
});

console.log('='.repeat(80));
console.log('\n📊 FINAL RESULTS:\n');

console.log(`Regular Filter (owner-financing-filter.ts):`);
console.log(`   ✅ Passed: ${passed}/${testCases.length}`);
console.log(`   ❌ Failed: ${failed}/${testCases.length}`);
console.log(`   Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%\n`);

console.log(`Strict Filter (owner-financing-filter-strict.ts):`);
console.log(`   ✅ Passed: ${strictPassed}/${testCases.length}`);
console.log(`   ❌ Failed: ${strictFailed}/${testCases.length}`);
console.log(`   Success Rate: ${((strictPassed / testCases.length) * 100).toFixed(1)}%\n`);

if (passed === testCases.length && strictPassed === testCases.length) {
  console.log('🎉 ALL TESTS PASSED! Filters are working correctly!\n');
  console.log('✅ Both filters now properly reject properties with negative keywords');
  console.log('✅ Both filters still accept properties with positive keywords');
  console.log('✅ False positives will no longer enter the database\n');
  process.exit(0);
} else {
  console.log('⚠️  SOME TESTS FAILED! Filters need adjustment.\n');
  process.exit(1);
}
