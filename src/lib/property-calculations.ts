// Property Financial Calculations for Owner Financing
// Handles scenarios where some values are provided and others need calculation

export interface PropertyFinancials {
  listPrice: number;
  downPaymentAmount: number;
  downPaymentPercent: number;
  monthlyPayment: number;
  interestRate: number;
  termYears: number;
  loanAmount: number;
  balloonPayment?: number;
  balloonYears?: number;
}

export interface PartialPropertyData {
  listPrice?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  monthlyPayment?: number;
  interestRate?: number;
  termYears?: number;
  balloonPayment?: number;
  balloonYears?: number;
}

/**
 * Calculate default amortization period based on property price
 * Used internally for calculations, but not displayed if not explicitly provided
 * <150k: 15 years
 * 150k-300k: 20 years
 * 300k-600k: 25 years
 * 600k+: 30 years
 */
function getDefaultTermYears(listPrice: number): number {
  if (listPrice < 150000) return 15;
  if (listPrice < 300000) return 20;
  if (listPrice < 600000) return 25;
  return 30;
}

/**
 * Calculate missing financial fields based on provided data
 * Can handle various combinations of provided/missing fields
 */
export function calculatePropertyFinancials(data: PartialPropertyData): PropertyFinancials {
  const listPrice = data.listPrice || 0;
  let downPaymentAmount = data.downPaymentAmount || 0;
  let downPaymentPercent = data.downPaymentPercent || 0;
  const providedMonthlyPayment = data.monthlyPayment || 0;
  const providedInterestRate = data.interestRate;
  const providedTermYears = data.termYears;

  // Calculate missing down payment fields
  if (listPrice > 0) {
    if (downPaymentAmount > 0 && downPaymentPercent === 0) {
      // Have amount, calculate percentage
      downPaymentPercent = (downPaymentAmount / listPrice) * 100;
    } else if (downPaymentPercent > 0 && downPaymentAmount === 0) {
      // Have percentage, calculate amount
      downPaymentAmount = listPrice * (downPaymentPercent / 100);
    } else if (downPaymentAmount === 0 && downPaymentPercent === 0) {
      // Neither provided, default to 10%
      downPaymentPercent = 10;
      downPaymentAmount = listPrice * 0.10;
    }
  }

  // Calculate loan amount
  const loanAmount = listPrice - downPaymentAmount;

  // PRIORITY CALCULATION LOGIC
  let monthlyPayment = 0;
  let termYears = 0;
  let interestRate = 0;
  let termYearsForCalculation = 0; // Internal use for calculations
  let interestRateForCalculation = 0; // Internal use for calculations
  const wasTermYearsProvided = !!(providedTermYears && providedTermYears > 0);
  const wasInterestRateProvided = !!(providedInterestRate && providedInterestRate > 0);

  if (providedMonthlyPayment > 0) {
    // PRIORITY 1: Monthly payment provided - use it directly
    monthlyPayment = providedMonthlyPayment;
    interestRateForCalculation = providedInterestRate || 7.0; // Default for internal calculations
    interestRate = providedInterestRate || 0; // Only show if provided by seller

    if (providedInterestRate && providedInterestRate > 0 && loanAmount > 0) {
      // Calculate term from monthly payment + interest rate (internal use only)
      termYearsForCalculation = calculateTermYears(providedMonthlyPayment, loanAmount, providedInterestRate);
      // Only show term in UI if it was explicitly provided by seller
      termYears = providedTermYears || 0;
    } else {
      // Use provided term or default for calculation, but return 0 if not provided
      termYearsForCalculation = providedTermYears || getDefaultTermYears(listPrice);
      termYears = providedTermYears || 0;
    }

  } else if (providedInterestRate && providedInterestRate > 0 && providedTermYears && providedTermYears > 0) {
    // PRIORITY 2: Interest rate + term years provided - calculate monthly payment
    interestRate = providedInterestRate;
    interestRateForCalculation = providedInterestRate;
    termYears = providedTermYears;
    termYearsForCalculation = providedTermYears;
    if (loanAmount > 0) {
      monthlyPayment = calculateMonthlyPayment(loanAmount, interestRateForCalculation, termYearsForCalculation);
    }

  } else if (providedInterestRate && providedInterestRate > 0) {
    // PRIORITY 3: Only interest rate provided - use default term for calculation
    interestRate = providedInterestRate;
    interestRateForCalculation = providedInterestRate;
    termYearsForCalculation = providedTermYears || getDefaultTermYears(listPrice);
    termYears = providedTermYears || 0; // Return 0 if not provided (shows "Contact seller")
    if (loanAmount > 0) {
      monthlyPayment = calculateMonthlyPayment(loanAmount, interestRateForCalculation, termYearsForCalculation);
    }

  } else {
    // PRIORITY 4: Nothing provided - use defaults for calculation only
    interestRateForCalculation = providedInterestRate || 7.0;
    interestRate = providedInterestRate || 0; // Only show if provided by seller
    termYearsForCalculation = providedTermYears || getDefaultTermYears(listPrice);
    termYears = providedTermYears || 0; // Return 0 if not provided (shows "Contact seller")
    if (loanAmount > 0 && interestRateForCalculation > 0) {
      monthlyPayment = calculateMonthlyPayment(loanAmount, interestRateForCalculation, termYearsForCalculation);
    }
  }

  // Validate and ensure reasonable values
  // NOTE: termYears can be 0 to show "Contact seller" in UI
  return {
    listPrice: Math.max(0, listPrice),
    downPaymentAmount: Math.max(0, downPaymentAmount),
    downPaymentPercent: Math.max(0, Math.min(100, downPaymentPercent)), // Cap at 100%
    monthlyPayment: Math.max(0, monthlyPayment),
    interestRate: Math.max(0, Math.min(50, interestRate)), // Cap at 50%
    termYears: termYears > 0 ? Math.max(1, Math.min(50, termYears)) : 0, // 1-50 years or 0 for "Contact seller"
    loanAmount: Math.max(0, loanAmount),
    balloonPayment: data.balloonPayment,
    balloonYears: data.balloonYears
  };
}

