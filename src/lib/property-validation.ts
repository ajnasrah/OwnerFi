/**
 * Property Financial Validation System
 * Catches outliers and unusual data before properties go live
 */

export interface ValidationResult {
  isValid: boolean;
  severity: 'error' | 'warning' | 'info';
  issues: ValidationIssue[];
  shouldAutoReject: boolean; // Auto-reject if true
  needsReview: boolean; // Flag for manual review if true
}

export interface ValidationIssue {
  field: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  expectedRange?: string;
  actualValue: any;
  suggestion?: string;
}

export interface PropertyFinancialData {
  listPrice: number;
  monthlyPayment: number;
  downPaymentAmount: number;
  downPaymentPercent: number;
  interestRate: number;
  termYears: number;
  address?: string;
  city?: string;
  state?: string;
}

/**
 * Main validation function - catches all outliers and unusual data
 */
export function validatePropertyFinancials(property: PropertyFinancialData): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Run all validation checks
  issues.push(...validatePriceRange(property));
  issues.push(...validateDownPayment(property));
  issues.push(...validateInterestRate(property));
  issues.push(...validateTermYears(property));
  issues.push(...validateMonthlyPayment(property));
  issues.push(...validateAmortizationConsistency(property));
  issues.push(...validatePaymentToIncomeRatio(property));
  issues.push(...validateOutliers(property));

  // Determine severity
  const hasErrors = issues.some(i => i.severity === 'error');
  const hasWarnings = issues.some(i => i.severity === 'warning');

  // Auto-reject criteria
  const shouldAutoReject = hasErrors || issues.some(i =>
    i.issue.includes('mathematically impossible') ||
    i.issue.includes('extreme outlier')
  );

  // Needs review criteria
  const needsReview = shouldAutoReject || hasWarnings;

  return {
    isValid: !hasErrors,
    severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'info',
    issues,
    shouldAutoReject,
    needsReview
  };
}

/**
 * Validate price is in reasonable range
 */
function validatePriceRange(property: PropertyFinancialData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { listPrice } = property;

  if (listPrice <= 0) {
    issues.push({
      field: 'listPrice',
      issue: 'Price must be greater than $0',
      severity: 'error',
      actualValue: listPrice
    });
  }

  if (listPrice < 10000) {
    issues.push({
      field: 'listPrice',
      issue: 'Price unusually low - likely data entry error',
      severity: 'error',
      expectedRange: '$10,000 - $10,000,000',
      actualValue: listPrice,
      suggestion: 'Verify price is correct (not missing zeros)'
    });
  }

  if (listPrice > 10000000) {
    issues.push({
      field: 'listPrice',
      issue: 'Price unusually high for owner financing',
      severity: 'warning',
      expectedRange: '$10,000 - $10,000,000',
      actualValue: listPrice,
      suggestion: 'Verify this is an actual owner-financed property'
    });
  }

  return issues;
}

/**
 * Validate down payment makes sense
 */
function validateDownPayment(property: PropertyFinancialData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { listPrice, downPaymentAmount, downPaymentPercent } = property;

  // Check down payment amount
  if (downPaymentAmount < 0) {
    issues.push({
      field: 'downPaymentAmount',
      issue: 'Down payment cannot be negative',
      severity: 'error',
      actualValue: downPaymentAmount
    });
  }

  if (downPaymentAmount >= listPrice) {
    issues.push({
      field: 'downPaymentAmount',
      issue: 'Down payment exceeds list price',
      severity: 'error',
      actualValue: downPaymentAmount,
      suggestion: 'Down payment should be less than list price'
    });
  }

  // Check down payment percentage
  if (downPaymentPercent < 0 || downPaymentPercent > 100) {
    issues.push({
      field: 'downPaymentPercent',
      issue: 'Down payment percentage out of valid range',
      severity: 'error',
      expectedRange: '0% - 100%',
      actualValue: `${downPaymentPercent}%`
    });
  }

  // Unusual percentages
  if (downPaymentPercent < 5) {
    issues.push({
      field: 'downPaymentPercent',
      issue: 'Down payment very low for owner financing',
      severity: 'warning',
      expectedRange: '5% - 50%',
      actualValue: `${downPaymentPercent}%`,
      suggestion: 'Typical owner financing requires 10-20% down'
    });
  }

  if (downPaymentPercent > 75) {
    issues.push({
      field: 'downPaymentPercent',
      issue: 'Down payment unusually high',
      severity: 'warning',
      expectedRange: '5% - 75%',
      actualValue: `${downPaymentPercent}%`,
      suggestion: 'With this much down, buyer may prefer traditional mortgage'
    });
  }

  // Verify calculation consistency
  const calculatedPercent = (downPaymentAmount / listPrice) * 100;
  const percentDiff = Math.abs(calculatedPercent - downPaymentPercent);

  if (percentDiff > 1) {
    issues.push({
      field: 'downPaymentPercent',
      issue: 'Down payment amount and percentage do not match',
      severity: 'error',
      actualValue: `${downPaymentPercent}% (should be ${calculatedPercent.toFixed(1)}%)`,
      suggestion: 'Recalculate: $' + downPaymentAmount.toLocaleString() + ' / $' + listPrice.toLocaleString()
    });
  }

  return issues;
}

