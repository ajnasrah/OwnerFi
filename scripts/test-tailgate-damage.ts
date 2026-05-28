/**
 * Test tailgate and other special damage cases
 */

import { mapDamage, validateAndFixInput } from '../src/lib/vehicle-damage-mapper';
import { formatAuctionDamage, convertOldToNewFormat } from '../src/lib/auction-format-converter';

console.log('Testing Tailgate and Special Cases\n');
console.log('=' .repeat(60));

// Test cases from the screenshots
const testCases = [
  {
    input: 'Bent - tail gate - /scragtched',
    expectedLocation: 'Tailgate',
    expectedDamage: 'Bent / Scratched'
  },
  {
    input: 'tailgate bent scratched',
    expectedLocation: 'Tailgate',
    expectedDamage: 'Bent / Scratched'
  },
  {
    input: 'Quarter Panel - Right',
    description: 'Chip - left - multiple s',
    expectedOutput: 'Right Quarter Panel · Chip / Multiple'
  }
];

// Test the raw tailgate input
console.log('\n1. Raw tailgate input test:');
const tailgateInput = 'Bent - tail gate - /scragtched';
console.log(`   Input:  "${tailgateInput}"`);
const fixed = validateAndFixInput(tailgateInput);
console.log(`   Fixed:  "${fixed}"`);
const mapped = mapDamage(fixed);
console.log(`   Output: "${mapped.auctionFormat}"`);
console.log(`   Expected: "Tailgate · Bent / Scratched"`);

// Test format conversion
console.log('\n2. Format conversion test:');
const oldLocation = 'Quarter Panel - Right';
const oldDescription = 'Chip - left - multiple s';
console.log(`   Location: "${oldLocation}"`);
console.log(`   Description: "${oldDescription}"`);
const result = formatAuctionDamage(oldLocation, oldDescription);
console.log(`   Output: "${result}"`);
console.log(`   Expected: "Right Quarter Panel · Chip / Multiple"`);

// Test various tailgate formats
console.log('\n3. Various tailgate formats:');
const tailgateVariations = [
  'tailgate dent',
  'tail gate scratch',
  'Tailgate bent and scratched',
  'rear tailgate damage',
  'bent tailgate'
];

tailgateVariations.forEach(variation => {
  const cleaned = validateAndFixInput(variation);
  const damage = mapDamage(cleaned);
  console.log(`   "${variation}" → "${damage.auctionFormat}"`);
});

// Test other special parts
console.log('\n4. Other special parts:');
const specialParts = [
  'liftgate dent',
  'rear hatch scratch',
  'spoiler crack',
  'left running board bent',
  'right running board scratch'
];

specialParts.forEach(part => {
  const damage = mapDamage(part);
  console.log(`   "${part}" → "${damage.auctionFormat}"`);
});

console.log('\n' + '=' .repeat(60));
console.log('Test complete!');