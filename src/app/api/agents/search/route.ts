import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AgentFirestoreService } from '@/lib/agents/agent-firestore';

/**
 * Search for agents by location and filters
 * GET /api/agents/search
 * 
 * Available to all authenticated users
 */
export async function GET(request: NextRequest) {
  try {
    // Check auth
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city') || undefined;
    const state = searchParams.get('state') || undefined;
    const zipCode = searchParams.get('zipCode') || undefined;
    const specializations = searchParams.get('specializations')?.split(',') || undefined;
    const minRating = searchParams.get('minRating') 
      ? parseFloat(searchParams.get('minRating')!) 
      : undefined;
    const maxResults = searchParams.get('limit') 
      ? parseInt(searchParams.get('limit')!) 
      : 20;
    const sortBy = searchParams.get('sortBy') as 'rating' | 'reviews' | 'experience' | undefined;
    
    // At least state is required
    if (!state) {
      return NextResponse.json(
        { error: 'State is required' },
        { status: 400 }
      );
    }
    
    const firestoreService = new AgentFirestoreService();
    
    // Search agents
    const agents = await firestoreService.searchAgents({
      city,
      state,
      zipCode,
      specializations,
      minRating,
      maxResults,
      sortBy: sortBy || 'rating',
    });
    
    // Remove sensitive data for non-admin users
    const sanitizedAgents = agents.map(agent => {
      if (session.user.role === 'admin') {
        return agent; // Admins see everything
      }
      
      // For regular users, hide some sensitive data
      const { 
        totalEarnings,
        leadsReceived,
        ...publicData 
      } = agent;
      
      return publicData;
    });
    
    return NextResponse.json({
      success: true,
      agents: sanitizedAgents,
      count: sanitizedAgents.length,
      filters: {
        city,
        state,
        zipCode,
        specializations,
        minRating,
        sortBy: sortBy || 'rating',
      },
    });
    
  } catch (error) {
    console.error('[Agent Search] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search agents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}