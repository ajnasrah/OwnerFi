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
 * Calculate missing financial fields based on provided data
 * Can handle various combinations of provided/missing fields
 */
export function calculatePropertyFinancials(data: PartialPropertyData): PropertyFinancials {
  const listPrice = data.listPrice || 0;
  let downPaymentAmount = data.downPaymentAmount || 0;
  let downPaymentPercent = data.downPaymentPercent || 0;
  let monthlyPayment = data.monthlyPayment || 0;
  const interestRate = data.interestRate || 7.0; // Default 7% if not provided
  const termYears = data.termYears || 20; // Default 20 years

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

  // Calculate monthly payment if not provided
  if (monthlyPayment === 0 && loanAmount > 0 && interestRate > 0 && termYears > 0) {
    monthlyPayment = calculateMonthlyPayment(loanAmount, interestRate, termYears);
  }

  // Validate and ensure reasonable values
  return {
    listPrice: Math.max(0, listPrice),
    downPaymentAmount: Math.max(0, downPaymentAmount),
    downPaymentPercent: Math.max(0, Math.min(100, downPaymentPercent)), // Cap at 100%
    monthlyPayment: Math.max(0, monthlyPayment),
    interestRate: Math.max(0, Math.min(50, interestRate)), // Cap at 50%
    termYears: Math.max(1, Math.min(50, termYears)), // 1-50 years
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