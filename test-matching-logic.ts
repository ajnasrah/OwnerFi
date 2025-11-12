/**
 * Test script to verify OR logic for buyer-property matching
 *
 * This script tests the new matching logic where properties match if they meet
 * at least ONE of the two budget criteria (monthly payment OR down payment).
 */

import { isPropertyMatch } from './src/lib/matching';

// Test buyer profile
const testBuyer = {
  id: 'test-buyer-1',
  maxMonthlyPayment: 1500,
  maxDownPayment: 15000,
  preferredCity: 'Houston',
  preferredState: 'TX',
  searchRadius: 30,
  minBedrooms: 3,
  minBathrooms: 2
};

// Test properties with different budget match scenarios
const testProperties = [
  {
    id: 'prop-1-perfect-match',
    name: 'Perfect Match Property',
    monthlyPayment: 1400,
    downPaymentAmount: 12000,
    city: 'Houston',
    state: 'TX',
    bedrooms: 3,
    bathrooms: 2,
    expectedMatch: true,
    expectedBudgetType: 'both'
  },
  {
    id: 'prop-2-monthly-only',
    name: 'Monthly Payment Only Match',
    monthlyPayment: 1300,
    downPaymentAmount: 20000, // Over budget
    city: 'Houston',
    state: 'TX',
    bedrooms: 3,
    bathrooms: 2,
    expectedMatch: true,
    expectedBudgetType: 'monthly_only'
  },
  {
    id: 'prop-3-down-only',
    name: 'Down Payment Only Match',
    monthlyPayment: 1800, // Over budget
    downPaymentAmount: 10000,
    city: 'Houston',
    state: 'TX',
    bedrooms: 3,
    bathrooms: 2,
    expectedMatch: true,
    expectedBudgetType: 'down_only'
  },
  {
    id: 'prop-4-neither',
    name: 'Neither Budget Match',
    monthlyPayment: 2000, // Over budget
    downPaymentAmount: 25000, // Over budget
    city: 'Houston',
    state: 'TX',
    bedrooms: 3,
    bathrooms: 2,
    expectedMatch: false,
    expectedBudgetType: 'neither'
  },
  {
    id: 'prop-5-wrong-location',
    name: 'Wrong Location (Perfect Budget)',
    monthlyPayment: 1200,
    downPaymentAmount: 10000,
    city: 'Dallas',
    state: 'TX',
    bedrooms: 3,
    bathrooms: 2,
    expectedMatch: false,
    expectedBudgetType: 'neither' // When location fails, budgetMatchType returns 'neither'
  },
  {
    id: 'prop-6-edge-case-exact',
    name: 'Edge Case - Exact Budget Match',
    monthlyPayment: 1500, // Exactly at budget
    downPaymentAmount: 15000, // Exactly at budget
    city: 'Houston',
    state: 'TX',
    bedrooms: 3,
    bathrooms: 2,
    expectedMatch: true,
    expectedBudgetType: 'both'
  }
];

console.log('🧪 Testing OR Logic for Buyer-Property Matching\n');
console.log('━'.repeat(80));
console.log(`Buyer Budget: $${testBuyer.maxMonthlyPayment}/mo, $${testBuyer.maxDownPayment.toLocaleString()} down`);
console.log(`Location: ${testBuyer.preferredCity}, ${testBuyer.preferredState}`);
console.log(`Requirements: ${testBuyer.minBedrooms} bed, ${testBuyer.minBathrooms} bath`);
console.log('━'.repeat(80));
console.log('');

let passedTests = 0;
let failedTests = 0;

testProperties.forEach((property) => {
  console.log(`\n📋 Testing: ${property.name}`);
  console.log(`   Property: $${property.monthlyPayment}/mo, $${property.downPaymentAmount.toLocaleString()} down`);
  console.log(`   Location: ${property.city}, ${property.state}`);

  const result = isPropertyMatch(property, testBuyer);

  console.log(`   Result: ${result.matches ? '✅ MATCH' : '❌ NO MATCH'}`);
  console.log(`   Budget Type: ${result.budgetMatchType}`);
  console.log(`   Score: ${(result.score * 100).toFixed(0)}%`);
  console.log(`   Matched On:`);
  console.log(`     - Monthly Payment: ${result.matchedOn.monthly_payment ? '✅' : '❌'}`);
  console.log(`     - Down Payment: ${result.matchedOn.down_payment ? '✅' : '❌'}`);
  console.log(`     - Location: ${result.matchedOn.location ? '✅' : '❌'}`);
  console.log(`     - Bedrooms: ${result.matchedOn.bedrooms ? '✅' : '❌'}`);
  console.log(`     - Bathrooms: ${result.matchedOn.bathrooms ? '✅' : '❌'}`);

  // Verify expectations
  const matchExpected = result.matches === property.expectedMatch;
  const budgetTypeExpected = result.budgetMatchType === property.expectedBudgetType;

  if (matchExpected && budgetTypeExpected) {
    console.log(`   ✅ TEST PASSED`);
    passedTests++;
  } else {
    console.log(`   ❌ TEST FAILED`);
    if (!matchExpected) {
      console.log(`      Expected match: ${property.expectedMatch}, Got: ${result.matches}`);
    }
    if (!budgetTypeExpected) {
      console.log(`      Expected budget type: ${property.expectedBudgetType}, Got: ${result.budgetMatchType}`);
    }
    failedTests++;
  }
});

console.log('\n');
console.log('━'.repeat(80));
console.log(`\n📊 Test Summary:`);
console.log(`   Total Tests: ${testProperties.length}`);
console.log(`   ✅ Passed: ${passedTests}`);
console.log(`   ❌ Failed: ${failedTests}`);
console.log(`   Success Rate: ${((passedTests / testProperties.length) * 100).toFixed(0)}%`);
console.log('');

if (failedTests === 0) {
  console.log('🎉 All tests passed! OR logic is working correctly.');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please review the logic.');
  process.exit(1);
}
