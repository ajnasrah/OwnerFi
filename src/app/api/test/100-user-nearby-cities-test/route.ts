import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getNearbyCitiesUltraFast } from '@/lib/cities-service-v2';

/**
 * 100-USER COMPREHENSIVE TEST SUITE
 * Tests nearby cities functionality with 100 different users in 100 different cities
 */

// 100 diverse test cities across all major US metro areas
const TEST_CITIES = [
  // Texas (largest property state)
  { city: 'Dallas', state: 'TX', budget: { monthly: 2500, down: 50000 } },
  { city: 'Houston', state: 'TX', budget: { monthly: 2800, down: 60000 } },
  { city: 'Austin', state: 'TX', budget: { monthly: 3000, down: 70000 } },
  { city: 'San Antonio', state: 'TX', budget: { monthly: 2200, down: 45000 } },
  { city: 'Fort Worth', state: 'TX', budget: { monthly: 2400, down: 50000 } },
  { city: 'El Paso', state: 'TX', budget: { monthly: 1800, down: 35000 } },
  { city: 'Arlington', state: 'TX', budget: { monthly: 2300, down: 45000 } },
  { city: 'Plano', state: 'TX', budget: { monthly: 2600, down: 55000 } },
  { city: 'Irving', state: 'TX', budget: { monthly: 2400, down: 50000 } },
  { city: 'Garland', state: 'TX', budget: { monthly: 2200, down: 40000 } },
  
  // Florida  
  { city: 'Miami', state: 'FL', budget: { monthly: 3500, down: 80000 } },
  { city: 'Jacksonville', state: 'FL', budget: { monthly: 2000, down: 40000 } },
  { city: 'Tampa', state: 'FL', budget: { monthly: 2400, down: 50000 } },
  { city: 'Orlando', state: 'FL', budget: { monthly: 2300, down: 45000 } },
  { city: 'St. Petersburg', state: 'FL', budget: { monthly: 2200, down: 45000 } },
  { city: 'Fort Lauderdale', state: 'FL', budget: { monthly: 3200, down: 70000 } },
  { city: 'Pensacola', state: 'FL', budget: { monthly: 1800, down: 35000 } },
  { city: 'Gainesville', state: 'FL', budget: { monthly: 1900, down: 35000 } },
  { city: 'Tallahassee', state: 'FL', budget: { monthly: 2000, down: 40000 } },
  { city: 'Cape Coral', state: 'FL', budget: { monthly: 2100, down: 40000 } },
  
  // Georgia
  { city: 'Atlanta', state: 'GA', budget: { monthly: 2800, down: 55000 } },
  { city: 'Columbus', state: 'GA', budget: { monthly: 1800, down: 35000 } },
  { city: 'Augusta', state: 'GA', budget: { monthly: 1700, down: 30000 } },
  { city: 'Savannah', state: 'GA', budget: { monthly: 2000, down: 40000 } },
  { city: 'Sandy Springs', state: 'GA', budget: { monthly: 3000, down: 60000 } },
  
  // California
  { city: 'Los Angeles', state: 'CA', budget: { monthly: 5000, down: 100000 } },
  { city: 'San Diego', state: 'CA', budget: { monthly: 4500, down: 90000 } },
  { city: 'San Francisco', state: 'CA', budget: { monthly: 6000, down: 120000 } },
  { city: 'Sacramento', state: 'CA', budget: { monthly: 3500, down: 70000 } },
  { city: 'Fresno', state: 'CA', budget: { monthly: 2800, down: 55000 } },
  
  // Arizona
  { city: 'Phoenix', state: 'AZ', budget: { monthly: 2800, down: 55000 } },
  { city: 'Tucson', state: 'AZ', budget: { monthly: 2200, down: 45000 } },
  { city: 'Mesa', state: 'AZ', budget: { monthly: 2600, down: 50000 } },
  { city: 'Scottsdale', state: 'AZ', budget: { monthly: 3500, down: 70000 } },
  { city: 'Tempe', state: 'AZ', budget: { monthly: 2800, down: 55000 } },
  
  // North Carolina
  { city: 'Charlotte', state: 'NC', budget: { monthly: 2500, down: 50000 } },
  { city: 'Raleigh', state: 'NC', budget: { monthly: 2300, down: 45000 } },
  { city: 'Greensboro', state: 'NC', budget: { monthly: 1900, down: 35000 } },
  { city: 'Durham', state: 'NC', budget: { monthly: 2200, down: 40000 } },
  { city: 'Winston-Salem', state: 'NC', budget: { monthly: 1800, down: 35000 } },
  
  // Tennessee
  { city: 'Nashville', state: 'TN', budget: { monthly: 2400, down: 50000 } },
  { city: 'Memphis', state: 'TN', budget: { monthly: 1800, down: 35000 } },
  { city: 'Knoxville', state: 'TN', budget: { monthly: 1700, down: 30000 } },
  { city: 'Chattanooga', state: 'TN', budget: { monthly: 1600, down: 30000 } },
  { city: 'Clarksville', state: 'TN', budget: { monthly: 1700, down: 32000 } },
  
  // Virginia  
  { city: 'Virginia Beach', state: 'VA', budget: { monthly: 2400, down: 45000 } },
  { city: 'Norfolk', state: 'VA', budget: { monthly: 2200, down: 40000 } },
  { city: 'Richmond', state: 'VA', budget: { monthly: 2300, down: 45000 } },
  { city: 'Newport News', state: 'VA', budget: { monthly: 2100, down: 40000 } },
  { city: 'Alexandria', state: 'VA', budget: { monthly: 3500, down: 70000 } },
  
  // South Carolina
  { city: 'Charleston', state: 'SC', budget: { monthly: 2200, down: 45000 } },
  { city: 'Columbia', state: 'SC', budget: { monthly: 1900, down: 35000 } },
  { city: 'North Charleston', state: 'SC', budget: { monthly: 2000, down: 40000 } },
  { city: 'Greenville', state: 'SC', budget: { monthly: 1800, down: 35000 } },
  { city: 'Myrtle Beach', state: 'SC', budget: { monthly: 2100, down: 40000 } },
  
  // Additional diverse cities to reach 100
  { city: 'Birmingham', state: 'AL', budget: { monthly: 1600, down: 30000 } },
  { city: 'Mobile', state: 'AL', budget: { monthly: 1500, down: 28000 } },
  { city: 'Huntsville', state: 'AL', budget: { monthly: 1700, down: 32000 } },
  { city: 'Little Rock', state: 'AR', budget: { monthly: 1600, down: 30000 } },
  { city: 'Fayetteville', state: 'AR', budget: { monthly: 1700, down: 32000 } },
  { city: 'Denver', state: 'CO', budget: { monthly: 3200, down: 65000 } },
  { city: 'Colorado Springs', state: 'CO', budget: { monthly: 2500, down: 50000 } },
  { city: 'Hartford', state: 'CT', budget: { monthly: 2800, down: 55000 } },
  { city: 'Bridgeport', state: 'CT', budget: { monthly: 2600, down: 50000 } },
  { city: 'Wilmington', state: 'DE', budget: { monthly: 2400, down: 45000 } },
  { city: 'Boise', state: 'ID', budget: { monthly: 2200, down: 40000 } },
  { city: 'Chicago', state: 'IL', budget: { monthly: 3200, down: 65000 } },
  { city: 'Aurora', state: 'IL', budget: { monthly: 2600, down: 50000 } },
  { city: 'Indianapolis', state: 'IN', budget: { monthly: 1900, down: 35000 } },
  { city: 'Des Moines', state: 'IA', budget: { monthly: 1800, down: 35000 } },
  { city: 'Wichita', state: 'KS', budget: { monthly: 1600, down: 30000 } },
  { city: 'Louisville', state: 'KY', budget: { monthly: 1800, down: 35000 } },
  { city: 'New Orleans', state: 'LA', budget: { monthly: 2200, down: 40000 } },
  { city: 'Baton Rouge', state: 'LA', budget: { monthly: 1900, down: 35000 } },
  { city: 'Portland', state: 'ME', budget: { monthly: 2400, down: 45000 } },
  { city: 'Baltimore', state: 'MD', budget: { monthly: 2800, down: 55000 } },
  { city: 'Boston', state: 'MA', budget: { monthly: 4000, down: 80000 } },
  { city: 'Detroit', state: 'MI', budget: { monthly: 1800, down: 35000 } },
  { city: 'Grand Rapids', state: 'MI', budget: { monthly: 1700, down: 32000 } },
  { city: 'Minneapolis', state: 'MN', budget: { monthly: 2600, down: 50000 } },
  { city: 'Jackson', state: 'MS', budget: { monthly: 1500, down: 28000 } },
  { city: 'Kansas City', state: 'MO', budget: { monthly: 1800, down: 35000 } },
  { city: 'St. Louis', state: 'MO', budget: { monthly: 1700, down: 32000 } },
  { city: 'Billings', state: 'MT', budget: { monthly: 1800, down: 35000 } },
  { city: 'Omaha', state: 'NE', budget: { monthly: 1700, down: 32000 } },
  { city: 'Las Vegas', state: 'NV', budget: { monthly: 2800, down: 55000 } },
  { city: 'Reno', state: 'NV', budget: { monthly: 2400, down: 45000 } },
  { city: 'Manchester', state: 'NH', budget: { monthly: 2200, down: 40000 } },
  { city: 'Newark', state: 'NJ', budget: { monthly: 3200, down: 65000 } },
  { city: 'Albuquerque', state: 'NM', budget: { monthly: 2000, down: 40000 } },
  { city: 'New York', state: 'NY', budget: { monthly: 5000, down: 100000 } },
  { city: 'Buffalo', state: 'NY', budget: { monthly: 2000, down: 40000 } },
  { city: 'Cleveland', state: 'OH', budget: { monthly: 1800, down: 35000 } },
  { city: 'Columbus', state: 'OH', budget: { monthly: 2000, down: 40000 } },
  { city: 'Oklahoma City', state: 'OK', budget: { monthly: 1700, down: 32000 } },
  { city: 'Tulsa', state: 'OK', budget: { monthly: 1600, down: 30000 } },
  { city: 'Portland', state: 'OR', budget: { monthly: 3200, down: 65000 } },
  { city: 'Philadelphia', state: 'PA', budget: { monthly: 2800, down: 55000 } },
  { city: 'Pittsburgh', state: 'PA', budget: { monthly: 2200, down: 40000 } },
  { city: 'Providence', state: 'RI', budget: { monthly: 2600, down: 50000 } },
  { city: 'Sioux Falls', state: 'SD', budget: { monthly: 1600, down: 30000 } },
  { city: 'Salt Lake City', state: 'UT', budget: { monthly: 2400, down: 45000 } },
  { city: 'Burlington', state: 'VT', budget: { monthly: 2200, down: 40000 } },
  { city: 'Seattle', state: 'WA', budget: { monthly: 4000, down: 80000 } },
  { city: 'Spokane', state: 'WA', budget: { monthly: 2200, down: 40000 } },
  { city: 'Milwaukee', state: 'WI', budget: { monthly: 2000, down: 40000 } },
  { city: 'Madison', state: 'WI', budget: { monthly: 2200, down: 42000 } },
  { city: 'Cheyenne', state: 'WY', budget: { monthly: 1800, down: 35000 } },
  
  // Additional cities to reach 100
  { city: 'Anchorage', state: 'AK', budget: { monthly: 2800, down: 55000 } },
  { city: 'Honolulu', state: 'HI', budget: { monthly: 4500, down: 90000 } },
  { city: 'Las Cruces', state: 'NM', budget: { monthly: 1800, down: 35000 } },
  { city: 'Bend', state: 'OR', budget: { monthly: 2600, down: 50000 } },
  { city: 'Rapid City', state: 'SD', budget: { monthly: 1700, down: 32000 } },
  { city: 'Provo', state: 'UT', budget: { monthly: 2200, down: 40000 } },
  { city: 'Charleston', state: 'WV', budget: { monthly: 1500, down: 28000 } },
  { city: 'Casper', state: 'WY', budget: { monthly: 1600, down: 30000 } },
  { city: 'Fargo', state: 'ND', budget: { monthly: 1800, down: 35000 } },
  { city: 'Pierre', state: 'SD', budget: { monthly: 1500, down: 28000 } },
  
  // More metro areas
  { city: 'Mesa', state: 'AZ', budget: { monthly: 2600, down: 50000 } },
  { city: 'Chandler', state: 'AZ', budget: { monthly: 2800, down: 55000 } },
  { city: 'Glendale', state: 'AZ', budget: { monthly: 2500, down: 48000 } },
  { city: 'Long Beach', state: 'CA', budget: { monthly: 4200, down: 85000 } },
  { city: 'Oakland', state: 'CA', budget: { monthly: 4800, down: 95000 } },
  { city: 'Bakersfield', state: 'CA', budget: { monthly: 3000, down: 60000 } },
  { city: 'Anaheim', state: 'CA', budget: { monthly: 4000, down: 80000 } },
  { city: 'Riverside', state: 'CA', budget: { monthly: 3200, down: 65000 } },
  { city: 'Stockton', state: 'CA', budget: { monthly: 3000, down: 60000 } },
  { city: 'Irvine', state: 'CA', budget: { monthly: 4500, down: 90000 } },
  
  // Continue adding cities to reach exactly 100...
  { city: 'Boulder', state: 'CO', budget: { monthly: 3500, down: 70000 } },
  { city: 'Fort Collins', state: 'CO', budget: { monthly: 2800, down: 55000 } },
  { city: 'Stamford', state: 'CT', budget: { monthly: 3200, down: 65000 } },
  { city: 'New Haven', state: 'CT', budget: { monthly: 2800, down: 55000 } },
  { city: 'Dover', state: 'DE', budget: { monthly: 2000, down: 40000 } },
  { city: 'Clearwater', state: 'FL', budget: { monthly: 2200, down: 42000 } },
  { city: 'Coral Springs', state: 'FL', budget: { monthly: 2800, down: 55000 } },
  { city: 'Pompano Beach', state: 'FL', budget: { monthly: 2600, down: 50000 } },
  { city: 'West Palm Beach', state: 'FL', budget: { monthly: 2900, down: 58000 } },
  { city: 'Lakeland', state: 'FL', budget: { monthly: 1900, down: 38000 } }
];

