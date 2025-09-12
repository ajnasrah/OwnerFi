export function calculateMonthlyPayment(
  principal: number,
  interestRate: number,
  termYears: number
): number {
  if (interestRate === 0) {
    return principal / (termYears * 12);
  }
  
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = termYears * 12;
  
  const monthlyPayment = principal * 
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  return Math.round(monthlyPayment * 100) / 100;
}

export function calculateDownPaymentAmount(
  listPrice: number,
  downPaymentPercentage: number
): number {
  return Math.round(listPrice * (downPaymentPercentage / 100) * 100) / 100;
}

export function calculateFinancedAmount(
  listPrice: number,
  downPaymentAmount: number
): number {
  return listPrice - downPaymentAmount;
}

export function validatePropertyCalculations(property: {
  listPrice: number;
  downPaymentPercentage: number;
  interestRate: number;
  termYears: number;
}) {
  const errors: string[] = [];
  
  if (property.listPrice <= 0) {
    errors.push('List price must be greater than 0');
  }
  
  if (property.downPaymentPercentage < 0 || property.downPaymentPercentage > 100) {
    errors.push('Down payment percentage must be between 0 and 100');
  }
  
  if (property.interestRate < 0 || property.interestRate > 50) {
    errors.push('Interest rate must be between 0 and 50');
  }
  
  if (property.termYears <= 0 || property.termYears > 50) {
    errors.push('Term years must be between 1 and 50');
  }
  
  return errors;
}