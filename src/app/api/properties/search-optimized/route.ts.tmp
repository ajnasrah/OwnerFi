import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { searchPropertiesWithNearby } from '@/lib/property-search-optimized';

/**
 * OPTIMIZED PROPERTY SEARCH API
 * 
 * PERFORMANCE IMPROVEMENTS:
 * - Uses Firestore compound indexes (no in-memory filtering)
 * - Background jobs for nearby cities (no blocking API calls)
 * - Coordinate caching (no redundant lookups)
 * - Proper pagination support
 * - Rate limiting for external APIs
 */

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const maxMonthlyPayment = searchParams.get('maxMonthlyPayment');
    const maxDownPayment = searchParams.get('maxDownPayment');
    const minBedrooms = searchParams.get('minBedrooms');
    const minBathrooms = searchParams.get('minBathrooms');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    if (!city || !state) {
      return NextResponse.json({ 
        error: 'Missing required parameters: city, state' 
      }, { status: 400 });
    }


    // Build search criteria
    const criteria = {
      maxMonthlyPayment: maxMonthlyPayment ? Number(maxMonthlyPayment) : undefined,
      maxDownPayment: maxDownPayment ? Number(maxDownPayment) : undefined,
      minBedrooms: minBedrooms ? Number(minBedrooms) : undefined,
      minBathrooms: minBathrooms ? Number(minBathrooms) : undefined,
      limit: Math.min(limit, 100) // Cap at 100 for performance
    };

    // Use optimized search with nearby cities
    const result = await searchPropertiesWithNearby(city, state, criteria);

    const totalTime = Date.now() - startTime;


    return NextResponse.json({
      success: true,
      searchCriteria: {
        city,
        state,
        ...criteria
      },
      totalFound: result.totalFound,
      properties: result.properties,
      hasNextPage: result.hasNextPage,
      searchTime: result.searchTime,
      totalTime,
      performance: {
        searchTime: result.searchTime,
        totalTime,
        propertiesPerMs: result.totalFound / Math.max(totalTime, 1)
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    return NextResponse.json({ 
      error: 'Search failed',
      details: (error as Error).message,
      totalTime,
      properties: []
    }, { status: 500 });
  }
}