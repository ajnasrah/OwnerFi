/**
 * Test calculation logic with sample property data
 */

import { calculateMissingFinancials } from '../src/lib/property-validation';

console.log('Testing Financial Calculation Logic\n');
console.log('='.repeat(80));

// Test Case 1: Property with price, down payment, and interest rate but NO monthly payment
console.log('\nTest Case 1: Calculate MONTHLY PAYMENT');
console.log('-'.repeat(80));
const test1 = {
  listPrice: 195000,
  downPaymentAmount: 20000,
  downPaymentPercent: 10.26, // 20000/195000
  monthlyPayment: 0, // MISSING
  interestRate: 8,
  termYears: 30
};

console.log('INPUT:');
console.log(`  Price: $${test1.listPrice.toLocaleString()}`);
console.log(`  Down Payment: $${test1.downPaymentAmount.toLocaleString()} (${test1.downPaymentPercent}%)`);
console.log(`  Interest Rate: ${test1.interestRate}%`);
console.log(`  Term: ${test1.termYears} years`);
console.log(`  Monthly Payment: $${test1.monthlyPayment} (MISSING)`);

const result1 = calculateMissingFinancials(test1);

console.log('\nOUTPUT:');
console.log(`  Calculated Monthly Payment: $${result1.monthlyPayment.toFixed(2)}`);
if (result1.calculationApplied) {
  console.log(`  Calculation Applied: ${result1.calculationApplied}`);
}

// Test Case 2: Property with price and down payment percent but NO down payment amount
console.log('\n\nTest Case 2: Calculate DOWN PAYMENT AMOUNT from percent');
console.log('-'.repeat(80));
const test2 = {
  listPrice: 150000,
  downPaymentAmount: 0, // MISSING
  downPaymentPercent: 15,
  monthlyPayment: 0,
  interestRate: 7.5,
  termYears: 25
};

console.log('INPUT:');
console.log(`  Price: $${test2.listPrice.toLocaleString()}`);
console.log(`  Down Payment Percent: ${test2.downPaymentPercent}%`);
console.log(`  Down Payment Amount: $${test2.downPaymentAmount} (MISSING)`);
console.log(`  Interest Rate: ${test2.interestRate}%`);
console.log(`  Term: ${test2.termYears} years`);

const result2 = calculateMissingFinancials(test2);

console.log('\nOUTPUT:');
console.log(`  Calculated Down Payment: $${result2.downPaymentAmount.toFixed(2)}`);
console.log(`  Calculated Monthly Payment: $${result2.monthlyPayment.toFixed(2)}`);
if (result2.calculationApplied) {
  console.log(`  Calculation Applied: ${result2.calculationApplied}`);
}

// Test Case 3: Property from CSV with missing monthly payment (real example)
console.log('\n\nTest Case 3: Real CSV data - 6240 Tributary');
console.log('-'.repeat(80));
const test3 = {
  listPrice: 189900,
  downPaymentAmount: 18990,
  downPaymentPercent: 10,
  monthlyPayment: 0, // MISSING in CSV
  interestRate: 8,
  termYears: 30
};

console.log('INPUT (from CSV):');
console.log(`  Price: $${test3.listPrice.toLocaleString()}`);
console.log(`  Down Payment: $${test3.downPaymentAmount.toLocaleString()} (${test3.downPaymentPercent}%)`);
console.log(`  Interest Rate: ${test3.interestRate}%`);
console.log(`  Term: ${test3.termYears} years`);
console.log(`  Monthly Payment: $${test3.monthlyPayment} (MISSING in CSV)`);

const result3 = calculateMissingFinancials(test3);

console.log('\nOUTPUT:');
console.log(`  Calculated Monthly Payment: $${result3.monthlyPayment.toFixed(2)}`);
if (result3.calculationApplied) {
  console.log(`  Calculation Applied: ${result3.calculationApplied}`);
}

// Verify using amortization formula manually
const loanAmount = test3.listPrice - test3.downPaymentAmount;
const monthlyRate = test3.interestRate / 100 / 12;
const numPayments = test3.termYears * 12;
const manualCalculation = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                         (Math.pow(1 + monthlyRate, numPayments) - 1);

console.log(`\nManual verification:`);
console.log(`  Loan Amount: $${loanAmount.toLocaleString()}`);
console.log(`  Monthly Rate: ${(monthlyRate * 100).toFixed(4)}%`);
console.log(`  Number of Payments: ${numPayments}`);
console.log(`  Manual Calculation: $${manualCalculation.toFixed(2)}`);
console.log(`  Match: ${Math.abs(result3.monthlyPayment - manualCalculation) < 0.01 ? '✅ YES' : '❌ NO'}`);

console.log('\n' + '='.repeat(80));
console.log('All tests completed!\n');