/**
 * Validate interest rate is reasonable
 */
function validateInterestRate(property: PropertyFinancialData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { interestRate } = property;

  if (interestRate < 0 || interestRate > 50) {
    issues.push({
      field: 'interestRate',
      issue: 'Interest rate out of valid range',
      severity: 'error',
      expectedRange: '0% - 50%',
      actualValue: `${interestRate}%`
    });
  }

  if (interestRate < 3) {
    issues.push({
      field: 'interestRate',
      issue: 'Interest rate unusually low for owner financing',
      severity: 'warning',
      expectedRange: '5% - 12%',
      actualValue: `${interestRate}%`,
      suggestion: 'Typical owner financing rates: 7-10%'
    });
  }

  if (interestRate > 15) {
    issues.push({
      field: 'interestRate',
      issue: 'Interest rate very high',
      severity: 'warning',
      expectedRange: '5% - 15%',
      actualValue: `${interestRate}%`,
      suggestion: 'Verify rate is correct - may be uncompetitive'
    });
  }

  if (interestRate > 20) {
    issues.push({
      field: 'interestRate',
      issue: 'Interest rate extreme outlier',
      severity: 'error',
      actualValue: `${interestRate}%`,
      suggestion: 'This rate may violate usury laws in some states'
    });
  }

  return issues;
}

/**
 * Validate term years is reasonable
 */
function validateTermYears(property: PropertyFinancialData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { termYears, listPrice } = property;

  if (termYears <= 0 || termYears > 50) {
    issues.push({
      field: 'termYears',
      issue: 'Term years out of valid range',
      severity: 'error',
      expectedRange: '5 - 40 years',
      actualValue: `${termYears} years`
    });
  }

  if (termYears < 10) {
    issues.push({
      field: 'termYears',
      issue: 'Term unusually short',
      severity: 'warning',
      expectedRange: '10 - 40 years',
      actualValue: `${termYears} years`,
      suggestion: 'Short terms result in high monthly payments'
    });
  }

  if (termYears > 40) {
    issues.push({
      field: 'termYears',
      issue: 'Term unusually long',
      severity: 'warning',
      expectedRange: '10 - 40 years',
      actualValue: `${termYears} years`,
      suggestion: 'Standard mortgages max at 30-40 years'
    });
  }

  // Check if decimal term years (indicates reverse calculation)
  if (termYears % 1 !== 0) {
    issues.push({
      field: 'termYears',
      issue: 'Term has decimal places (reverse-calculated from payment)',
      severity: 'warning',
      actualValue: `${termYears} years`,
      suggestion: `Consider rounding to ${Math.round(termYears)} years for clarity`
    });
  }

  // Price-based term validation
  if (listPrice < 150000 && termYears > 20) {
    issues.push({
      field: 'termYears',
      issue: 'Term may be too long for property price',
      severity: 'info',
      actualValue: `${termYears} years for $${listPrice.toLocaleString()}`,
      suggestion: 'Properties under $150k typically have 15-20 year terms'
    });
  }

  return issues;
}

