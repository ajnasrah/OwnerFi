import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

/**
 * Test script to verify that properties with empty descriptions
 * are properly filtered out by the strict filter
 */

console.log('\n🧪 TESTING EMPTY DESCRIPTION FILTER\n');
console.log('='.repeat(80));

// Test cases
const testCases = [
  { description: null, label: 'null description' },
  { description: undefined, label: 'undefined description' },
  { description: '', label: 'empty string' },
  { description: '   ', label: 'whitespace only' },
  { description: 'Owner financing available!', label: 'valid description with owner financing' },
  { description: 'Beautiful home', label: 'valid description WITHOUT owner financing' },
];

console.log('\n📋 RUNNING FILTER TESTS\n');

testCases.forEach((testCase, idx) => {
  const result = hasStrictOwnerFinancing(testCase.description);

  console.log(`\nTest ${idx + 1}: ${testCase.label}`);
  console.log(`   Input: ${testCase.description === null ? 'null' : testCase.description === undefined ? 'undefined' : `"${testCase.description}"`}`);
  console.log(`   Passes: ${result.passes}`);
  console.log(`   Matched Keywords: ${result.matchedKeywords.join(', ') || 'None'}`);
  console.log(`   Expected: Should be REJECTED (passes = false)`);
  console.log(`   ✅ ${!result.passes ? 'CORRECT' : '❌ INCORRECT - FILTER BUG!'}`);
});

console.log('\n' + '='.repeat(80));
console.log('✅ Test complete!\n');
