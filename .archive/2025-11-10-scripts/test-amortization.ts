import { calculatePropertyFinancials } from '../src/lib/property-calculations';

// Test cases for dynamic amortization
const testCases = [
  {
    name: 'House under $150k (15 years)',
    listPrice: 120000,
    downPaymentPercent: 10,
    interestRate: 7.0,
    expectedTermYears: 15
  },
  {
    name: 'House $150k-$300k (20 years)',
    listPrice: 200000,
    downPaymentPercent: 10,
    interestRate: 7.0,
    expectedTermYears: 20
  },
  {
    name: 'House $300k-$600k (25 years)',
    listPrice: 450000,
    downPaymentPercent: 10,
    interestRate: 7.0,
    expectedTermYears: 25
  },
  {
    name: 'House $600k+ (30 years)',
    listPrice: 750000,
    downPaymentPercent: 10,
    interestRate: 7.0,
    expectedTermYears: 30
  }
];

console.log('🏡 Testing Dynamic Amortization Logic\n');
console.log('=' .repeat(80));

testCases.forEach(testCase => {
  console.log(`\n📋 ${testCase.name}`);
  console.log('-'.repeat(80));

  // Test without provided monthly payment (should calculate)
  const result = calculatePropertyFinancials({
    listPrice: testCase.listPrice,
    downPaymentPercent: testCase.downPaymentPercent,
    interestRate: testCase.interestRate,
    // termYears intentionally omitted to test default
  });

  console.log(`   List Price:         $${testCase.listPrice.toLocaleString()}`);
  console.log(`   Down Payment:       ${testCase.downPaymentPercent}% ($${result.downPaymentAmount.toLocaleString()})`);
  console.log(`   Loan Amount:        $${result.loanAmount.toLocaleString()}`);
  console.log(`   Interest Rate:      ${testCase.interestRate}%`);
  console.log(`   Expected Term:      ${testCase.expectedTermYears} years`);
  console.log(`   Actual Term:        ${result.termYears} years`);
  console.log(`   Monthly Payment:    $${result.monthlyPayment.toLocaleString()}`);

  const passed = result.termYears === testCase.expectedTermYears;
  console.log(`   Status:             ${passed ? '✅ PASS' : '❌ FAIL'}`);
});

console.log('\n' + '='.repeat(80));
console.log('\n🧪 Testing Pre-filled Monthly Payment (Should NOT recalculate)\n');
console.log('=' .repeat(80));

// Test with pre-filled monthly payment (should NOT recalculate)
const preFillTest = {
  listPrice: 200000,
  downPaymentPercent: 10,
  interestRate: 7.0,
  monthlyPayment: 1500, // Pre-filled value
};

const preFilledResult = calculatePropertyFinancials(preFillTest);

console.log(`   List Price:         $${preFillTest.listPrice.toLocaleString()}`);
console.log(`   Down Payment:       ${preFillTest.downPaymentPercent}%`);
console.log(`   Pre-filled Payment: $${preFillTest.monthlyPayment.toLocaleString()}`);
console.log(`   Result Payment:     $${preFilledResult.monthlyPayment.toLocaleString()}`);
console.log(`   Status:             ${preFilledResult.monthlyPayment === preFillTest.monthlyPayment ? '✅ PRESERVED (correct)' : '❌ RECALCULATED (wrong)'}`);

console.log('\n' + '='.repeat(80));
console.log('\n✅ All tests completed!\n');
