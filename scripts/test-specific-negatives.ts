import { hasOwnerFinancing } from '../src/lib/owner-financing-filter';
import { hasStrictOwnerFinancing } from '../src/lib/owner-financing-filter-strict';

console.log('\n🧪 TESTING SPECIFIC NEGATIVE KEYWORDS\n');
console.log('='.repeat(80));

const testCases = [
  'No owner financing available',
  'No creative financing',
  'No owner financing or creative financing',
  'No seller financing',
  'This property has no owner financing',
  'Great property but no creative financing offered',
  'Cash only. No owner financing or creative financing.',
  'Owner financing not available',
  'Creative financing not available',
  'No owner financing or subject to offers',
];

testCases.forEach((description, i) => {
  console.log(`\nTest ${i + 1}: "${description}"`);

  const regularResult = hasOwnerFinancing(description);
  const strictResult = hasStrictOwnerFinancing(description);

  const regularIcon = regularResult.shouldSend ? '❌ FAILED' : '✅ REJECTED';
  const strictIcon = strictResult.passes ? '❌ FAILED' : '✅ REJECTED';

  console.log(`  Regular Filter: ${regularIcon}`);
  console.log(`  Strict Filter:  ${strictIcon}`);

  if (regularResult.shouldSend || strictResult.passes) {
    console.log(`  ⚠️  WARNING: This should be REJECTED but was ACCEPTED!`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('\n✅ All negative phrases should be REJECTED by both filters');
