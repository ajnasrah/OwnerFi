/**
 * Automated Market Cost Analysis for Target Cities
 * 
 * Factors in: Property taxes, insurance, HOA fees, labor costs, and market conditions
 * to provide automated city scoring for owner financing and cash flow optimization
 */

interface MarketCostData {
  // Tax burden (effective property tax rate)
  propertyTaxRate: number;           // % of home value annually
  
  // Insurance costs 
  homeInsuranceAnnual: number;       // Average annual insurance cost
  insuranceRiskLevel: 'low' | 'moderate' | 'high' | 'extreme';
  
  // HOA prevalence and costs
  hoaPrevalence: number;             // % of properties with HOA
  avgHoaMonthly: number;            // Average monthly HOA fee
  
  // Labor and maintenance costs
  laborCostIndex: number;           // Relative to national average (1.0 = average)
  maintenanceCostMultiplier: number; // Cost factor for property maintenance
  
  // Market conditions
  medianHomePrice: number;          // Typical property price
  rentToOwnRatio: number;           // Rent/price ratio (higher = better cash flow)
  
  // Overall investment score (calculated)
  overallScore?: number;
  riskAdjustedScore?: number;
}

// Comprehensive market cost data based on 2025 research
export const MARKET_COST_DATA: Record<string, MarketCostData> = {
  // === TIER 1: TOP CASH FLOW MARKETS ===
  'cleveland': {
    propertyTaxRate: 1.80,        // Cuyahoga County (high but yields are 9.8%)
    homeInsuranceAnnual: 1200,    // Moderate Midwest rates
    insuranceRiskLevel: 'moderate',
    hoaPrevalence: 15,            // Low HOA presence
    avgHoaMonthly: 150,
    laborCostIndex: 0.85,         // Below national average
    maintenanceCostMultiplier: 0.9,
    medianHomePrice: 150000,
    rentToOwnRatio: 0.098         // 9.8% rental yield
  },
  
  'toledo': {
    propertyTaxRate: 1.45,        // Ohio average, lower than Cleveland
    homeInsuranceAnnual: 1100,
    insuranceRiskLevel: 'low',
    hoaPrevalence: 10,            // Very low HOA presence
    avgHoaMonthly: 120,
    laborCostIndex: 0.80,         // Low labor costs
    maintenanceCostMultiplier: 0.85,
    medianHomePrice: 135000,
    rentToOwnRatio: 0.092
  },
  
  'indianapolis': {
    propertyTaxRate: 1.15,        // Indiana - moderate
    homeInsuranceAnnual: 1300,
    insuranceRiskLevel: 'moderate',
    hoaPrevalence: 25,
    avgHoaMonthly: 180,
    laborCostIndex: 0.88,
    maintenanceCostMultiplier: 0.90,
    medianHomePrice: 180000,
    rentToOwnRatio: 0.085
  },
  
  'detroit': {
    propertyTaxRate: 1.55,        // Wayne County
    homeInsuranceAnnual: 1400,    // Higher due to urban risks
    insuranceRiskLevel: 'moderate',
    hoaPrevalence: 20,
    avgHoaMonthly: 160,
    laborCostIndex: 0.90,
    maintenanceCostMultiplier: 1.10, // Higher maintenance in urban areas
    medianHomePrice: 125000,
    rentToOwnRatio: 0.095
  },
  
  'memphis': {
    propertyTaxRate: 0.91,        // Shelby County (TN = low tax state)
    homeInsuranceAnnual: 1500,    // Tornado risk
    insuranceRiskLevel: 'moderate',
    hoaPrevalence: 18,            // Low HOA market - good for owner finance
    avgHoaMonthly: 79,            // TN average - very low
    laborCostIndex: 0.75,         // Very low labor costs
    maintenanceCostMultiplier: 0.85,
    medianHomePrice: 120000,
    rentToOwnRatio: 0.110         // 11% rent-to-price ratio!
  },
  
  // === TIER 2: BALANCED MARKETS ===
  'nashville': {
    propertyTaxRate: 0.55,        // Davidson County (low)
    homeInsuranceAnnual: 1600,    // Tornado + growth area
    insuranceRiskLevel: 'moderate',
    hoaPrevalence: 35,            // Higher growth = more HOAs
    avgHoaMonthly: 200,
    laborCostIndex: 1.10,         // Growth market = higher labor
    maintenanceCostMultiplier: 1.05,
    medianHomePrice: 320000,      // More expensive due to growth
    rentToOwnRatio: 0.065
  },
  
  'charlotte': {
    propertyTaxRate: 1.05,        // NC moderate
    homeInsuranceAnnual: 1400,
    insuranceRiskLevel: 'moderate',
    hoaPrevalence: 40,            // Banking center = more HOAs
    avgHoaMonthly: 220,
    laborCostIndex: 0.95,
    maintenanceCostMultiplier: 0.95,
    medianHomePrice: 280000,
    rentToOwnRatio: 0.070
  },
  
  // === TIER 3: HIGHER COST BUT GROWING ===
  'tampa': {
    propertyTaxRate: 0.83,        // FL - no income tax but property tax
    homeInsuranceAnnual: 4400,    // FL insurance crisis!
    insuranceRiskLevel: 'extreme', // Hurricane + insurance crisis
    hoaPrevalence: 45,            // FL HOA heavy
    avgHoaMonthly: 312,           // FL average
    laborCostIndex: 0.85,         // Lower labor costs
    maintenanceCostMultiplier: 1.20, // Hurricane maintenance
    medianHomePrice: 350000,
    rentToOwnRatio: 0.055
  },
  
  'orlando': {
    propertyTaxRate: 0.83,
    homeInsuranceAnnual: 4200,    // Slightly lower than Tampa
    insuranceRiskLevel: 'high',
    hoaPrevalence: 50,            // Very HOA heavy
    avgHoaMonthly: 285,
    laborCostIndex: 0.82,
    maintenanceCostMultiplier: 1.15,
    medianHomePrice: 320000,
    rentToOwnRatio: 0.060
  },
  
  'dallas': {
    propertyTaxRate: 1.94,        // El Paso County (high TX taxes)
    homeInsuranceAnnual: 4900,    // TX weather risks
    insuranceRiskLevel: 'high',   // Hail + tornados
    hoaPrevalence: 35,
    avgHoaMonthly: 250,
    laborCostIndex: 0.85,         // Lower labor costs
    maintenanceCostMultiplier: 1.10,
    medianHomePrice: 380000,
    rentToOwnRatio: 0.052
  },
  
  'houston': {
    propertyTaxRate: 1.75,        // High TX property tax
    homeInsuranceAnnual: 5200,    // Hurricanes + flooding
    insuranceRiskLevel: 'extreme',
    hoaPrevalence: 30,
    avgHoaMonthly: 220,
    laborCostIndex: 0.88,
    maintenanceCostMultiplier: 1.25, // Flood/hurricane maintenance
    medianHomePrice: 290000,
    rentToOwnRatio: 0.058
  },
  
  'phoenix': {
    propertyTaxRate: 0.88,        // AZ moderate
    homeInsuranceAnnual: 1800,    // Moderate desert risks
    insuranceRiskLevel: 'moderate',
    hoaPrevalence: 60,            // Desert HOAs for pools/amenities
    avgHoaMonthly: 400,           // High due to amenities
    laborCostIndex: 0.92,
    maintenanceCostMultiplier: 1.15, // AC/pool maintenance
    medianHomePrice: 420000,      // Expensive growth market
    rentToOwnRatio: 0.048
  }
};

