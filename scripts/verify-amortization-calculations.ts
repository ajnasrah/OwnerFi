/**
 * Verify Amortization Calculations
 * Tests the property-calculations.ts functions to ensure accuracy
 */

import {
  calculatePropertyFinancials,
  calculateMonthlyPayment,
  calculateLoanAmount,
  calculateTermYears,
  validatePropertyFinancials
} from '../src/lib/property-calculations';

interface TestCase {
  name: string;
  input: {
    listPrice: number;
    downPaymentAmount?: number;
    downPaymentPercent?: number;
    monthlyPayment?: number;
    interestRate?: number;
    termYears?: number;
  };
  expected: {
    monthlyPayment?: number;
    loanAmount?: number;
    termYears?: number;
    tolerance?: number; // Allow small differences due to rounding
  };
}

const testCases: TestCase[] = [
  // Test Case 1: Standard 30-year mortgage
  {
    name: "Standard 30-year @ 7%",
    input: {
      listPrice: 250000,
      downPaymentPercent: 10, // $25,000 down
      interestRate: 7.0,
      termYears: 30
    },
    expected: {
      loanAmount: 225000,
      monthlyPayment: 1497, // Approximately
      tolerance: 5
    }
  },

  // Test Case 2: Monthly payment provided
  {
    name: "Monthly payment provided, calculate term",
    input: {
      listPrice: 200000,
      downPaymentAmount: 20000, // $20k down
      monthlyPayment: 1500,
      interestRate: 6.5
    },
    expected: {
      loanAmount: 180000,
      termYears: 17.5, // Approximately
      tolerance: 1
    }
  },

  // Test Case 3: 15-year mortgage
  {
    name: "15-year @ 6%",
    input: {
      listPrice: 150000,
      downPaymentPercent: 15,
      interestRate: 6.0,
      termYears: 15
    },
    expected: {
      loanAmount: 127500,
      monthlyPayment: 1076, // Approximately
      tolerance: 5
    }
  },

  // Test Case 4: High down payment
  {
    name: "50% down payment",
    input: {
      listPrice: 300000,
      downPaymentPercent: 50,
      interestRate: 5.5,
      termYears: 20
    },
    expected: {
      loanAmount: 150000,
      monthlyPayment: 1032, // Approximately
      tolerance: 5
    }
  },

  // Test Case 5: Low price, short term
  {
    name: "Low price 10-year term",
    input: {
      listPrice: 75000,
      downPaymentAmount: 7500,
      interestRate: 8.0,
      termYears: 10
    },
    expected: {
      loanAmount: 67500,
      monthlyPayment: 819, // Approximately
      tolerance: 5
    }
  },

  // Test Case 6: Only monthly payment provided
  {
    name: "Only monthly payment (reverse calc)",
    input: {
      listPrice: 180000,
      downPaymentPercent: 10,
      monthlyPayment: 1200,
      interestRate: 7.0
    },
    expected: {
      loanAmount: 162000,
      termYears: 23, // Should calculate term based on payment
      tolerance: 2
    }
  },

  // Test Case 7: Zero interest (rare but possible)
  {
    name: "0% interest",
    input: {
      listPrice: 120000,
      downPaymentAmount: 12000,
      interestRate: 0,
      termYears: 10
    },
    expected: {
      loanAmount: 108000,
      monthlyPayment: 900, // Exact: 108000 / 120 months
      tolerance: 0
    }
  },

  // Test Case 8: High interest rate
  {
    name: "High interest rate 12%",
    input: {
      listPrice: 200000,
      downPaymentPercent: 20,
      interestRate: 12.0,
      termYears: 25
    },
    expected: {
      loanAmount: 160000,
      monthlyPayment: 1685, // Approximately
      tolerance: 10
    }
  },

  // Test Case 9: Verify reverse calculation
  {
    name: "Calculate loan amount from payment",
    input: {
      listPrice: 250000,
      downPaymentAmount: 50000,
      monthlyPayment: 1500,
      interestRate: 6.0,
      termYears: 20
    },
    expected: {
      loanAmount: 200000,
      tolerance: 100
    }
  }
];

