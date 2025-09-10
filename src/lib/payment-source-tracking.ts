// Payment Source Tracking - Distinguish imported vs calculated values

interface PropertyData {
  listPrice?: number;
  interestRate?: number;
  termYears?: number;
  downPaymentAmount?: number;
  downPaymentPercent?: number;
  monthlyPayment?: number;
}

interface PropertyFinancialResult {
  listPrice: number;
  interestRate: number;
  termYears: number;
  downPaymentAmount: number;
  downPaymentPercent: number;
  monthlyPayment: number;
  loanAmount: number;
  paymentMetadata: PaymentMetadata;
  [key: string]: unknown;
}

export interface PaymentMetadata {
  monthlyPayment: {
    value: number;
    source: 'imported' | 'calculated';
    calculationMethod?: string;
  };
  downPaymentAmount: {
    value: number;
    source: 'imported' | 'calculated';
    calculationMethod?: string;
  };
  downPaymentPercent: {
    value: number;
    source: 'imported' | 'calculated';
    calculationMethod?: string;
  };
  lastCalculated?: string;
}

/**
 * Enhanced property financial calculation with source tracking
 */
export function calculatePropertyFinancialsWithTracking(data: PropertyData): PropertyFinancialResult {
  const result: Partial<PropertyFinancialResult> = {
    listPrice: data.listPrice || 0,
    interestRate: data.interestRate || 7.0,
    termYears: data.termYears || 20,
  };

  // Track payment sources
  const paymentMetadata: PaymentMetadata = {
    monthlyPayment: {
      value: 0,
      source: 'calculated'
    },
    downPaymentAmount: {
      value: 0,
      source: 'calculated'
    },
    downPaymentPercent: {
      value: 0,
      source: 'calculated'
    },
    lastCalculated: new Date().toISOString()
  };

  // DOWN PAYMENT LOGIC with source tracking
  if (data.downPaymentAmount && data.downPaymentAmount > 0) {
    // ✅ IMPORTED down payment amount
    result.downPaymentAmount = data.downPaymentAmount;
    paymentMetadata.downPaymentAmount = {
      value: data.downPaymentAmount,
      source: 'imported'
    };
    
    // Calculate percentage from imported amount
    if ((result.listPrice ?? 0) > 0) {
      result.downPaymentPercent = ((data.downPaymentAmount ?? 0) / (result.listPrice ?? 1)) * 100;
      paymentMetadata.downPaymentPercent = {
        value: result.downPaymentPercent,
        source: 'calculated',
        calculationMethod: 'derived_from_imported_amount'
      };
    }
    
  } else if (data.downPaymentPercent && data.downPaymentPercent > 0) {
    // ✅ IMPORTED down payment percentage
    result.downPaymentPercent = data.downPaymentPercent;
    paymentMetadata.downPaymentPercent = {
      value: data.downPaymentPercent,
      source: 'imported'
    };
    
    // Calculate amount from imported percentage
    result.downPaymentAmount = (result.listPrice ?? 0) * ((data.downPaymentPercent ?? 0) / 100);
    paymentMetadata.downPaymentAmount = {
      value: result.downPaymentAmount,
      source: 'calculated',
      calculationMethod: 'derived_from_imported_percentage'
    };
    
  } else {
    // ❌ NEITHER PROVIDED - Default to 10%
    result.downPaymentPercent = 10;
    result.downPaymentAmount = (result.listPrice ?? 0) * 0.10;
    paymentMetadata.downPaymentPercent = {
      value: 10,
      source: 'calculated',
      calculationMethod: 'default_10_percent'
    };
    paymentMetadata.downPaymentAmount = {
      value: result.downPaymentAmount,
      source: 'calculated',
      calculationMethod: 'derived_from_default_percentage'
    };
  }

  // MONTHLY PAYMENT LOGIC with source tracking
  if (data.monthlyPayment && data.monthlyPayment > 0) {
    // ✅ IMPORTED monthly payment - USE AS-IS
    result.monthlyPayment = data.monthlyPayment;
    paymentMetadata.monthlyPayment = {
      value: data.monthlyPayment,
      source: 'imported'
    };
    
  } else {
    // ❌ MISSING - Calculate using mortgage formula
    const loanAmount = (result.listPrice ?? 0) - (result.downPaymentAmount ?? 0);
    if (loanAmount > 0 && (result.interestRate ?? 0) > 0 && (result.termYears ?? 0) > 0) {
      const monthlyRate = (result.interestRate ?? 0) / 100 / 12;
      const numPayments = (result.termYears ?? 0) * 12;
      
      if (monthlyRate === 0) {
        result.monthlyPayment = loanAmount / numPayments;
      } else {
        result.monthlyPayment = loanAmount * 
          (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
          (Math.pow(1 + monthlyRate, numPayments) - 1);
      }
      result.monthlyPayment = Math.round((result.monthlyPayment ?? 0) * 100) / 100;
    } else {
      result.monthlyPayment = 0;
    }
    
    paymentMetadata.monthlyPayment = {
      value: result.monthlyPayment,
      source: 'calculated',
      calculationMethod: '20_year_amortization_formula'
    };
  }

  result.loanAmount = (result.listPrice ?? 0) - (result.downPaymentAmount ?? 0);
  result.paymentMetadata = paymentMetadata;

  return result as PropertyFinancialResult;
}

/**
 * Get display labels based on payment source
 */
export function getPaymentDisplayInfo(paymentMetadata: PaymentMetadata) {
  return {
    monthlyPayment: {
      label: paymentMetadata.monthlyPayment.source === 'imported' ? 'Monthly Payment' : 'Monthly Payment (est)',
      isEstimate: paymentMetadata.monthlyPayment.source === 'calculated',
      confidence: paymentMetadata.monthlyPayment.source === 'imported' ? 'definitive' : 'estimated'
    },
    downPaymentAmount: {
      label: paymentMetadata.downPaymentAmount.source === 'imported' ? 'Down Payment' : 'Down Payment (est)',
      isEstimate: paymentMetadata.downPaymentAmount.source === 'calculated',
      confidence: paymentMetadata.downPaymentAmount.source === 'imported' ? 'definitive' : 'estimated'
    },
    downPaymentPercent: {
      label: paymentMetadata.downPaymentPercent.source === 'imported' ? 'Down Payment %' : 'Down Payment % (est)',
      isEstimate: paymentMetadata.downPaymentPercent.source === 'calculated',
      confidence: paymentMetadata.downPaymentPercent.source === 'imported' ? 'definitive' : 'estimated'
    }
  };
}

/**
 * Validate if imported payment makes sense vs calculated payment
 */
export function validateImportedPayment(property: PropertyData): {
  monthlyPaymentValid: boolean;
  monthlyPaymentDifference: number;
  recommendedPayment: number;
  trustImported: boolean;
} {
  const loanAmount = (property.listPrice || 0) - (property.downPaymentAmount || 0);
  const monthlyRate = (property.interestRate || 7.0) / 100 / 12;
  const numPayments = (property.termYears || 20) * 12;
  
  let calculatedPayment = 0;
  if (loanAmount > 0 && monthlyRate > 0) {
    calculatedPayment = loanAmount * 
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
      (Math.pow(1 + monthlyRate, numPayments) - 1);
    calculatedPayment = Math.round(calculatedPayment * 100) / 100;
  }
  
  const difference = Math.abs(calculatedPayment - (property.monthlyPayment || 0));
  const percentageDiff = (difference / Math.max(property.monthlyPayment || 1, 1)) * 100;
  
  return {
    monthlyPaymentValid: percentageDiff < 10, // Within 10% is acceptable
    monthlyPaymentDifference: difference,
    recommendedPayment: calculatedPayment,
    trustImported: percentageDiff < 5 // Trust imported if within 5%
  };
}