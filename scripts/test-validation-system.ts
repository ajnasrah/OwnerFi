/**
 * Test Property Validation System
 * Simulates GoHighLevel webhook with various data scenarios
 */

import { validatePropertyFinancials, formatValidationResult, type PropertyFinancialData } from '../src/lib/property-validation';

console.log('🧪 TESTING PROPERTY VALIDATION SYSTEM\n');
console.log('='.repeat(80));
console.log('Simulating GoHighLevel webhook scenarios\n');

// Test scenarios based on common GHL data issues
const testScenarios: Array<{ name: string; data: PropertyFinancialData; shouldReject: boolean }> = [
  // Test 1: Good property - should PASS
  {
    name: 'Valid GHL Property',
    shouldReject: false,
    data: {
      listPrice: 250000,
      monthlyPayment: 1800,
      downPaymentAmount: 25000,
      downPaymentPercent: 10,
      interestRate: 8,
      termYears: 20,
      address: '123 Main St',
      city: 'Dallas',
      state: 'TX'
    }
  },

  // Test 2: Wrong down payment (6710 Blanco St scenario)
  {
    name: 'Wrong Down Payment (6710 Blanco St)',
    shouldReject: true,
    data: {
      listPrice: 599900,
      monthlyPayment: 4500,
      downPaymentAmount: 25, // WRONG - should be $149,975
      downPaymentPercent: 0.004, // 25/599900 = 0.004%
      interestRate: 9,
      termYears: 20,
      address: '6710 Blanco St',
      city: 'Edinburg',
      state: 'TX'
    }
  },

  // Test 3: Monthly payment too low (doesn't cover interest)
  {
    name: 'Payment Doesnt Cover Interest',
    shouldReject: true,
    data: {
      listPrice: 200000,
      monthlyPayment: 500, // Way too low - interest alone is ~$1,500/mo
      downPaymentAmount: 20000,
      downPaymentPercent: 10,
      interestRate: 9,
      termYears: 20,
      address: '456 Oak Ave',
      city: 'Houston',
      state: 'TX'
    }
  },

  // Test 4: Price suspiciously low (missing zeros)
  {
    name: 'Price Missing Zeros',
    shouldReject: true,
    data: {
      listPrice: 5000, // Should be $50,000
      monthlyPayment: 400,
      downPaymentAmount: 500,
      downPaymentPercent: 10,
      interestRate: 8,
      termYears: 15,
      address: '789 Elm St',
      city: 'Austin',
      state: 'TX'
    }
  },

  // Test 5: Interest rate way too high
  {
    name: 'Usury Rate (22%)',
    shouldReject: true,
    data: {
      listPrice: 180000,
      monthlyPayment: 3200,
      downPaymentAmount: 18000,
      downPaymentPercent: 10,
      interestRate: 22, // Likely violates usury laws
      termYears: 20,
      address: '321 Pine Rd',
      city: 'San Antonio',
      state: 'TX'
    }
  },

  // Test 6: Payment includes taxes/insurance (warning, not error)
  {
    name: 'Payment With Taxes/Insurance',
    shouldReject: false, // Should pass but with warnings
    data: {
      listPrice: 300000,
      monthlyPayment: 2800, // Includes taxes/insurance (~$600 extra)
      downPaymentAmount: 30000,
      downPaymentPercent: 10,
      interestRate: 7,
      termYears: 25,
      address: '555 Maple Dr',
      city: 'Fort Worth',
      state: 'TX'
    }
  },

  // Test 7: Decimal term years (reverse calculated)
  {
    name: 'Decimal Term Years',
    shouldReject: false, // Warning only
    data: {
      listPrice: 220000,
      monthlyPayment: 1650,
      downPaymentAmount: 22000,
      downPaymentPercent: 10,
      interestRate: 7.5,
      termYears: 17.3, // Reverse calculated
      address: '888 Cedar Ln',
      city: 'Plano',
      state: 'TX'
    }
  },

  // Test 8: Very high down payment
  {
    name: 'Very High Down Payment (85%)',
    shouldReject: false, // Warning only
    data: {
      listPrice: 400000,
      monthlyPayment: 800,
      downPaymentAmount: 340000, // 85% down
      downPaymentPercent: 85,
      interestRate: 6,
      termYears: 10,
      address: '999 Birch Ct',
      city: 'Arlington',
      state: 'TX'
    }
  },

  // Test 9: Payment calculation way off (50%+ difference)
  {
    name: 'Payment Calculation Off 50%',
    shouldReject: true,
    data: {
      listPrice: 275000,
      monthlyPayment: 3500, // Should be ~$1,900 for these terms
      downPaymentAmount: 27500,
      downPaymentPercent: 10,
      interestRate: 7,
      termYears: 25,
      address: '111 Spruce Way',
      city: 'Irving',
      state: 'TX'
    }
  },

  // Test 10: Annual payment exceeds 15% of price
  {
    name: 'Annual Payment Too High',
    shouldReject: true,
    data: {
      listPrice: 150000,
      monthlyPayment: 2500, // $30k/year = 20% of price
      downPaymentAmount: 15000,
      downPaymentPercent: 10,
      interestRate: 10,
      termYears: 10,
      address: '222 Willow Ave',
      city: 'Garland',
      state: 'TX'
    }
  }
];

// Run tests
let passed = 0;
let failed = 0;

testScenarios.forEach((scenario, index) => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST ${index + 1}: ${scenario.name}`);
  console.log('='.repeat(80));

  const result = validatePropertyFinancials(scenario.data);

  console.log(formatValidationResult(result, scenario.data));

  // Check if result matches expectation
  const expectReject = scenario.shouldReject;
  const actualReject = result.shouldAutoReject;

  if (expectReject === actualReject) {
    console.log(`✅ TEST PASSED - Expected ${expectReject ? 'REJECT' : 'PASS'}, Got ${actualReject ? 'REJECT' : 'PASS'}`);
    passed++;
  } else {
    console.log(`❌ TEST FAILED - Expected ${expectReject ? 'REJECT' : 'PASS'}, Got ${actualReject ? 'REJECT' : 'PASS'}`);
    failed++;
  }
});

// Summary
console.log('\n\n' + '='.repeat(80));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(80));
console.log(`Total Tests: ${testScenarios.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Success Rate: ${((passed / testScenarios.length) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 ALL TESTS PASSED! Validation system is working correctly.\n');
} else {
  console.log('\n⚠️  SOME TESTS FAILED - Review validation rules.\n');
}

console.log('='.repeat(80));
console.log('');
