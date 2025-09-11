import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('place_id');

    if (!placeId) {
      return NextResponse.json({ error: 'Missing place_id' }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!googleApiKey) {
      throw new Error('Google API key not configured');
    }

    // Get coordinates for selected city
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,geometry,address_components&key=${googleApiKey}`,
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

    if (data.result?.geometry?.location) {
      // Extract city and state from address components
      const addressComponents = data.result.address_components || [];
      let cityName = data.result.name;
      let state = '';
      
      for (const component of addressComponents) {
        if (component.types.includes('locality')) {
          cityName = component.long_name;
        }
        if (component.types.includes('administrative_area_level_1')) {
          state = component.short_name;
        }
      }

      return NextResponse.json({
        name: cityName,
        state: state,
        fullName: `${cityName}, ${state}`,
        lat: data.result.geometry.location.lat,
        lng: data.result.geometry.location.lng
      });
    }

    throw new Error('No location data found');

  } catch {
    return NextResponse.json(
      { error: 'Failed to get coordinates' },
      { status: 500 }
    );
  }
}