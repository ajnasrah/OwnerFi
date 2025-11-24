/**
 * Comprehensive test for negative financing detector
 */

import { detectNegativeFinancing, explainNegativeDetection } from '../src/lib/negative-financing-detector';

interface TestCase {
  description: string;
  expected: boolean;
  category: string;
}

const testCases: TestCase[] = [
  // ===== HYPHENATED VARIATIONS =====
  {
    description: 'needed. No wholesalers/assignable offers will be considered, per the Seller. No Seller-financing offered.',
    expected: true,
    category: 'Hyphenated negation'
  },
  {
    description: 'Great property with owner-financing available',
    expected: false,
    category: 'Hyphenated positive (should pass)'
  },

  // ===== LIST STRUCTURES =====
  {
    description: 'Investor Special! NO Wholesale, Assignments or Seller Finance Offers will be accepted.',
    expected: true,
    category: 'List structure with NO'
  },
  {
    description: 'make a great rental! (No wholesalers or seller financing offers)',
    expected: true,
    category: 'List in parentheses'
  },

  // ===== EXPLICIT "NO" STATEMENTS =====
  {
    description: 'Beautiful home. No owner financing available.',
    expected: true,
    category: 'Simple no statement'
  },
  {
    description: 'Great property with no issues. Owner financing available.',
    expected: false,
    category: 'No in different context (should pass)'
  },

  // ===== CASH ONLY =====
  {
    description: 'Sold as-is, cash only. No exceptions.',
    expected: true,
    category: 'Cash only requirement'
  },
  {
    description: 'Cash or conventional financing accepted.',
    expected: true,
    category: 'Conventional only'
  },

  // ===== REJECTION PHRASES =====
  {
    description: 'Owner financing offers will not be accepted.',
    expected: true,
    category: 'Rejection phrase'
  },
  {
    description: 'Seller financing not available at this time.',
    expected: true,
    category: 'Not available statement'
  },

  // ===== SLASH SEPARATORS =====
  {
    description: 'No wholesalers/assignable offers will be considered.',
    expected: false, // This doesn't explicitly mention financing, so should pass
    category: 'Slash separator without financing mention'
  },

  // ===== POSITIVE CASES (SHOULD PASS) =====
  {
    description: 'Owner financing available with 20% down!',
    expected: false,
    category: 'Positive - explicit availability'
  },
  {
    description: 'Seller willing to carry with good terms.',
    expected: false,
    category: 'Positive - willing to carry'
  },
  {
    description: 'Creative financing options available.',
    expected: false,
    category: 'Positive - creative financing'
  },
  {
    description: 'Flexible terms for qualified buyers.',
    expected: false,
    category: 'Positive - flexible terms'
  },

  // ===== EDGE CASES =====
  {
    description: 'Call for details on financing.',
    expected: false,
    category: 'Edge - generic financing mention'
  },
  {
    description: '',
    expected: false,
    category: 'Edge - empty description'
  },
];

console.log('Testing Context-Aware Negative Financing Detector\n');
console.log('='.repeat(100));

let passed = 0;
let failed = 0;
const failures: Array<{ testCase: TestCase; result: any }> = [];

for (const testCase of testCases) {
  const result = detectNegativeFinancing(testCase.description);
  const success = result.isNegative === testCase.expected;

  if (success) {
    passed++;
    console.log(`\n✅ PASS [${testCase.category}]`);
  } else {
    failed++;
    failures.push({ testCase, result });
    console.log(`\n❌ FAIL [${testCase.category}]`);
    console.log(`   Expected: ${testCase.expected ? 'Should reject' : 'Should pass'}`);
    console.log(`   Got: ${result.isNegative ? 'Rejected' : 'Passed'}`);
  }

  console.log(`   Description: "${testCase.description.substring(0, 80)}${testCase.description.length > 80 ? '...' : ''}"`);
  console.log(`   ${explainNegativeDetection(testCase.description)}`);
  console.log(`   Confidence: ${result.confidence}`);
}

console.log('\n' + '='.repeat(100));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failures.length > 0) {
  console.log('\n\n❌ FAILED TESTS:\n');
  failures.forEach(({ testCase, result }, i) => {
    console.log(`${i + 1}. [${testCase.category}]`);
    console.log(`   Description: "${testCase.description}"`);
    console.log(`   Expected: ${testCase.expected ? 'Negative' : 'Positive'}`);
    console.log(`   Got: ${result.isNegative ? 'Negative' : 'Positive'}`);
    console.log(`   Reason: ${result.reason}\n`);
  });
}

console.log('\n' + '='.repeat(100));

if (failed > 0) {
  console.log('\n⚠️  Some tests failed. Review the failures above.\n');
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed!\n');
  process.exit(0);
}