/**
 * Validate monthly payment is reasonable
 */
function validateMonthlyPayment(property: PropertyFinancialData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { monthlyPayment, listPrice, downPaymentAmount } = property;
  const loanAmount = listPrice - downPaymentAmount;

  if (monthlyPayment <= 0) {
    issues.push({
      field: 'monthlyPayment',
      issue: 'Monthly payment must be greater than $0',
      severity: 'error',
      actualValue: monthlyPayment
    });
  }

  // Payment should not exceed 1% of loan amount per month (too high)
  const maxReasonablePayment = loanAmount * 0.02; // 2% of loan per month
  if (monthlyPayment > maxReasonablePayment) {
    issues.push({
      field: 'monthlyPayment',
      issue: 'Monthly payment unusually high for loan amount',
      severity: 'warning',
      actualValue: `$${monthlyPayment.toLocaleString()}`,
      suggestion: `For $${loanAmount.toLocaleString()} loan, expect $${(loanAmount * 0.01).toFixed(0)}-$${maxReasonablePayment.toFixed(0)}/mo`
    });
  }

  // Payment should not be less than 0.3% of loan amount per month (too low)
  const minReasonablePayment = loanAmount * 0.003; // 0.3% of loan per month
  if (monthlyPayment < minReasonablePayment) {
    issues.push({
      field: 'monthlyPayment',
      issue: 'Monthly payment unusually low for loan amount',
      severity: 'warning',
      actualValue: `$${monthlyPayment.toLocaleString()}`,
      suggestion: `For $${loanAmount.toLocaleString()} loan, expect at least $${minReasonablePayment.toFixed(0)}/mo`
    });
  }

  return issues;
}

/**
 * Validate that payment matches amortization formula
 */
function validateAmortizationConsistency(property: PropertyFinancialData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { listPrice, downPaymentAmount, monthlyPayment, interestRate, termYears } = property;

  const loanAmount = listPrice - downPaymentAmount;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = termYears * 12;

  // Calculate what payment should be
  let calculatedPayment: number;
  if (monthlyRate > 0) {
    calculatedPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                       (Math.pow(1 + monthlyRate, numPayments) - 1);
  } else {
    calculatedPayment = loanAmount / numPayments;
  }

  const paymentDiff = Math.abs(calculatedPayment - monthlyPayment);
  const percentDiff = (paymentDiff / monthlyPayment) * 100;

  // Allow for taxes/insurance/HOA in payment (up to 50% more than calculated)
  if (percentDiff > 50) {
    issues.push({
      field: 'monthlyPayment',
      issue: 'Payment does not match amortization calculation',
      severity: 'error',
      actualValue: `$${monthlyPayment.toLocaleString()} (calculated: $${calculatedPayment.toFixed(0)})`,
      suggestion: 'Payment differs by ' + percentDiff.toFixed(0) + '% - verify all numbers are correct'
    });
  } else if (percentDiff > 30) {
    issues.push({
      field: 'monthlyPayment',
      issue: 'Payment significantly higher than P&I alone',
      severity: 'warning',
      actualValue: `$${monthlyPayment.toLocaleString()} (P&I: $${calculatedPayment.toFixed(0)})`,
      suggestion: 'Payment may include taxes, insurance, or HOA fees'
    });
  } else if (percentDiff > 10 && percentDiff <= 30) {
    issues.push({
      field: 'monthlyPayment',
      issue: 'Payment differs from calculated amount',
      severity: 'info',
      actualValue: `$${monthlyPayment.toLocaleString()} (calculated: $${calculatedPayment.toFixed(0)})`,
      suggestion: 'Minor difference OK - may include escrow'
    });
  }

  // Check if payment doesn't even cover interest
  const monthlyInterest = loanAmount * monthlyRate;
  if (monthlyPayment < monthlyInterest) {
    issues.push({
      field: 'monthlyPayment',
      issue: 'Payment does not cover monthly interest - mathematically impossible',
      severity: 'error',
      actualValue: `$${monthlyPayment.toLocaleString()} (interest alone: $${monthlyInterest.toFixed(0)})`,
      suggestion: 'This would result in negative amortization - check all numbers'
    });
  }

  return issues;
}

