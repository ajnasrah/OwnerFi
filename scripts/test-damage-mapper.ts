/**
 * Test script for the vehicle damage mapper
 * Run with: npx tsx scripts/test-damage-mapper.ts
 */

import { mapDamage, validateAndFixInput } from '../src/lib/vehicle-damage-mapper';

const testCases = [
  // Quarter panel tests (the issue you reported)
  'quarter panel left dent multiple',
  'quarter panel right dent multiple',
  'left quarter panel scratch',
  'right quarter panel scratch',
  
  // Fender tests
  'left fender dent/scratch multiple',
  'left fender - dent/scratch multiple',
  'fender - left front · scratch — dent/ multiple',
  'right fender paint damage',
  
  // Wheel damage tests
  'front left wheel curb rash',
  'front right wheel curb damage',
  'rear left wheel bent',
  'rear right wheel curb scrape',
  'all wheels curb rash',
  
  // Panel damage tests
  'hood dent minor',
  'hood multiple dents',
  'trunk scratch',
  'roof paint damage',
  'door dent and scratch',
  'left door dent',
  'driver door scratch',
  
  // Bumper tests
  'front bumper scratch',
  'rear bumper dent',
  'bumper paint chip',
  
  // Complex damage descriptions
  'left front fender dent scratch paint damage multiple',
  'quarter panel left side major dent',
  'driver side mirror broken',
  'windshield crack severe',
];

console.log('Testing Vehicle Damage Mapper\n');
console.log('=' .repeat(80));

testCases.forEach((testCase, index) => {
  console.log(`\nTest ${index + 1}:`);
  console.log(`Input:    "${testCase}"`);
  
  const fixed = validateAndFixInput(testCase);
  if (fixed !== testCase) {
    console.log(`Fixed:    "${fixed}"`);
  }
  
  const result = mapDamage(fixed);
  console.log(`Output:   "${result.auctionFormat}"`);
  console.log(`Severity: ${result.standardized.severity}`);
  console.log(`Location: ${result.standardized.location}`);
  console.log(`Types:    ${result.standardized.type.join(', ')}`);
  console.log('-'.repeat(40));
});

// Special test for the exact issue reported
console.log('\n' + '='.repeat(80));
console.log('SPECIAL TEST - Reported Issue:');
console.log('=' .repeat(80));

const problemInput = 'quarter panel left dent multiple';
console.log(`\nOriginal Input: "${problemInput}"`);

const mapping = mapDamage(problemInput);
console.log(`Auction Format: "${mapping.auctionFormat}"`);
console.log(`Expected:       "Left Quarter Panel · Dent / Multiple"`);
console.log(`Match: ${mapping.auctionFormat === 'Left Quarter Panel · Dent / Multiple' ? '✅ PASS' : '❌ FAIL'}`);

// Test right fender format
const fenderTest = 'right fender dent';
const fenderMapping = mapDamage(fenderTest);
console.log(`\nFender Test: "${fenderTest}"`);
console.log(`Output:    "${fenderMapping.auctionFormat}"`);
console.log(`Expected:  "Right Fender · Dent"`);
console.log(`Match: ${fenderMapping.auctionFormat === 'Right Fender · Dent' ? '✅ PASS' : '❌ FAIL'}`);

console.log('\n' + '='.repeat(80));
console.log('Test complete!');