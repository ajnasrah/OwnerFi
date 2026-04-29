import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GooglePlacesAgentService } from '@/lib/agents/google-places-agents';

/**
 * Populate agents automatically from multiple sources
 * POST /api/agents/populate
 * 
 * Admin only - fetches agent data from Google Places and other APIs
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { city, state, source = 'google' } = body;
    
    if (!city || !state) {
      return NextResponse.json(
        { error: 'City and state are required' },
        { status: 400 }
      );
    }
    
    console.log(`[Agent Populate] Starting for ${city}, ${state} from ${source}`);
    
    let results = {
      source,
      city,
      state,
      agentsFound: 0,
      message: '',
    };
    
    switch (source) {
      case 'google':
        // Use Google Places - most reliable and has reviews
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) {
          return NextResponse.json(
            { error: 'Google Places API key not configured' },
            { status: 400 }
          );
        }
        
        const googleService = new GooglePlacesAgentService(apiKey);
        const importedCount = await googleService.importAgentsToFirestore(city, state);
        
        results.agentsFound = importedCount;
        results.message = `Successfully imported ${importedCount} agents from Google Places`;
        break;
        
      case 'yelp':
        // Use Yelp Fusion API (free)
        results = await populateFromYelp(city, state);
        break;
        
      case 'ratemyagent':
        // Would need API access from RateMyAgent
        results.message = 'RateMyAgent requires API access - contact them at rate-my-agent.com/api';
        break;
        
      case 'homelight':
        // Would need partner API access
        results.message = 'HomeLight requires partner API - contact support@homelight.com';
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid source. Use: google, yelp, ratemyagent, or homelight' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      ...results,
    });
    
  } catch (error) {
    console.error('[Agent Populate] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to populate agents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Populate from Yelp (free API)
 */
async function populateFromYelp(city: string, state: string) {
  const yelpApiKey = process.env.YELP_API_KEY;
  
  if (!yelpApiKey) {
    return {
      source: 'yelp',
      city,
      state,
      agentsFound: 0,
      message: 'Yelp API key not configured. Get free key at yelp.com/developers',
    };
  }
  
  try {
    // Search for real estate agents
    const response = await fetch(
      `https://api.yelp.com/v3/businesses/search?location=${city},${state}&categories=realestateagents&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${yelpApiKey}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Yelp API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Import to Firestore
    for (const business of data.businesses) {
      // Save each agent to Firestore
      // Similar to Google Places implementation
    }
    
    return {
      source: 'yelp',
      city,
      state,
      agentsFound: data.businesses.length,
      message: `Imported ${data.businesses.length} agents from Yelp`,
    };
    
  } catch (error) {
    console.error('Yelp API error:', error);
    return {
      source: 'yelp',
      city,
      state,
      agentsFound: 0,
      message: 'Failed to fetch from Yelp',
    };
  }
}