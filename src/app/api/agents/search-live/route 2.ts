import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { enhanceAgentWithBusinessProfile } from '@/lib/google-business-screenshot';

interface GooglePlacesAgent {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  photos?: Array<{ photo_reference: string }>;
  geometry?: { location: { lat: number; lng: number } };
}

/**
 * Live agent search using Google Places API
 * GET /api/agents/search-live
 * 
 * Searches for agents on-demand without storing in database
 */
export async function GET(request: NextRequest) {
  try {
    // Check auth
    const authResult = await requireAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }
    
    const { session } = authResult;
    
    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city')?.trim();
    const state = searchParams.get('state')?.trim()?.toUpperCase();
    const minRatingParam = searchParams.get('minRating');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    
    // Input validation
    if (!city || !state) {
      return NextResponse.json(
        { error: 'City and state are required' },
        { status: 400 }
      );
    }
    
    // Validate city and state format
    if (city.length > 50 || !/^[a-zA-Z\s-']+$/.test(city)) {
      return NextResponse.json(
        { error: 'Invalid city format' },
        { status: 400 }
      );
    }
    
    if (state.length !== 2 || !/^[A-Z]{2}$/.test(state)) {
      return NextResponse.json(
        { error: 'State must be a 2-letter code (e.g., TN, CA)' },
        { status: 400 }
      );
    }
    
    // Validate and limit parameters
    const minRating = minRatingParam ? 
      Math.max(0, Math.min(5, parseFloat(minRatingParam))) : 0;
    const limit = limitParam ? 
      Math.max(1, Math.min(20, parseInt(limitParam))) : 3; // Default to 3 agents for better UX
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam)) : 0;
    
    // Basic rate limiting check (per user)
    const userAgent = request.headers.get('user-agent') || '';
    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
      return NextResponse.json(
        { error: 'Automated requests not allowed' },
        { status: 429 }
      );
    }
    
    // Get Google API key
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API not configured' },
        { status: 500 }
      );
    }
    
    console.log(`[Live Agent Search] Searching for agents in ${city}, ${state}`);
    
    // Search Google Places for real estate agents
    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    searchUrl.searchParams.set('query', `real estate agents in ${city} ${state}`);
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('type', 'real_estate_agency');
    
    console.log(`[Live Agent Search] Google Places URL: ${searchUrl.toString().replace(apiKey, 'API_KEY_HIDDEN')}`);
    
    // Add timeout to main search request to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for main search
    
    let response;
    try {
      response = await fetch(searchUrl.toString(), {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error(`[Live Agent Search] Google Places API timeout after 10s`);
        return NextResponse.json(
          { error: 'Google Places API request timed out. Please try again.' },
          { status: 408 }
        );
      }
      
      console.error(`[Live Agent Search] Google Places API fetch error:`, fetchError);
      return NextResponse.json(
        { error: 'Google Places API request failed', details: 'Network error' },
        { status: 500 }
      );
    }
    
    if (!response.ok) {
      console.error(`[Live Agent Search] HTTP Error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: 'Google Places API request failed', details: `HTTP ${response.status}` },
        { status: 500 }
      );
    }
    
    const data = await response.json();
    console.log(`[Live Agent Search] Google API Status: ${data.status}`);
    
    if (data.status !== 'OK') {
      console.error('Google Places error:', data.status, data.error_message);
      
      // Handle specific Google API errors
      if (data.status === 'REQUEST_DENIED') {
        return NextResponse.json(
          { error: 'Google Places API access denied. Please check API key configuration.' },
          { status: 500 }
        );
      } else if (data.status === 'OVER_QUERY_LIMIT') {
        return NextResponse.json(
          { error: 'Google Places API quota exceeded. Please try again later.' },
          { status: 429 }
        );
      } else if (data.status === 'ZERO_RESULTS') {
        return NextResponse.json({
          success: true,
          agents: [],
          count: 0,
          query: { city, state, minRating, limit },
          message: `No real estate agents found in ${city}, ${state}`,
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to search agents', details: data.error_message || data.status },
        { status: 500 }
      );
    }
    
    console.log(`[Live Agent Search] Found ${data.results?.length || 0} results from Google`);
    
    // Process and filter results with rate limiting consideration
    const agents: any[] = [];
    const maxConcurrent = 5; // Limit concurrent requests to avoid rate limiting
    
    for (let i = 0; i < data.results.length && agents.length < limit; i += maxConcurrent) {
      const batch = data.results.slice(i, i + maxConcurrent);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (place: GooglePlacesAgent) => {
          try {
            // Get detailed info for each agent with timeout
            const details = await getPlaceDetails(place.place_id, apiKey);
            const agent = { ...place, ...details };
          
            // Filter by rating if specified
            if (minRating > 0 && (!agent.rating || agent.rating < minRating)) {
              return null;
            }
            
            // Extract ZIP from address
            const zipMatch = agent.formatted_address?.match(/\b\d{5}\b/);
            const zipCode = zipMatch ? zipMatch[0] : '';
            
            return {
              id: `google_${agent.place_id}`,
              name: agent.name,
              phone: agent.formatted_phone_number || '',
              website: agent.website || '',
              address: agent.formatted_address || '',
              city: city,
              state: state,
              zipCode: zipCode,
              
              // Ratings & Reviews
              rating: agent.rating || 0,
              reviewCount: agent.user_ratings_total || 0,
              
              // Google-specific data
              googleMapsUrl: `https://maps.google.com/maps/place/?q=place_id:${agent.place_id}`,
              photo: agent.photos?.[0]?.photo_reference ? 
                `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${agent.photos[0].photo_reference}&key=${apiKey}` : '',
              
              // Status
              isActive: agent.business_status === 'OPERATIONAL',
              source: 'google_places',
              
              // Calculated fields
              isFeatured: (agent.rating || 0) >= 4.5 && (agent.user_ratings_total || 0) >= 10,
              specializations: inferSpecializations(agent.name),
              location: agent.geometry?.location ? {
                lat: agent.geometry.location.lat,
                lng: agent.geometry.location.lng
              } : null,
            };
          } catch (error) {
            console.error(`Error processing agent ${place.name}:`, error);
            return null;
          }
        })
      );
      
      // Process batch results and add valid agents
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          agents.push(result.value);
        }
      });
    }
    
    // Sort agents by rating (highest first), then by review count
    const sortedAgents = agents
      .filter(agent => agent !== null)
      .sort((a, b) => {
        // First sort by rating (highest first)
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        // Then by review count (more reviews first)
        return b.reviewCount - a.reviewCount;
      });
    
    // Apply pagination: skip offset, then take limit
    const paginatedAgents = sortedAgents.slice(offset, offset + limit);
    const hasMore = sortedAgents.length > offset + limit;
    
    console.log(`[Live Agent Search] Returning ${paginatedAgents.length} of ${sortedAgents.length} total agents`);
    
    return NextResponse.json({
      success: true,
      agents: paginatedAgents,
      count: paginatedAgents.length,
      total: sortedAgents.length,
      hasMore: hasMore,
      query: { city, state, minRating, limit, offset },
      source: 'google_places_live',
      cached: false,
    });
    
  } catch (error) {
    console.error('[Live Agent Search] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search agents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get detailed place information with timeout
 */
async function getPlaceDetails(placeId: string, apiKey: string): Promise<Partial<GooglePlacesAgent>> {
  try {
    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.set('place_id', placeId);
    detailsUrl.searchParams.set('fields', 'formatted_phone_number,website,rating,user_ratings_total,business_status,photos,geometry');
    detailsUrl.searchParams.set('key', apiKey);
    
    // Add timeout to prevent hanging on slow API responses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const response = await fetch(detailsUrl.toString(), {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`Google Places Details API returned ${response.status} for ${placeId}`);
        return {};
      }
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.result) {
        return data.result;
      }
      
      if (data.status !== 'OK') {
        console.warn(`Google Places Details API status: ${data.status} for ${placeId}`);
      }
      
      return {};
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.warn(`Google Places Details timeout for ${placeId}`);
      } else {
        console.error(`Google Places Details error for ${placeId}:`, fetchError);
      }
      
      return {};
    }
  } catch (error) {
    console.error('Error setting up place details request:', error);
    return {};
  }
}

/**
 * Infer agent specializations from name
 */
function inferSpecializations(name: string): string[] {
  const specializations: string[] = [];
  const nameLower = name.toLowerCase();
  
  if (nameLower.includes('luxury') || nameLower.includes('estate') || nameLower.includes('premier')) {
    specializations.push('luxury');
  }
  
  if (nameLower.includes('commercial') || nameLower.includes('office')) {
    specializations.push('commercial');
  }
  
  if (nameLower.includes('first') || nameLower.includes('new')) {
    specializations.push('first-time-buyers');
  }
  
  // Default to residential
  if (specializations.length === 0) {
    specializations.push('residential');
  }
  
  return specializations;
}