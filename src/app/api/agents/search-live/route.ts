import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { enhanceAgentWithBusinessProfile } from '@/lib/google-business-screenshot';
import { saveAgent, getCityAgents, updateCityCache, needsRefresh, AgentRecord } from '@/lib/agents/agent-tracking';
import { StandardizedApiError, ValidationErrors, withErrorHandling, ErrorCode } from '@/lib/api-error-standards';

// In-memory cache for agent searches (resets on server restart)
// Key: `${city}-${state}`, Value: { agents: Agent[], timestamp: number, version: number }
const agentCache = new Map<string, { agents: any[], timestamp: number, version: number }>();

// SMART CACHE DURATIONS - Balance cost vs freshness
const CACHE_DURATION_FRESH = 2 * 60 * 1000;   // 2 minutes for first-time users (get latest data)
const CACHE_DURATION_RETURN = 15 * 60 * 1000; // 15 minutes for return users (cost savings)
const CACHE_DURATION_STALE = 60 * 60 * 1000;  // 1 hour maximum before forced refresh

// Rate limiting per user to prevent API abuse
// Key: userId, Value: { count: number, resetTime: number }
const userRateLimit = new Map<string, { count: number, resetTime: number }>();
const MAX_SEARCHES_PER_HOUR = 5; // Limit users to 5 searches per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

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
  return withErrorHandling(async () => {
    // Check if this is an internal cron call
    const isCronCall = request.headers.get('X-Cron-Internal') === 'true';
    let session: any = null;
    
    if (isCronCall) {
      console.log('[Live Agent Search] Internal cron call detected, skipping user auth');
      // Create mock session for cron calls
      session = { 
        user: { 
          id: 'cron-system', 
          email: 'system@ownerfi.ai', 
          role: 'admin' 
        } 
      };
    } else {
      // Check regular user auth
      const authResult = await requireAuth(request);
      if ('error' in authResult) {
        return authResult.error;
      }
      session = authResult.session;
    }
    
    // USER RATE LIMITING - Prevent API abuse (skip for cron)
    const userId = session.user.id;
    const now = Date.now();
    
    if (!isCronCall) {
      const userLimit = userRateLimit.get(userId);
      
      if (userLimit) {
        if (now > userLimit.resetTime) {
          // Reset counter after window
          userRateLimit.set(userId, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
        } else if (userLimit.count >= MAX_SEARCHES_PER_HOUR) {
          const remainingTime = Math.ceil((userLimit.resetTime - now) / 60000); // minutes
          throw new StandardizedApiError({
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: `Too many agent searches. Please try again in ${remainingTime} minutes.`,
            details: { remainingTime, maxSearches: MAX_SEARCHES_PER_HOUR },
            context: { function: 'agent-search-live', userId }
          });
        }
      } else {
        // First search for this user
        userRateLimit.set(userId, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
      }
    }
    
    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city')?.trim();
    const state = searchParams.get('state')?.trim()?.toUpperCase();
    const minRatingParam = searchParams.get('minRating');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    
    // Input validation
    if (!city) {
      throw ValidationErrors.missingField('city');
    }
    if (!state) {
      throw ValidationErrors.missingField('state');
    }
    
    // Validate city and state format
    if (city.length > 50 || !/^[a-zA-Z\s-']+$/.test(city)) {
      throw ValidationErrors.invalidFormat('city', 'letters, spaces, hyphens, apostrophes only, max 50 chars');
    }
    
    if (state.length !== 2 || !/^[A-Z]{2}$/.test(state)) {
      throw ValidationErrors.invalidFormat('state', '2-letter code (e.g., TN, CA)');
    }
    
    // Validate and limit parameters - STRICT COST CONTROL
    const minRating = minRatingParam ? 
      Math.max(0, Math.min(5, parseFloat(minRatingParam))) : 0;
    const limit = limitParam ? 
      Math.max(1, Math.min(6, parseInt(limitParam))) : 3; // Max 6 agents (cost control)
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam)) : 0;
    
    // COST PROTECTION: Maximum 6 agents per user per session
    const maxAgentsPerSearch = 6;
    
    // Basic rate limiting check (per user)
    const userAgent = request.headers.get('user-agent') || '';
    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
      throw new StandardizedApiError({
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Automated requests not allowed',
        context: { function: 'agent-search-live', userAgent }
      });
    }
    
    // Get Google API key
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new StandardizedApiError({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: 'Google Places API not configured',
        context: { function: 'agent-search-live' }
      });
    }
    
    console.log(`[Live Agent Search] Searching for agents in ${city}, ${state}`);
    
    // CHECK DATABASE FIRST - May have fresher data than memory cache
    const cacheKey = `${city.toLowerCase()}-${state.toLowerCase()}`;
    const dbNeedsRefresh = await needsRefresh(city, state, 15); // 15 min database staleness
    const isFirstTimeUser = !userRateLimit.has(userId) || userRateLimit.get(userId)!.count === 0;
    
    if (!dbNeedsRefresh && !isFirstTimeUser) {
      console.log(`[Live Agent Search] DATABASE HIT - Serving fresh database results for ${cacheKey}`);
      
      // Get agents from database (fresher than memory cache)
      const dbAgents = await getCityAgents(city, state);
      
      if (dbAgents.length > 0) {
        const sortedAgents = dbAgents
          .filter(agent => agent.rating >= minRating)
          .sort((a, b) => {
            if (b.rating !== a.rating) return b.rating - a.rating;
            return b.reviewCount - a.reviewCount;
          });
        
        const paginatedAgents = sortedAgents.slice(offset, offset + limit);
        const hasMore = sortedAgents.length > offset + limit;
        
        return NextResponse.json({
          success: true,
          agents: paginatedAgents,
          count: paginatedAgents.length,
          total: sortedAgents.length,
          hasMore: hasMore,
          query: { city, state, minRating, limit, offset },
          source: 'database_fresh',
          cached: true,
          cacheAge: 0,
        });
      }
    }
    
    // FALLBACK TO MEMORY CACHE if database is stale but memory is fresh
    const cachedData = agentCache.get(cacheKey);
    
    if (cachedData) {
      const age = now - cachedData.timestamp;
      
      // Determine cache validity based on user behavior
      let maxAge: number;
      if (age > CACHE_DURATION_STALE) {
        maxAge = 0; // Force refresh after 1 hour
      } else if (isFirstTimeUser) {
        maxAge = CACHE_DURATION_FRESH; // Fresh data for new users
      } else {
        maxAge = CACHE_DURATION_RETURN; // Longer cache for return users
      }
      
      if (age < maxAge) {
        const cacheStatus = isFirstTimeUser ? 'FRESH' : 'RETURN';
        console.log(`[Live Agent Search] MEMORY CACHE HIT (${cacheStatus}) - Age: ${Math.round(age/1000)}s for ${cacheKey}`);
        
        // Apply pagination to cached results
        const sortedAgents = cachedData.agents
          .sort((a, b) => {
            if (b.rating !== a.rating) return b.rating - a.rating;
            return b.reviewCount - a.reviewCount;
          })
          .filter(agent => agent.rating >= minRating);
        
        const paginatedAgents = sortedAgents.slice(offset, offset + limit);
        const hasMore = sortedAgents.length > offset + limit;
        
        return NextResponse.json({
          success: true,
          agents: paginatedAgents,
          count: paginatedAgents.length,
          total: sortedAgents.length,
          hasMore: hasMore,
          query: { city, state, minRating, limit, offset },
          source: `memory_${cacheStatus.toLowerCase()}`,
          cached: true,
          cacheAge: Math.round(age / 1000),
        });
      } else {
        console.log(`[Live Agent Search] MEMORY CACHE EXPIRED - Age: ${Math.round(age/1000)}s > ${Math.round(maxAge/1000)}s for ${cacheKey}`);
      }
    }
    
    console.log(`[Live Agent Search] CACHE MISS - Making Google API calls for ${cacheKey}`);
    
    // INCREMENT USER SEARCH COUNT (only for non-cached searches and non-cron)
    if (!isCronCall) {
      const currentUserLimit = userRateLimit.get(userId)!;
      userRateLimit.set(userId, {
        ...currentUserLimit,
        count: currentUserLimit.count + 1
      });
      
      console.log(`[Live Agent Search] User ${userId} search count: ${currentUserLimit.count + 1}/${MAX_SEARCHES_PER_HOUR}`);
    } else {
      console.log(`[Live Agent Search] Cron call - skipping rate limit increment`);
    }
    
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
    
    // COST CONTROL: Limit total agents processed to save API calls
    const maxAgentsToProcess = Math.min(maxAgentsPerSearch, data.results.length);
    console.log(`[Live Agent Search] Processing ${maxAgentsToProcess} of ${data.results.length} results to control costs`);
    
    // Process and filter results with rate limiting consideration
    const agents: any[] = [];
    const maxConcurrent = 5; // Limit concurrent requests to avoid rate limiting
    
    for (let i = 0; i < maxAgentsToProcess; i += maxConcurrent) {
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
            
            const baseAgent = {
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
              place_id: agent.place_id
            };

            // Enhance with business profile visuals
            return enhanceAgentWithBusinessProfile(baseAgent, {
              width: 400,
              height: 300
            });
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
    
    // SAVE TO DATABASE - Track agents for rating changes and persistence
    console.log(`[Live Agent Search] Saving ${sortedAgents.length} agents to database for tracking`);
    const savedAgentIds: string[] = [];
    
    try {
      // Save each agent to database (batch this in production)
      for (const agent of sortedAgents) {
        const agentRecord: Omit<AgentRecord, 'firstSeen' | 'lastUpdated' | 'totalUpdates'> = {
          id: agent.id,
          placeId: agent.placeId || agent.place_id,
          name: agent.name,
          phone: agent.phone || '',
          website: agent.website || '',
          address: agent.address || '',
          city: city.toLowerCase(),
          state: state.toUpperCase(),
          zipCode: agent.zipCode || '',
          rating: agent.rating || 0,
          reviewCount: agent.reviewCount || 0,
          isActive: agent.isActive !== false,
          isFeatured: agent.isFeatured || false,
          specializations: agent.specializations || [],
          googleMapsUrl: agent.googleMapsUrl || '',
          photo: agent.photo,
          location: agent.location
        };
        
        await saveAgent(agentRecord);
        savedAgentIds.push(agent.id);
      }
      
      // Update city cache metadata
      await updateCityCache(city, state, savedAgentIds);
      
    } catch (dbError) {
      console.error('[Live Agent Search] Database save error (non-critical):', dbError);
      // Continue with response even if database save fails
    }
    
    // CACHE RESULTS IN MEMORY with version tracking
    const previousVersion = cachedData?.version || 0;
    const newVersion = previousVersion + 1;
    
    agentCache.set(cacheKey, {
      agents: sortedAgents,
      timestamp: Date.now(),
      version: newVersion
    });
    
    // COST MONITORING - Log API usage
    const apiCalls = 1 + maxAgentsToProcess; // 1 text search + N place details
    const estimatedCost = (1 * 0.032) + (maxAgentsToProcess * 0.017); // $32/1k + $17/1k
    
    console.log(`[COST-MONITOR] API calls made: ${apiCalls} (1 text search + ${maxAgentsToProcess} place details)`);
    console.log(`[COST-MONITOR] Estimated cost: $${estimatedCost.toFixed(4)}`);
    console.log(`[Live Agent Search] CACHED results for ${cacheKey} - ${sortedAgents.length} agents`);
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
    
  }, { endpoint: 'GET /api/agents/search-live' });
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