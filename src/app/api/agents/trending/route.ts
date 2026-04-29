import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { getImprovedAgents } from '@/lib/agents/agent-tracking';

/**
 * Get agents with improved ratings in a city
 * GET /api/agents/trending
 * 
 * Returns agents that have gained rating/reviews in the last 7 days
 */
export async function GET(request: NextRequest) {
  try {
    // Check auth
    const authResult = await requireAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }
    
    const { session } = authResult;
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city')?.trim();
    const state = searchParams.get('state')?.trim()?.toUpperCase();
    const daysParam = searchParams.get('days');
    
    // Input validation
    if (!city || !state) {
      return NextResponse.json(
        { error: 'City and state are required' },
        { status: 400 }
      );
    }
    
    const days = daysParam ? Math.max(1, Math.min(30, parseInt(daysParam))) : 7;
    
    console.log(`[Trending Agents] Finding improved agents in ${city}, ${state} over last ${days} days`);
    
    // Get agents with improved ratings
    const improvedAgents = await getImprovedAgents(city, state, days);
    
    console.log(`[Trending Agents] Found ${improvedAgents.length} improved agents`);
    
    return NextResponse.json({
      success: true,
      agents: improvedAgents,
      count: improvedAgents.length,
      query: { city, state, days },
      source: 'database_tracking',
    });
    
  } catch (error) {
    console.error('[Trending Agents] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get trending agents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}