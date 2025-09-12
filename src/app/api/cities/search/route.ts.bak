// CITY SEARCH API - Backend proxy for Google Places API
// Handles CORS and API key security

import { NextRequest, NextResponse } from 'next/server';
import { GooglePlacesService, validateCityQuery, googlePlacesRateLimiter } from '@/lib/google-places-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    // Validate query
    const validation = validateCityQuery(query);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    if (!googlePlacesRateLimiter.canMakeRequest(clientIP, 10, 1)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a minute.' },
        { status: 429 }
      );
    }

    // Search cities using Google Places API
    const cities = await GooglePlacesService.searchCities(query, limit);

    return NextResponse.json({
      cities,
      hasMore: cities.length === limit
    });

  } catch {
    return NextResponse.json(
      { error: 'City search failed. Please try again.' },
      { status: 500 }
    );
  }
}