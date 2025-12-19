// Cash flow calculation utilities for real estate investment analysis

export interface CashFlowInput {
  price: number;
  rentEstimate: number;
  annualTax?: number;
  monthlyHoa?: number;
}

export interface CashFlowResult {
  downPayment: number;
  totalInvestment: number;
  monthlyMortgage: number;
  monthlyInsurance: number;
  monthlyTax: number;
  monthlyHoa: number;
  monthlyMgmt: number;
  monthlyExpenses: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  cocReturn: number;
  usedEstimatedTax: boolean;
  calculatedAt: string;
}

// Calculate monthly mortgage payment using amortization formula
function calculateMonthlyMortgage(loanAmount: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  if (monthlyRate === 0) return loanAmount / numPayments;
  const x = Math.pow(1 + monthlyRate, numPayments);
  return loanAmount * (monthlyRate * x) / (x - 1);
}

// Check which fields are missing for cash flow calculation
export function getMissingCashFlowFields(data: Record<string, unknown>): string[] {
  const missing: string[] = [];

  const price = data.price || data.listPrice || 0;
  const rentEstimate = data.rentEstimate || data.rentalEstimate || data.rentZestimate || 0;

  if (!price || price <= 0) missing.push('price');
  if (!rentEstimate || rentEstimate <= 0) missing.push('rentEstimate');

  return missing;
}

// Calculate cash flow analysis for a property
export function calculateCashFlow(
  input: CashFlowInput,
  useEstimatedTax: boolean = false
): CashFlowResult | null {
  const { price, rentEstimate, annualTax = 0, monthlyHoa = 0 } = input;

  // Can't calculate without price and rent
  if (!price || price <= 0 || !rentEstimate || rentEstimate <= 0) {
    return null;
  }

  // Financing assumptions
  const DOWN_PAYMENT_PERCENT = 0.10; // 10% down
  const CLOSING_COSTS_PERCENT = 0.03; // 3% closing costs
  const INTEREST_RATE = 0.06; // 6% annual
  const LOAN_TERM_YEARS = 20;

  // Operating expense rates
  const INSURANCE_RATE = 0.01; // 1% of price annually
  const PROPERTY_MGMT_RATE = 0.10; // 10% of rent
  const VACANCY_RATE = 0.08; // 8% vacancy allowance
  const MAINTENANCE_RATE = 0.05; // 5% of rent for repairs
  const CAPEX_RATE = 0.05; // 5% of rent for capital expenditures

  // Estimate tax as 1.2% of price if not provided
  const ESTIMATED_TAX_RATE = 0.012;
  const effectiveTax = useEstimatedTax || !annualTax || annualTax <= 0
    ? price * ESTIMATED_TAX_RATE
    : annualTax;

  // Investment calculation
  const downPayment = price * DOWN_PAYMENT_PERCENT;
  const closingCosts = price * CLOSING_COSTS_PERCENT;
  const totalInvestment = downPayment + closingCosts;

  const loanAmount = price - downPayment;

  // Monthly calculations
  const monthlyMortgage = calculateMonthlyMortgage(loanAmount, INTEREST_RATE, LOAN_TERM_YEARS);
  const monthlyInsurance = (price * INSURANCE_RATE) / 12;
  const monthlyTax = effectiveTax / 12;
  const monthlyMgmt = rentEstimate * PROPERTY_MGMT_RATE;

  // Additional operating expenses
  const monthlyVacancy = rentEstimate * VACANCY_RATE;
  const monthlyMaintenance = rentEstimate * MAINTENANCE_RATE;
  const monthlyCapex = rentEstimate * CAPEX_RATE;

  // Total monthly expenses
  const monthlyExpenses = monthlyMortgage + monthlyInsurance + monthlyTax + monthlyHoa +
                          monthlyMgmt + monthlyVacancy + monthlyMaintenance + monthlyCapex;

  // Cash flow
  const monthlyCashFlow = rentEstimate - monthlyExpenses;
  const annualCashFlow = monthlyCashFlow * 12;

  // Cash-on-Cash Return
  const cocReturn = totalInvestment > 0 ? (annualCashFlow / totalInvestment) * 100 : 0;

  return {
    downPayment: Math.round(downPayment),
    totalInvestment: Math.round(totalInvestment),
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyInsurance: Math.round(monthlyInsurance),
    monthlyTax: Math.round(monthlyTax),
    monthlyHoa: Math.round(monthlyHoa),
    monthlyMgmt: Math.round(monthlyMgmt),
    monthlyExpenses: Math.round(monthlyExpenses),
    monthlyCashFlow: Math.round(monthlyCashFlow),
    annualCashFlow: Math.round(annualCashFlow),
    cocReturn: Math.round(cocReturn * 10) / 10,
    usedEstimatedTax: useEstimatedTax || !annualTax || annualTax <= 0,
    calculatedAt: new Date().toISOString(),
  };
}
