import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 2) {
      return NextResponse.json({ cities: [] });
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!googleApiKey) {
      throw new Error('Google API key not configured');
    }

    // SUPER FAST: Use only Autocomplete API, no Details API calls
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&components=country:us&key=${googleApiKey}`,
      {
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error_message) {
      throw new Error(`Google API error: ${data.error_message}`);
    }

    // Fast processing - no additional API calls needed for autocomplete
    const cities = [];
    
    for (const prediction of data.predictions?.slice(0, limit) || []) {
      // Parse city and state from description
      const description = prediction.description || '';
      const parts = description.split(', ');
      
      if (parts.length >= 2) {
        const cityName = parts[0];
        const state = parts[1];
        
        // Store place_id for coordinate lookup when user selects this city
        cities.push({
          name: cityName,
          state: state,
          fullName: `${cityName}, ${state}`,
          place_id: prediction.place_id, // Store for later coordinate lookup
          lat: null, // Will be fetched when user selects
          lng: null
        });
      }
    }

    return NextResponse.json({ cities });

  } catch (error) {
    console.error('City search error:', error);
    return NextResponse.json(
      { error: 'Search failed', cities: [] },
      { status: 500 }
    );
  }
}