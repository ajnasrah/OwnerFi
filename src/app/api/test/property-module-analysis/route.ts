import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCitiesDatabaseStats } from '@/lib/comprehensive-cities';

/**
 * COMPREHENSIVE PROPERTY MODULE ANALYSIS
 */
export async function GET() {
  try {
    const startTime = Date.now();
    
    // Get all properties for analysis
    const snapshot = await getDocs(collection(db, 'properties'));
    const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Analyze property data quality
    const dataQuality = analyzeDataQuality(properties);
    
    // Analyze geographic distribution
    const geoDistribution = analyzeGeographicDistribution(properties);
    
    // Analyze financial data
    const financialAnalysis = analyzeFinancialData(properties);
    
    // Analyze nearby cities coverage
    const nearbyCitiesAnalysis = analyzeNearbyCitiesCoverage(properties);
    
    // Get cities database stats
    const citiesDbStats = getCitiesDatabaseStats();
    
    const analysisTime = Date.now() - startTime;
    
    return NextResponse.json({
      propertyModuleAnalysis: {
        timestamp: new Date().toISOString(),
        analysisTime: `${analysisTime}ms`,
        totalProperties: properties.length
      },
      dataQuality,
      geoDistribution,
      financialAnalysis,
      nearbyCitiesAnalysis,
      citiesDatabase: {
        totalUSCities: citiesDbStats.totalCities,
        coverageByState: citiesDbStats.largestStates.slice(0, 10)
      },
      overallAssessment: generateOverallAssessment(dataQuality, geoDistribution, financialAnalysis, nearbyCitiesAnalysis),
      recommendations: generateRecommendations(properties)
    });
    
  } catch (error) {
    console.error('Property module analysis error:', error);
    return NextResponse.json({ 
      error: 'Analysis failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}

function analyzeDataQuality(properties: Record<string, unknown>[]) {
  const requiredFields = ['address', 'city', 'state', 'bedrooms', 'bathrooms', 'listPrice', 'monthlyPayment'];
  const optionalFields = ['zipCode', 'squareFeet', 'description', 'imageUrl', 'latitude', 'longitude'];
  
  const fieldCompleteness = {};
  
  [...requiredFields, ...optionalFields].forEach(field => {
    const withField = properties.filter(p => p[field] != null && p[field] !== '').length;
    fieldCompleteness[field] = {
      count: withField,
      percentage: Math.round((withField / properties.length) * 100)
    };
  });
  
  const completePropertiesCount = properties.filter(property => 
    requiredFields.every(field => property[field] != null && property[field] !== '')
  ).length;
  
  return {
    totalProperties: properties.length,
    completeProperties: completePropertiesCount,
    completenessRate: Math.round((completePropertiesCount / properties.length) * 100),
    fieldCompleteness,
    dataQualityScore: calculateDataQualityScore(fieldCompleteness, requiredFields, optionalFields)
  };
}

function analyzeGeographicDistribution(properties: Record<string, unknown>[]) {
  const stateDistribution: Record<string, Record<string, unknown>> = {};
  const cityDistribution: Record<string, number> = {};
  
  properties.forEach(property => {
    const state = property.state;
    const city = property.city?.split(',')[0].trim();
    
    if (state) {
      if (!stateDistribution[state]) {
        stateDistribution[state] = { count: 0, cities: new Set() };
      }
      stateDistribution[state].count++;
      
      if (city) {
        stateDistribution[state].cities.add(city);
        cityDistribution[`${city}, ${state}`] = (cityDistribution[`${city}, ${state}`] || 0) + 1;
      }
    }
  });
  
  // Convert sets to arrays for JSON serialization
  Object.keys(stateDistribution).forEach(state => {
    stateDistribution[state].cities = Array.from(stateDistribution[state].cities);
    stateDistribution[state].cityCount = stateDistribution[state].cities.length;
  });
  
  const topStates = Object.entries(stateDistribution)
    .map(([state, data]) => ({ state, ...data }))
    .sort((a, b) => b.count - a.count);
    
  const topCities = Object.entries(cityDistribution)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
  
  return {
    totalStates: Object.keys(stateDistribution).length,
    totalUniqueCities: Object.keys(cityDistribution).length,
    topStates: topStates.slice(0, 10),
    topCities: topCities.slice(0, 10),
    averagePropertiesPerState: Math.round(properties.length / Object.keys(stateDistribution).length),
    averagePropertiesPerCity: Math.round(properties.length / Object.keys(cityDistribution).length)
  };
}

function analyzeFinancialData(properties: Record<string, unknown>[]) {
  const financialMetrics = {
    listPrice: [],
    monthlyPayment: [],
    downPaymentAmount: [],
    interestRate: [],
    termYears: []
  };
  
  properties.forEach(property => {
    if (property.listPrice > 0) financialMetrics.listPrice.push(property.listPrice);
    if (property.monthlyPayment > 0) financialMetrics.monthlyPayment.push(property.monthlyPayment);
    if (property.downPaymentAmount > 0) financialMetrics.downPaymentAmount.push(property.downPaymentAmount);
    if (property.interestRate > 0) financialMetrics.interestRate.push(property.interestRate);
    if (property.termYears > 0) financialMetrics.termYears.push(property.termYears);
  });
  
  const calculateStats = (arr: number[]) => ({
    count: arr.length,
    min: arr.length > 0 ? Math.min(...arr) : 0,
    max: arr.length > 0 ? Math.max(...arr) : 0,
    avg: arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0,
    median: arr.length > 0 ? arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)] : 0
  });
  
  return {
    listPrice: calculateStats(financialMetrics.listPrice),
    monthlyPayment: calculateStats(financialMetrics.monthlyPayment),
    downPaymentAmount: calculateStats(financialMetrics.downPaymentAmount),
    interestRate: calculateStats(financialMetrics.interestRate),
    termYears: calculateStats(financialMetrics.termYears),
    financialDataCompleteness: Math.round((financialMetrics.listPrice.length / properties.length) * 100)
  };
}

function analyzeNearbyCitiesCoverage(properties: Record<string, unknown>[]) {
  const withNearbyCities = properties.filter(p => p.nearbyCities && p.nearbyCities.length > 0);
  const nearbyCitiesCounts = properties.map(p => p.nearbyCities?.length || 0);
  
  const coverageByCity = properties.reduce((acc: Record<string, Record<string, unknown>>, property) => {
    const city = `${property.city?.split(',')[0].trim()}, ${property.state}`;
    if (!acc[city]) {
      acc[city] = {
        propertyCount: 0,
        totalNearbyCities: 0,
        avgNearbyCities: 0
      };
    }
    acc[city].propertyCount++;
    acc[city].totalNearbyCities += property.nearbyCities?.length || 0;
    acc[city].avgNearbyCities = Math.round(acc[city].totalNearbyCities / acc[city].propertyCount);
    return acc;
  }, {});
  
  return {
    totalProperties: properties.length,
    withNearbyCities: withNearbyCities.length,
    coveragePercentage: Math.round((withNearbyCities.length / properties.length) * 100),
    avgNearbyCitiesCount: Math.round(nearbyCitiesCounts.reduce((a, b) => a + b, 0) / properties.length),
    maxNearbyCities: Math.max(...nearbyCitiesCounts),
    minNearbyCities: Math.min(...nearbyCitiesCounts),
    coverageByCity: Object.entries(coverageByCity)
      .map(([city, data]) => ({ city, ...data }))
      .sort((a, b) => b.avgNearbyCities - a.avgNearbyCities)
      .slice(0, 15)
  };
}

function calculateDataQualityScore(fieldCompleteness: Record<string, unknown>, requiredFields: string[], optionalFields: string[]): number {
  const requiredScore = requiredFields.reduce((sum, field) => sum + (fieldCompleteness[field]?.percentage || 0), 0) / requiredFields.length;
  const optionalScore = optionalFields.reduce((sum, field) => sum + (fieldCompleteness[field]?.percentage || 0), 0) / optionalFields.length;
  
  return Math.round((requiredScore * 0.8) + (optionalScore * 0.2)); // 80% weight on required, 20% on optional
}

function generateOverallAssessment(dataQuality: Record<string, unknown>, geoDistribution: Record<string, unknown>, financialAnalysis: Record<string, unknown>, nearbyCitiesAnalysis: Record<string, unknown>) {
  const scores = {
    dataQuality: dataQuality.dataQualityScore,
    geoCoverage: Math.min(100, (geoDistribution.totalStates / 10) * 100), // Expect 10+ states for good coverage
    financialCompleteness: financialAnalysis.financialDataCompleteness,
    nearbyCitiesCoverage: nearbyCitiesAnalysis.coveragePercentage
  };
  
  const overallScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);
  
  return {
    scores,
    overallScore,
    grade: getGrade(overallScore),
    strengths: getStrengths(scores),
    weaknesses: getWeaknesses(scores)
  };
}

function generateRecommendations(properties: Record<string, unknown>[]): string[] {
  const recommendations: string[] = [];
  
  const withoutImages = properties.filter(p => !p.imageUrl || !p.photos?.length).length;
  if (withoutImages > properties.length * 0.3) {
    recommendations.push(`📸 ${withoutImages} properties need images - consider auto-generating Street View images`);
  }
  
  const withoutCoords = properties.filter(p => !p.latitude || !p.longitude).length;
  if (withoutCoords > properties.length * 0.2) {
    recommendations.push(`📍 ${withoutCoords} properties need coordinates - use Google Geocoding API`);
  }
  
  const withLimitedNearbyCities = properties.filter(p => (p.nearbyCities?.length || 0) < 10).length;
  if (withLimitedNearbyCities > 0) {
    recommendations.push(`🌍 ${withLimitedNearbyCities} properties have limited nearby cities coverage`);
  }
  
  return recommendations;
}

function getGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function getStrengths(scores: Record<string, unknown>): string[] {
  const strengths = [];
  if (scores.dataQuality >= 80) strengths.push('High data quality');
  if (scores.geoCoverage >= 70) strengths.push('Good geographic coverage');
  if (scores.financialCompleteness >= 90) strengths.push('Complete financial data');
  if (scores.nearbyCitiesCoverage >= 95) strengths.push('Excellent nearby cities coverage');
  return strengths;
}

function getWeaknesses(scores: Record<string, unknown>): string[] {
  const weaknesses = [];
  if (scores.dataQuality < 70) weaknesses.push('Data quality needs improvement');
  if (scores.geoCoverage < 50) weaknesses.push('Limited geographic coverage');
  if (scores.financialCompleteness < 80) weaknesses.push('Incomplete financial data');
  if (scores.nearbyCitiesCoverage < 90) weaknesses.push('Nearby cities coverage gaps');
  return weaknesses;
}