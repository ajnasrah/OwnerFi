import { NextRequest, NextResponse } from 'next/server';
import { searchPropertiesWithNearby } from '@/lib/property-search-optimized';
import { batchProcessNearbyCities } from '@/lib/background-jobs';
import { getNearbyCitiesDirect, clearCoordinateCache } from '@/lib/cities-service';

/**
 * PERFORMANCE TEST SUITE
 * Tests the optimized property system under load
 */

interface TestResult {
  testName: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  successCount: number;
  errorCount: number;
  throughput: number; // operations per second
}

export async function POST(request: NextRequest) {
  try {
    const { testType, iterations = 10 } = await request.json();
    
    console.log(`🧪 Starting performance test: ${testType} with ${iterations} iterations`);
    
    let testResult: TestResult;
    
    switch (testType) {
      case 'city_lookup':
        testResult = await testCityLookupPerformance(iterations);
        break;
      case 'property_search':
        testResult = await testPropertySearchPerformance(iterations);
        break;
      case 'similar_properties':
        testResult = await testSimilarPropertiesPerformance(iterations);
        break;
      case 'batch_processing':
        testResult = await testBatchProcessingPerformance(iterations);
        break;
      default:
        testResult = await runAllTests(iterations);
    }
    
    return NextResponse.json({
      success: true,
      testResult,
      performanceGrade: getPerformanceGrade(testResult),
      recommendations: getPerformanceRecommendations(testResult)
    });
    
  } catch (error) {
    console.error('Performance test error:', error);
    return NextResponse.json(
      { error: 'Performance test failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

async function testCityLookupPerformance(iterations: number): Promise<TestResult> {
  const times: number[] = [];
  let successCount = 0;
  let errorCount = 0;
  
  const testCities = [
    { city: 'Dallas', state: 'TX' },
    { city: 'Miami', state: 'FL' },
    { city: 'Atlanta', state: 'GA' },
    { city: 'Austin', state: 'TX' },
    { city: 'Jacksonville', state: 'FL' }
  ];
  
  // Clear cache for fair testing
  clearCoordinateCache();
  
  for (let i = 0; i < iterations; i++) {
    const testCity = testCities[i % testCities.length];
    const startTime = Date.now();
    
    try {
      const cities = await getNearbyCitiesDirect(testCity.city, testCity.state, 30);
      const endTime = Date.now() - startTime;
      times.push(endTime);
      successCount++;
      
      if (i === 0) console.log(`📍 ${testCity.city}: Found ${cities.length} cities in ${endTime}ms`);
      
    } catch (error) {
      errorCount++;
      console.error(`❌ City lookup failed for ${testCity.city}:`, error);
    }
  }
  
  return calculateTestResult('City Lookup Performance', iterations, times, successCount, errorCount);
}

async function testPropertySearchPerformance(iterations: number): Promise<TestResult> {
  const times: number[] = [];
  let successCount = 0;
  let errorCount = 0;
  
  const testSearches = [
    { city: 'Dallas', state: 'TX', maxMonthly: 2000, maxDown: 40000 },
    { city: 'Miami', state: 'FL', maxMonthly: 3000, maxDown: 50000 },
    { city: 'Atlanta', state: 'GA', maxMonthly: 2500, maxDown: 45000 },
    { city: 'Austin', state: 'TX', maxMonthly: 2800, maxDown: 60000 }
  ];
  
  for (let i = 0; i < iterations; i++) {
    const search = testSearches[i % testSearches.length];
    const startTime = Date.now();
    
    try {
      const result = await searchPropertiesWithNearby(search.city, search.state, {
        maxMonthlyPayment: search.maxMonthly,
        maxDownPayment: search.maxDown,
        limit: 20
      });
      
      const endTime = Date.now() - startTime;
      times.push(endTime);
      successCount++;
      
      if (i === 0) console.log(`🔍 ${search.city}: Found ${result.totalFound} properties in ${endTime}ms`);
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Search failed for ${search.city}:`, error);
    }
  }
  
  return calculateTestResult('Property Search Performance', iterations, times, successCount, errorCount);
}

async function testSimilarPropertiesPerformance(iterations: number): Promise<TestResult> {
  // Similar test pattern for similar properties API
  const times: number[] = [];
  let successCount = 0;
  let errorCount = 0;
  
  // Mock property for testing
  const testProperty = {
    id: 'test-property',
    city: 'Dallas',
    state: 'TX',
    monthlyPayment: 1500,
    downPaymentAmount: 30000
  };
  
  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    
    try {
      const response = await fetch('http://localhost:3001/api/properties/similar?' + 
        `city=${testProperty.city}&state=${testProperty.state}&listPrice=300000&bedrooms=3&bathrooms=2&limit=10`);
      
      if (!response.ok) throw new Error(`API error: ${response.statusText}`);
      
      const data = await response.json();
      const endTime = Date.now() - startTime;
      times.push(endTime);
      successCount++;
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Similar properties test failed:`, error);
    }
  }
  
  return calculateTestResult('Similar Properties Performance', iterations, times, successCount, errorCount);
}

async function testBatchProcessingPerformance(iterations: number): Promise<TestResult> {
  const times: number[] = [];
  let successCount = 0;
  let errorCount = 0;
  
  // Create mock batch processing scenarios
  const mockProperties = Array.from({ length: Math.min(iterations, 10) }, (_, i) => ({
    id: `test-prop-${i}`,
    city: ['Dallas', 'Miami', 'Atlanta', 'Austin'][i % 4],
    state: ['TX', 'FL', 'GA', 'TX'][i % 4]
  }));
  
  const startTime = Date.now();
  
  try {
    await batchProcessNearbyCities(mockProperties);
    const endTime = Date.now() - startTime;
    times.push(endTime);
    successCount = 1;
    
    console.log(`⚡ Batch processed ${mockProperties.length} properties in ${endTime}ms`);
    
  } catch (error) {
    errorCount = 1;
    console.error('❌ Batch processing test failed:', error);
  }
  
  return calculateTestResult('Batch Processing Performance', 1, times, successCount, errorCount);
}

async function runAllTests(iterations: number): Promise<TestResult> {
  console.log('🚀 Running ALL performance tests...');
  
  const allTimes: number[] = [];
  const startTime = Date.now();
  
  const cityTest = await testCityLookupPerformance(Math.ceil(iterations / 3));
  allTimes.push(...Array(cityTest.iterations).fill(cityTest.avgTime));
  
  const searchTest = await testPropertySearchPerformance(Math.ceil(iterations / 3));
  allTimes.push(...Array(searchTest.iterations).fill(searchTest.avgTime));
  
  const similarTest = await testSimilarPropertiesPerformance(Math.ceil(iterations / 3));
  allTimes.push(...Array(similarTest.iterations).fill(similarTest.avgTime));
  
  const totalTime = Date.now() - startTime;
  const totalSuccesses = cityTest.successCount + searchTest.successCount + similarTest.successCount;
  const totalErrors = cityTest.errorCount + searchTest.errorCount + similarTest.errorCount;
  
  return {
    testName: 'Complete Performance Suite',
    iterations: allTimes.length,
    totalTime,
    avgTime: Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length),
    minTime: Math.min(...allTimes),
    maxTime: Math.max(...allTimes),
    successCount: totalSuccesses,
    errorCount: totalErrors,
    throughput: Math.round((totalSuccesses / totalTime) * 1000)
  };
}

function calculateTestResult(
  testName: string,
  iterations: number, 
  times: number[],
  successCount: number,
  errorCount: number
): TestResult {
  const totalTime = times.reduce((a, b) => a + b, 0);
  
  return {
    testName,
    iterations,
    totalTime,
    avgTime: Math.round(totalTime / Math.max(times.length, 1)),
    minTime: times.length > 0 ? Math.min(...times) : 0,
    maxTime: times.length > 0 ? Math.max(...times) : 0,
    successCount,
    errorCount,
    throughput: Math.round((successCount / Math.max(totalTime, 1)) * 1000)
  };
}

function getPerformanceGrade(result: TestResult): string {
  if (result.avgTime < 100) return 'A+ (Excellent)';
  if (result.avgTime < 300) return 'A (Very Good)';
  if (result.avgTime < 500) return 'B (Good)';
  if (result.avgTime < 1000) return 'C (Acceptable)';
  if (result.avgTime < 2000) return 'D (Poor)';
  return 'F (Unacceptable)';
}

function getPerformanceRecommendations(result: TestResult): string[] {
  const recommendations: string[] = [];
  
  if (result.avgTime > 1000) {
    recommendations.push('🚨 CRITICAL: Average response time > 1s - investigate database indexes');
  }
  
  if (result.errorCount > 0) {
    recommendations.push('⚠️ Error rate detected - add better error handling');
  }
  
  if (result.throughput < 10) {
    recommendations.push('📈 Low throughput - consider caching or connection pooling');
  }
  
  if (result.maxTime > result.avgTime * 3) {
    recommendations.push('📊 High variance - investigate performance outliers');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Performance looks good!');
  }
  
  return recommendations;
}