/**
 * Calculate monthly payment using standard mortgage formula
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 */
export function calculateMonthlyPayment(
  loanAmount: number, 
  annualRate: number, 
  termYears: number
): number {
  if (loanAmount <= 0 || annualRate <= 0 || termYears <= 0) return 0;
  
  const monthlyRate = annualRate / 100 / 12; // Convert to decimal and monthly
  const numPayments = termYears * 12;
  
  if (monthlyRate === 0) {
    // No interest (rare but possible)
    return loanAmount / numPayments;
  }
  
  const monthlyPayment = loanAmount * 
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);
    
  return Math.round(monthlyPayment * 100) / 100; // Round to nearest cent
}

/**
 * Calculate loan amount from monthly payment (reverse calculation)
 */
export function calculateLoanAmount(
  monthlyPayment: number,
  annualRate: number,
  termYears: number
): number {
  if (monthlyPayment <= 0 || annualRate <= 0 || termYears <= 0) return 0;

  const monthlyRate = annualRate / 100 / 12;
  const numPayments = termYears * 12;

  if (monthlyRate === 0) {
    return monthlyPayment * numPayments;
  }

  const loanAmount = monthlyPayment *
    (Math.pow(1 + monthlyRate, numPayments) - 1) /
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments));

  return Math.round(loanAmount * 100) / 100;
}

/**
 * Calculate term years from monthly payment (reverse calculation)
 * Solves for N in the amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
 * Uses logarithms to solve for n (number of payments)
 */
export function calculateTermYears(
  monthlyPayment: number,
  loanAmount: number,
  annualRate: number
): number {
  if (monthlyPayment <= 0 || loanAmount <= 0 || annualRate < 0) return 0;

  const monthlyRate = annualRate / 100 / 12;

  // Special case: 0% interest
  if (monthlyRate === 0) {
    const months = loanAmount / monthlyPayment;
    return Math.round((months / 12) * 10) / 10; // Round to 1 decimal
  }

  // Check if payment is sufficient to cover interest
  const minPayment = loanAmount * monthlyRate;
  if (monthlyPayment <= minPayment) {
    // Payment doesn't cover interest - would take forever
    return 50; // Return max term
  }

  // Solve for n using logarithms:
  // n = log(M / (M - P*r)) / log(1 + r)
  const numerator = Math.log(monthlyPayment / (monthlyPayment - loanAmount * monthlyRate));
  const denominator = Math.log(1 + monthlyRate);
  const numPayments = numerator / denominator;

  // Convert months to years and round to 1 decimal
  const years = numPayments / 12;
  return Math.round(years * 10) / 10;
}


/**
 * Validate that calculated financials make sense
 */
export function validatePropertyFinancials(financials: PropertyFinancials): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (financials.listPrice <= 0) {
    errors.push('List price must be greater than 0');
  }
  if (financials.listPrice > 10000000) {
    warnings.push('List price seems unusually high (>$10M)');
  }

  // Down payment validation
  if (financials.downPaymentAmount < 0) {
    errors.push('Down payment cannot be negative');
  }
  if (financials.downPaymentAmount >= financials.listPrice) {
    errors.push('Down payment cannot be greater than list price');
  }
  if (financials.downPaymentPercent > 95) {
    warnings.push('Down payment percentage seems very high (>95%)');
  }

  // Monthly payment validation
  if (financials.monthlyPayment <= 0) {
    errors.push('Monthly payment must be greater than 0');
  }
  
  // Interest rate validation
  if (financials.interestRate < 0 || financials.interestRate > 50) {
    errors.push('Interest rate must be between 0% and 50%');
  }
  if (financials.interestRate > 15) {
    warnings.push('Interest rate seems high (>15%) - verify this is correct');
  }

  // Term validation
  if (financials.termYears < 1 || financials.termYears > 50) {
    errors.push('Loan term must be between 1 and 50 years');
  }

  // Sanity check: recalculate monthly payment and compare
  const calculatedPayment = calculateMonthlyPayment(
    financials.loanAmount,
    financials.interestRate,
    financials.termYears
  );
  
  const paymentDifference = Math.abs(calculatedPayment - financials.monthlyPayment);
  const percentageDiff = (paymentDifference / financials.monthlyPayment) * 100;
  
  if (percentageDiff > 5) { // More than 5% difference
    warnings.push(
      `Monthly payment may be incorrect. Expected ~$${calculatedPayment.toLocaleString()} ` +
      `but got $${financials.monthlyPayment.toLocaleString()}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Helper function to format currency for display
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Calculate total interest paid over the life of the loan
export function calculateTotalInterest(financials: PropertyFinancials): number {
  const totalPayments = financials.monthlyPayment * financials.termYears * 12;
  return totalPayments - financials.loanAmount;
}

// Calculate the loan-to-value ratio
export function calculateLTV(financials: PropertyFinancials): number {
  if (financials.listPrice <= 0) return 0;
  return (financials.loanAmount / financials.listPrice) * 100;
}