function testAmortizationCalculations() {
  console.log('🧪 AMORTIZATION CALCULATION VERIFICATION\n');
  console.log('=' .repeat(80));
  console.log('');

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  testCases.forEach((testCase, index) => {
    console.log(`\n📋 Test ${index + 1}: ${testCase.name}`);
    console.log('-'.repeat(80));

    // Calculate financials
    const result = calculatePropertyFinancials(testCase.input);

    // Validate
    const validation = validatePropertyFinancials(result);

    console.log('Input:');
    console.log(`  List Price: $${testCase.input.listPrice.toLocaleString()}`);
    console.log(`  Down Payment: ${testCase.input.downPaymentAmount ? '$' + testCase.input.downPaymentAmount.toLocaleString() : testCase.input.downPaymentPercent + '%'}`);
    console.log(`  Interest Rate: ${testCase.input.interestRate || 'calculated'}%`);
    console.log(`  Term: ${testCase.input.termYears || 'calculated'} years`);
    console.log(`  Monthly Payment: ${testCase.input.monthlyPayment ? '$' + testCase.input.monthlyPayment.toLocaleString() : 'calculated'}`);

    console.log('\nCalculated Results:');
    console.log(`  Loan Amount: $${result.loanAmount.toLocaleString()}`);
    console.log(`  Monthly Payment: $${result.monthlyPayment.toLocaleString()}`);
    console.log(`  Term: ${result.termYears} years`);
    console.log(`  Interest Rate: ${result.interestRate}%`);

    // Check expected values
    let testPassed = true;
    const tolerance = testCase.expected.tolerance || 1;

    if (testCase.expected.loanAmount !== undefined) {
      const diff = Math.abs(result.loanAmount - testCase.expected.loanAmount);
      const withinTolerance = diff <= tolerance;
      console.log(`\n  ✓ Loan Amount: ${withinTolerance ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`    Expected: $${testCase.expected.loanAmount.toLocaleString()}, Got: $${result.loanAmount.toLocaleString()}, Diff: $${diff.toFixed(2)}`);
      if (!withinTolerance) testPassed = false;
    }

    if (testCase.expected.monthlyPayment !== undefined) {
      const diff = Math.abs(result.monthlyPayment - testCase.expected.monthlyPayment);
      const withinTolerance = diff <= tolerance;
      console.log(`  ✓ Monthly Payment: ${withinTolerance ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`    Expected: $${testCase.expected.monthlyPayment.toLocaleString()}, Got: $${result.monthlyPayment.toLocaleString()}, Diff: $${diff.toFixed(2)}`);
      if (!withinTolerance) testPassed = false;
    }

    if (testCase.expected.termYears !== undefined) {
      const diff = Math.abs(result.termYears - testCase.expected.termYears);
      const withinTolerance = diff <= tolerance;
      console.log(`  ✓ Term Years: ${withinTolerance ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`    Expected: ${testCase.expected.termYears} years, Got: ${result.termYears} years, Diff: ${diff.toFixed(1)} years`);
      if (!withinTolerance) testPassed = false;
    }

    // Validation errors/warnings
    if (validation.errors.length > 0) {
      console.log(`\n  ❌ Validation Errors:`);
      validation.errors.forEach(err => console.log(`    - ${err}`));
      testPassed = false;
    }

    if (validation.warnings.length > 0) {
      console.log(`\n  ⚠️  Validation Warnings:`);
      validation.warnings.forEach(warn => console.log(`    - ${warn}`));
    }

    // Verify amortization formula
    console.log('\n  📐 Amortization Formula Verification:');
    const recalculatedPayment = calculateMonthlyPayment(result.loanAmount, result.interestRate, result.termYears);
    const paymentDiff = Math.abs(recalculatedPayment - result.monthlyPayment);
    const paymentMatch = paymentDiff < 1; // Within $1
    console.log(`    Recalculated Monthly Payment: $${recalculatedPayment.toFixed(2)}`);
    console.log(`    Stored Monthly Payment: $${result.monthlyPayment.toFixed(2)}`);
    console.log(`    Difference: $${paymentDiff.toFixed(2)} ${paymentMatch ? '✅' : '⚠️'}`);

    if (testPassed && paymentMatch) {
      console.log(`\n  🎉 Test Result: ✅ PASSED`);
      passed++;
    } else {
      console.log(`\n  ❌ Test Result: FAILED`);
      failed++;
      failures.push(testCase.name);
    }
  });

  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

  if (failures.length > 0) {
    console.log('\n❌ Failed Tests:');
    failures.forEach(name => console.log(`  - ${name}`));
  }

  console.log('\n' + '='.repeat(80));
  console.log('');

  // Additional verification tests
  console.log('🔬 ADDITIONAL FORMULA VERIFICATION\n');
  console.log('='.repeat(80));

  // Test 1: Round-trip calculation
  console.log('\n1️⃣  Round-trip Test (Forward and Reverse):');
  const loanAmt = 200000;
  const rate = 7.0;
  const term = 30;

  const payment = calculateMonthlyPayment(loanAmt, rate, term);
  console.log(`   Starting: $${loanAmt.toLocaleString()} loan @ ${rate}% for ${term} years`);
  console.log(`   Forward Calc: Monthly payment = $${payment.toFixed(2)}`);

  const calculatedLoan = calculateLoanAmount(payment, rate, term);
  console.log(`   Reverse Calc: Loan amount = $${calculatedLoan.toFixed(2)}`);

  const diff = Math.abs(loanAmt - calculatedLoan);
  console.log(`   Difference: $${diff.toFixed(2)} ${diff < 10 ? '✅' : '❌'}`);

  // Test 2: Term calculation
  console.log('\n2️⃣  Term Calculation Test:');
  const knownPayment = 1500;
  const knownLoan = 200000;
  const knownRate = 6.5;

  const calculatedTerm = calculateTermYears(knownPayment, knownLoan, knownRate);
  console.log(`   Payment: $${knownPayment}, Loan: $${knownLoan.toLocaleString()}, Rate: ${knownRate}%`);
  console.log(`   Calculated Term: ${calculatedTerm} years`);

  const verifyPayment = calculateMonthlyPayment(knownLoan, knownRate, calculatedTerm);
  console.log(`   Verify Payment: $${verifyPayment.toFixed(2)}`);
  console.log(`   Match: ${Math.abs(verifyPayment - knownPayment) < 1 ? '✅' : '❌'}`);

  console.log('\n' + '='.repeat(80));
  console.log('');

  if (failed === 0) {
    console.log('✅ ALL AMORTIZATION CALCULATIONS ARE CORRECT!\n');
    return true;
  } else {
    console.log('❌ SOME CALCULATIONS FAILED - REVIEW ABOVE\n');
    return false;
  }
}

// Run tests
testAmortizationCalculations();
