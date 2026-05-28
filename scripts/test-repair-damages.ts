/**
 * Test repair and repaint damage types
 */

import { mapDamage, validateAndFixInput } from '../src/lib/vehicle-damage-mapper';

console.log('Testing Repair & Repaint Damage Types\n');
console.log('=' .repeat(60));

const testCases = [
  // Basic repair cases
  'hood previous repair',
  'left fender repainted',
  'right door previously repaired',
  'front bumper replaced',
  'rear bumper aftermarket',
  
  // Multiple damage with repairs
  'left quarter panel dent and previous repair',
  'right fender scratch repainted',
  'hood dent with poor repair',
  'door replaced and repainted',
  
  // Complex descriptions
  'left door previous damage repaired',
  'hood old repair with paint damage',
  'front bumper aftermarket part scratched',
  'quarter panel bad repair multiple dents',
  
  // Specific panel repairs
  'tailgate repainted',
  'roof previous repair',
  'trunk lid replaced',
  'grille aftermarket replacement'
];

console.log('\nTesting repair-related damages:\n');

testCases.forEach((testCase, index) => {
  const cleaned = validateAndFixInput(testCase);
  const result = mapDamage(cleaned);
  
  console.log(`${index + 1}. "${testCase}"`);
  console.log(`   → "${result.auctionFormat}"`);
  console.log('');
});

// Special test for repainted panels
console.log('=' .repeat(60));
console.log('Special Test: Repainted Panel Detection\n');

const repaintTests = [
  { input: 'hood repainted', expected: 'Hood · Repainted' },
  { input: 'left fender previous repair repainted', expected: 'Left Fender · Previous Repair / Repainted' },
  { input: 'door overspray', expected: 'contains overspray/paint damage' },
  { input: 'bumper respray', expected: 'Front Bumper · Repainted' }
];

repaintTests.forEach(test => {
  const result = mapDamage(test.input);
  console.log(`Input: "${test.input}"`);
  console.log(`Output: "${result.auctionFormat}"`);
  if (test.expected.includes('contains')) {
    const hasOverspray = result.auctionFormat.includes('Repainted') || result.auctionFormat.includes('Paint Damage');
    console.log(`Expected: ${test.expected} - ${hasOverspray ? '✅' : '❌'}`);
  } else {
    console.log(`Expected: "${test.expected}" - ${result.auctionFormat === test.expected ? '✅' : '❌'}`);
  }
  console.log('');
});

console.log('=' .repeat(60));
console.log('Test complete!');