/**
 * Calculate comprehensive investment score for a market
 * Higher score = better for owner financing and cash flow
 */
export function calculateMarketScore(marketData: MarketCostData): number {
  const {
    propertyTaxRate,
    homeInsuranceAnnual,
    hoaPrevalence,
    avgHoaMonthly,
    laborCostIndex,
    maintenanceCostMultiplier,
    medianHomePrice,
    rentToOwnRatio,
    insuranceRiskLevel
  } = marketData;
  
  // Calculate annual carrying costs per $100k of property value
  const annualTaxPer100k = propertyTaxRate * 1000; // Tax on $100k
  const insurancePer100k = (homeInsuranceAnnual / medianHomePrice) * 100000;
  const hoaCostPer100k = (hoaPrevalence / 100) * (avgHoaMonthly * 12) * (100000 / medianHomePrice);
  
  const totalCarryingCostsPer100k = annualTaxPer100k + insurancePer100k + hoaCostPer100k;
  
  // Score components (higher = better)
  const cashFlowScore = rentToOwnRatio * 1000;     // Rent yield importance
  const lowCostScore = Math.max(0, 50 - totalCarryingCostsPer100k / 100); // Lower costs = higher score
  const laborAffordabilityScore = (2 - laborCostIndex) * 20; // Lower labor costs = higher score
  const maintenanceScore = (2 - maintenanceCostMultiplier) * 15;
  
  // Risk penalty
  const insuranceRiskPenalty = {
    'low': 0,
    'moderate': -5,
    'high': -15,
    'extreme': -30
  }[insuranceRiskLevel];
  
  const rawScore = cashFlowScore + lowCostScore + laborAffordabilityScore + maintenanceScore + insuranceRiskPenalty;
  
  return Math.round(Math.max(0, rawScore)); // Ensure non-negative
}

