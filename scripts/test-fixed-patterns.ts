import { hasOwnerFinancing } from '../src/lib/owner-financing-filter';

const testCases = [
  {
    desc: "NOW OFFERING OWNER FINANCE! Discover the charm of small-town living",
    expectedShouldSend: true,
    label: "NOW OFFERING - should pass",
  },
  {
    desc: "The price is definitely negotiable and owner financing may be available with a 10% down payment",
    expectedShouldSend: true,
    label: "negotiable + owner financing - should pass",
  },
  {
    desc: "Beautiful home. Cash only. No owner financing available.",
    expectedShouldSend: false,
    label: "No owner financing - should reject",
  },
  {
    desc: "Great investment. No creative or owner financed offers accepted.",
    expectedShouldSend: false,
    label: "No creative or owner financed offers - should reject",
  },
  {
    desc: "Owner financing available. Contact seller for terms.",
    expectedShouldSend: true,
    label: "Owner financing available - should pass",
  },
  {
    desc: "Cash or conventional only. No owner financing.",
    expectedShouldSend: false,
    label: "Cash/conventional only - should reject",
  },
  {
    desc: "Seller will entertain owner financing offers. Call for details.",
    expectedShouldSend: true,
    label: "Seller will entertain - should pass",
  },
  {
    desc: "No wholesalers or owner financing. Cash buyers only.",
    expectedShouldSend: false,
    label: "No wholesalers or owner financing - should reject",
  },
];

console.log('\n🧪 TESTING FIXED NEGATIVE PATTERNS\n');
console.log('='.repeat(100));

let passed = 0;
let failed = 0;

testCases.forEach((test, i) => {
  const result = hasOwnerFinancing(test.desc);
  const isCorrect = result.shouldSend === test.expectedShouldSend;

  console.log(`\n${i + 1}. ${test.label}`);
  console.log(`   Description: "${test.desc.substring(0, 100)}..."`);
  console.log(`   Expected: ${test.expectedShouldSend ? 'PASS' : 'REJECT'}`);
  console.log(`   Got: ${result.shouldSend ? 'PASS' : 'REJECT'} - ${result.reason}`);
  console.log(`   Result: ${isCorrect ? '✅ CORRECT' : '❌ FAILED'}`);

  if (isCorrect) {
    passed++;
  } else {
    failed++;
  }

  console.log('-'.repeat(100));
});

console.log(`\n📊 TEST RESULTS: ${passed}/${testCases.length} passed, ${failed}/${testCases.length} failed\n`);

if (failed === 0) {
  console.log('✅ All tests passed! The fix is working correctly.\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. The fix needs more work.\n');
  process.exit(1);
}