/**
 * Validate payment to income ratio (rough estimate)
 */
function validatePaymentToIncomeRatio(property: PropertyFinancialData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { monthlyPayment, listPrice } = property;

  // Rough estimate: monthly payment should not exceed 40% of typical income for price range
  const estimatedMonthlyIncome = getEstimatedMonthlyIncome(listPrice);
  const maxPayment = estimatedMonthlyIncome * 0.4;

  if (monthlyPayment > maxPayment) {
    issues.push({
      field: 'monthlyPayment',
      issue: 'Payment may be unaffordable for typical buyer',
      severity: 'info',
      actualValue: `$${monthlyPayment.toLocaleString()}`,
      suggestion: `For a $${listPrice.toLocaleString()} home, max payment typically $${maxPayment.toFixed(0)}`
    });
  }

  return issues;
}

/**
 * Detect extreme outliers across all fields
 */
function validateOutliers(property: PropertyFinancialData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Payment-to-price ratio outlier
  const paymentToPriceRatio = (property.monthlyPayment * 12) / property.listPrice;
  if (paymentToPriceRatio > 0.15) {
    issues.push({
      field: 'monthlyPayment',
      issue: 'Annual payments exceed 15% of price - extreme outlier',
      severity: 'error',
      actualValue: `${(paymentToPriceRatio * 100).toFixed(1)}%`,
      suggestion: 'Check if monthly payment is actually annual payment'
    });
  }

  // Down payment too close to price
  const downRatio = property.downPaymentAmount / property.listPrice;
  if (downRatio > 0.9) {
    issues.push({
      field: 'downPaymentAmount',
      issue: 'Down payment is 90%+ of price',
      severity: 'warning',
      actualValue: `${(downRatio * 100).toFixed(1)}%`,
      suggestion: 'Buyer may prefer to pay cash instead of financing'
    });
  }

  return issues;
}

/**
 * Estimate monthly income based on property price
 */
function getEstimatedMonthlyIncome(listPrice: number): number {
  // Rule of thumb: home price should be 3-5x annual income
  // So monthly income ≈ (price / 4) / 12
  return (listPrice / 4) / 12;
}

/**
 * Format validation result for logging/display
 */
export function formatValidationResult(result: ValidationResult, property: PropertyFinancialData): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('PROPERTY FINANCIAL VALIDATION RESULT');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`Address: ${property.address || 'Unknown'}, ${property.city || ''}, ${property.state || ''}`);
  lines.push(`Price: $${property.listPrice.toLocaleString()}`);
  lines.push(`Monthly Payment: $${property.monthlyPayment.toLocaleString()}`);
  lines.push(`Term: ${property.termYears} years @ ${property.interestRate}%`);
  lines.push(`Down: $${property.downPaymentAmount.toLocaleString()} (${property.downPaymentPercent.toFixed(1)}%)`);
  lines.push('');

  if (result.shouldAutoReject) {
    lines.push('🚫 STATUS: AUTO-REJECTED - NEEDS REVIEW');
  } else if (result.needsReview) {
    lines.push('⚠️  STATUS: NEEDS MANUAL REVIEW');
  } else {
    lines.push('✅ STATUS: APPROVED');
  }

  lines.push('');

  if (result.issues.length > 0) {
    lines.push(`ISSUES FOUND (${result.issues.length}):`);
    lines.push('-'.repeat(80));

    result.issues.forEach((issue, index) => {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`\n${index + 1}. ${icon} ${issue.field.toUpperCase()}`);
      lines.push(`   Issue: ${issue.issue}`);
      lines.push(`   Value: ${issue.actualValue}`);
      if (issue.expectedRange) lines.push(`   Expected: ${issue.expectedRange}`);
      if (issue.suggestion) lines.push(`   Suggestion: ${issue.suggestion}`);
    });
  } else {
    lines.push('✅ No issues found - all checks passed');
  }

  lines.push('');
  lines.push('='.repeat(80));

  return lines.join('\n');
}