/**
 * Get ranked markets by investment score
 */
export function getRankedMarkets(): Array<{city: string, score: number, data: MarketCostData}> {
  const rankedMarkets = Object.entries(MARKET_COST_DATA).map(([city, data]) => ({
    city,
    score: calculateMarketScore(data),
    data: {
      ...data,
      overallScore: calculateMarketScore(data)
    }
  }));
  
  return rankedMarkets.sort((a, b) => b.score - a.score);
}

/**
 * Get investment analysis for a specific market
 */
export function getMarketAnalysis(city: string): {
  score: number;
  analysis: string;
  warnings: string[];
  advantages: string[];
} | null {
  const marketData = MARKET_COST_DATA[city.toLowerCase()];
  if (!marketData) return null;
  
  const score = calculateMarketScore(marketData);
  const warnings: string[] = [];
  const advantages: string[] = [];
  
  // Generate warnings
  if (marketData.propertyTaxRate > 1.5) {
    warnings.push(`High property taxes (${marketData.propertyTaxRate}%)`);
  }
  if (marketData.homeInsuranceAnnual > 3000) {
    warnings.push(`High insurance costs ($${marketData.homeInsuranceAnnual.toLocaleString()}/year)`);
  }
  if (marketData.insuranceRiskLevel === 'extreme') {
    warnings.push('Extreme weather/insurance risk');
  }
  if (marketData.hoaPrevalence > 40) {
    warnings.push(`High HOA prevalence (${marketData.hoaPrevalence}% of properties)`);
  }
  
  // Generate advantages
  if (marketData.rentToOwnRatio > 0.08) {
    advantages.push(`Excellent cash flow potential (${(marketData.rentToOwnRatio * 100).toFixed(1)}% yield)`);
  }
  if (marketData.laborCostIndex < 0.9) {
    advantages.push('Below-average maintenance and labor costs');
  }
  if (marketData.propertyTaxRate < 1.0) {
    advantages.push(`Low property taxes (${marketData.propertyTaxRate}%)`);
  }
  if (marketData.hoaPrevalence < 25) {
    advantages.push('Low HOA prevalence - good for owner finance flexibility');
  }
  
  const analysis = `Score: ${score}/100. ${advantages.length > warnings.length ? 'Strong' : warnings.length > advantages.length ? 'Challenging' : 'Balanced'} market for owner financing.`;
  
  return { score, analysis, warnings, advantages };
}

/**
 * Filter cities by minimum investment score
 */
export function getQualifiedMarkets(minScore: number = 60): string[] {
  return getRankedMarkets()
    .filter(market => market.score >= minScore)
    .map(market => market.city);
}