interface TestResult {
  userId: string;
  searchCity: string;
  state: string;
  budget: any;
  nearbyCitiesFound: number;
  propertiesInTargetCity: number;
  propertiesInNearbyCities: number;
  totalPropertiesFound: number;
  sampleNearbyCities: string[];
  calculationTime: number;
  success: boolean;
  expandedSearchWorking: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    console.log('🧪 STARTING 100-USER COMPREHENSIVE TEST SUITE...');
    console.log(`Testing nearby cities functionality across ${TEST_CITIES.length} different cities`);
    
    // Get all properties for testing
    const snapshot = await getDocs(collection(db, 'properties'));
    const allProperties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📊 Testing against ${allProperties.length} total properties in database`);
    
    const testResults: TestResult[] = [];
    let totalCalculationTime = 0;
    let successfulTests = 0;
    let expandedSearchesWorking = 0;
    
    // Test each of the 100 cities
    for (let i = 0; i < Math.min(TEST_CITIES.length, 100); i++) {
      const testCity = TEST_CITIES[i];
      const userId = `test-user-${i + 1}`;
      
      try {
        const testStartTime = Date.now();
        
        // 1. Get nearby cities for this test city (ULTRA FAST)
        const nearbyCities = getNearbyCitiesUltraFast(testCity.city, testCity.state, 30);
        const allSearchCities = [testCity.city, ...nearbyCities];
        
        // 2. Find properties in target city only
        const propertiesInTargetCity = allProperties.filter(property => {
          const propertyCity = property.city?.split(',')[0].trim();
          return propertyCity?.toLowerCase() === testCity.city.toLowerCase() && 
                 property.state === testCity.state &&
                 property.isActive !== false &&
                 property.monthlyPayment <= testCity.budget.monthly &&
                 property.downPaymentAmount <= testCity.budget.down;
        });
        
        // 3. Find properties in nearby cities
        const propertiesInNearbyCities = allProperties.filter(property => {
          const propertyCity = property.city?.split(',')[0].trim();
          return nearbyCities.some(nearbyCity => 
                   propertyCity?.toLowerCase() === nearbyCity.toLowerCase()
                 ) &&
                 property.state === testCity.state &&
                 property.isActive !== false &&
                 property.monthlyPayment <= testCity.budget.monthly &&
                 property.downPaymentAmount <= testCity.budget.down;
        });
        
        const calculationTime = Date.now() - testStartTime;
        totalCalculationTime += calculationTime;
        
        const totalFound = propertiesInTargetCity.length + propertiesInNearbyCities.length;
        const expandedSearchWorking = propertiesInNearbyCities.length > 0; // Found properties in nearby cities
        
        if (expandedSearchWorking) expandedSearchesWorking++;
        
        const testResult: TestResult = {
          userId,
          searchCity: testCity.city,
          state: testCity.state,
          budget: testCity.budget,
          nearbyCitiesFound: nearbyCities.length,
          propertiesInTargetCity: propertiesInTargetCity.length,
          propertiesInNearbyCities: propertiesInNearbyCities.length,
          totalPropertiesFound: totalFound,
          sampleNearbyCities: nearbyCities.slice(0, 5),
          calculationTime,
          success: true,
          expandedSearchWorking
        };
        
        testResults.push(testResult);
        successfulTests++;
        
        if ((i + 1) % 10 === 0) {
          console.log(`✅ Completed ${i + 1}/100 tests...`);
        }
        
      } catch (error) {
        console.error(`❌ Test failed for ${testCity.city}, ${testCity.state}:`, error);
        testResults.push({
          userId,
          searchCity: testCity.city,
          state: testCity.state,
          budget: testCity.budget,
          nearbyCitiesFound: 0,
          propertiesInTargetCity: 0,
          propertiesInNearbyCities: 0,
          totalPropertiesFound: 0,
          sampleNearbyCities: [],
          calculationTime: 0,
          success: false,
          expandedSearchWorking: false
        });
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    // Analyze results
    const analysis = analyzeTestResults(testResults, totalTime);
    
    return NextResponse.json({
      testSuite: {
        name: '100-User Nearby Cities Functionality Test',
        totalTests: testResults.length,
        successfulTests,
        failedTests: testResults.length - successfulTests,
        totalTime: `${totalTime}ms`,
        avgTimePerTest: `${Math.round(totalTime / testResults.length)}ms`
      },
      performance: {
        avgCalculationTime: Math.round(totalCalculationTime / testResults.length),
        testsPerSecond: Math.round((testResults.length / totalTime) * 1000),
        totalCalculationTime,
        performanceGrade: totalTime < 5000 ? 'A+' : totalTime < 10000 ? 'A' : 'B'
      },
      functionalityResults: {
        usersWithNearbyCities: testResults.filter(r => r.nearbyCitiesFound > 0).length,
        usersWithExpandedResults: expandedSearchesWorking,
        expandedSearchSuccessRate: Math.round((expandedSearchesWorking / testResults.length) * 100),
        avgNearbyCitiesPerUser: Math.round(testResults.reduce((sum, r) => sum + r.nearbyCitiesFound, 0) / testResults.length)
      },
      detailedAnalysis: analysis,
      sampleResults: testResults.slice(0, 10),
      topPerformers: testResults
        .filter(r => r.nearbyCitiesFound > 0)
        .sort((a, b) => b.nearbyCitiesFound - a.nearbyCitiesFound)
        .slice(0, 10),
      needsAttention: testResults
        .filter(r => r.nearbyCitiesFound === 0 || !r.expandedSearchWorking)
        .slice(0, 10),
      overallVerdict: generateTestVerdict(analysis)
    });
    
  } catch (error) {
    console.error('100-user test suite error:', error);
    return NextResponse.json({ 
      error: 'Test suite failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}

function analyzeTestResults(results: TestResult[], totalTime: number) {
  const successfulResults = results.filter(r => r.success);
  
  return {
    overallStats: {
      totalUsers: results.length,
      successfulUsers: successfulResults.length,
      usersWithNearbyOptions: results.filter(r => r.expandedSearchWorking).length,
      totalNearbyCitiesFound: results.reduce((sum, r) => sum + r.nearbyCitiesFound, 0),
      totalPropertiesFound: results.reduce((sum, r) => sum + r.totalPropertiesFound, 0)
    },
    byState: groupResultsByState(results),
    performanceMetrics: {
      fastestTest: Math.min(...results.map(r => r.calculationTime)),
      slowestTest: Math.max(...results.map(r => r.calculationTime)),
      avgTestTime: Math.round(results.reduce((sum, r) => sum + r.calculationTime, 0) / results.length)
    },
    functionalityScore: calculateFunctionalityScore(results)
  };
}

function groupResultsByState(results: TestResult[]) {
  const byState: Record<string, any> = {};
  
  results.forEach(result => {
    if (!byState[result.state]) {
      byState[result.state] = {
        userCount: 0,
        avgNearbyCities: 0,
        expandedSearchCount: 0,
        totalNearbyCities: 0
      };
    }
    
    byState[result.state].userCount++;
    byState[result.state].totalNearbyCities += result.nearbyCitiesFound;
    if (result.expandedSearchWorking) byState[result.state].expandedSearchCount++;
  });
  
  Object.keys(byState).forEach(state => {
    byState[state].avgNearbyCities = Math.round(byState[state].totalNearbyCities / byState[state].userCount);
    byState[state].expandedSearchRate = Math.round((byState[state].expandedSearchCount / byState[state].userCount) * 100);
  });
  
  return Object.entries(byState)
    .map(([state, data]) => ({ state, ...data }))
    .sort((a, b) => b.avgNearbyCities - a.avgNearbyCities);
}

function calculateFunctionalityScore(results: TestResult[]): number {
  const nearbyCitiesScore = (results.filter(r => r.nearbyCitiesFound > 0).length / results.length) * 100;
  const expandedSearchScore = (results.filter(r => r.expandedSearchWorking).length / results.length) * 100;
  const performanceScore = results.filter(r => r.calculationTime < 100).length / results.length * 100;
  
  return Math.round((nearbyCitiesScore + expandedSearchScore + performanceScore) / 3);
}

function generateTestVerdict(analysis: any): string {
  const score = analysis.functionalityScore;
  
  if (score >= 90) return '🎉 EXCELLENT - Nearby cities functionality working perfectly';
  if (score >= 80) return '✅ VERY GOOD - Minor issues but mostly functional';
  if (score >= 70) return '👍 GOOD - Some areas need improvement';
  if (score >= 60) return '⚠️ FAIR - Significant issues detected';
  return '❌ POOR - Major functionality problems';
}