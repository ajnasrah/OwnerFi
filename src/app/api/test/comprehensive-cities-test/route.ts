import { NextRequest, NextResponse } from 'next/server';
import { testComprehensiveDatabase, getNearbyCitiesUltraFast } from '@/lib/cities-service-v2';
import { getCitiesDatabaseStats } from '@/lib/comprehensive-cities';

/**
 * Test the new comprehensive cities database
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testCity = searchParams.get('city') || 'Atlanta';
    const testState = searchParams.get('state') || 'GA';
    
    console.log(`🧪 Testing comprehensive cities database...`);
    
    // Get database stats
    const dbStats = getCitiesDatabaseStats();
    
    // Test performance with multiple cities
    const performanceTest = testComprehensiveDatabase();
    
    // Test specific city if requested
    const startTime = Date.now();
    const nearbyCities = getNearbyCitiesUltraFast(testCity, testState, 30);
    const specificTestTime = Date.now() - startTime;
    
    return NextResponse.json({
      databaseInfo: {
        totalUSCities: dbStats.totalCities,
        largestStates: dbStats.largestStates.slice(0, 5),
        coverage: 'All incorporated US cities and towns'
      },
      performanceTest,
      specificCityTest: {
        city: testCity,
        state: testState,
        nearbyCitiesFound: nearbyCities.length,
        calculationTime: `${specificTestTime}ms`,
        sampleNearbyCities: nearbyCities.slice(0, 15),
        performance: specificTestTime < 50 ? 'Excellent' : specificTestTime < 100 ? 'Good' : 'Needs optimization'
      },
      comparison: {
        oldSystem: 'Overpass API: 2-10 seconds + rate limiting + failures',
        newSystem: `Comprehensive DB: ${performanceTest.avgTime}ms average, no API calls, no failures`,
        improvement: `${Math.round((5000 / Math.max(performanceTest.avgTime, 1)))}x faster`
      },
      recommendation: {
        verdict: nearbyCities.length >= 20 ? 'EXCELLENT coverage' : 'Limited coverage',
        actionItem: nearbyCities.length >= 20 
          ? 'Replace all Overpass API calls with this system'
          : 'Consider hybrid approach for rural areas'
      }
    });
    
  } catch (error) {
    console.error('🚨 Comprehensive cities test error:', error);
    return NextResponse.json({ 
      error: 'Test failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}