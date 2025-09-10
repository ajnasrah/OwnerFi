import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '10');
  
  try {

    if (!query || query.length < 2) {
      return NextResponse.json({ cities: [] });
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!googleApiKey) {
      throw new Error('Google API key not configured');
    }

    // SUPER FAST: Use only Autocomplete API with timeout and retry
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    let response;
    try {
      response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(cities)&components=country:us&key=${googleApiKey}`,
        {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn('Google API timeout, using fallback cities');
        return NextResponse.json({ cities: getFallbackCities(query) });
      }
      throw error;
    }

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
    // Always return fallback cities instead of empty array
    const fallbackCities = getFallbackCities(query || '');
    console.warn(`Using ${fallbackCities.length} fallback cities for query: ${query || 'empty'}`);
    return NextResponse.json({ cities: fallbackCities });
  }
}

// Fallback cities when Google API is unavailable
function getFallbackCities(query: string) {
  const majorCities = [
    { name: 'Dallas', state: 'TX', fullName: 'Dallas, TX', place_id: 'ChIJS5dFe_cZTIYRj2dH9qSb7Lk', lat: null, lng: null },
    { name: 'Houston', state: 'TX', fullName: 'Houston, TX', place_id: 'ChIJAYWNSLS4QIYROwVl894CDco', lat: null, lng: null },
    { name: 'Austin', state: 'TX', fullName: 'Austin, TX', place_id: 'ChIJLwPMoJm1RIYRetVp1EtGm10', lat: null, lng: null },
    { name: 'San Antonio', state: 'TX', fullName: 'San Antonio, TX', place_id: 'ChIJrw7QBq5lXIYRvVdTv9HQoSo', lat: null, lng: null },
    { name: 'Fort Worth', state: 'TX', fullName: 'Fort Worth, TX', place_id: 'ChIJrQm2_sMZTIYRJ16MlAF4es8', lat: null, lng: null },
    { name: 'Memphis', state: 'TN', fullName: 'Memphis, TN', place_id: 'ChIJRZdD6h5-1YcR_rYaYBXzk9E', lat: null, lng: null },
    { name: 'Nashville', state: 'TN', fullName: 'Nashville, TN', place_id: 'ChIJPZDrEzLsZIgRoNrpodC5P30', lat: null, lng: null },
    { name: 'Atlanta', state: 'GA', fullName: 'Atlanta, GA', place_id: 'ChIJyT-lLEi9X4gR-Au8pCNpXEU', lat: null, lng: null },
    { name: 'Phoenix', state: 'AZ', fullName: 'Phoenix, AZ', place_id: 'ChIJowg_Ul2tLF4Rz1-K5YF0sQk', lat: null, lng: null },
    { name: 'Miami', state: 'FL', fullName: 'Miami, FL', place_id: 'ChIJEcHIDqKw2YgRZU-t3XHylv8', lat: null, lng: null }
  ];
  
  return majorCities.filter(city => 
    city.name.toLowerCase().includes(query.toLowerCase()) ||
    city.state.toLowerCase().includes(query.toLowerCase())
  );
}