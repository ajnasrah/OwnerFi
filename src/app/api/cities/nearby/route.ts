import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseInt(searchParams.get('radius') || '25');

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Missing latitude or longitude' }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!googleApiKey) {
      throw new Error('Google API key not configured');
    }

    const radiusMeters = radius * 1609.34; // Convert miles to meters
    const allCities = new Map();

    // FAST STRATEGY: Parallel API calls for better coverage and speed
    const searchPromises = [
      // Primary locality search
      fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=locality&key=${googleApiKey}`),
      
      // Secondary searches for more coverage
      fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=city&location=${lat},${lng}&radius=${radiusMeters}&type=locality&key=${googleApiKey}`),
      
      fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=town&location=${lat},${lng}&radius=${radiusMeters}&type=locality&key=${googleApiKey}`)
    ];

    // Execute all searches in parallel for speed
    const responses = await Promise.allSettled(searchPromises);

    for (const response of responses) {
      if (response.status === 'fulfilled' && response.value.ok) {
        try {
          const data = await response.value.json();
          
          for (const place of data.results || []) {
            if (place.geometry?.location && place.name) {
              const distance = calculateDistance(
                lat, lng,
                place.geometry.location.lat,
                place.geometry.location.lng
              );
              
              // Use slightly larger radius for edge cases like Fort Worth suburbs
              if (distance <= radius + 2) { // +2 miles buffer for suburbs
                const state = extractStateFromAddress(place.vicinity || place.formatted_address || '');
                
                if (state) {
                  const key = `${place.name.toLowerCase()}-${state}`;
                  
                  // Only include if within actual radius or if it's a major city slightly outside
                  const shouldInclude = distance <= radius || 
                    (distance <= radius + 5 && isMajorCity(place.name));
                  
                  if (shouldInclude && (!allCities.has(key) || allCities.get(key).distance > distance)) {
                    allCities.set(key, {
                      name: place.name,
                      state: state,
                      fullName: `${place.name}, ${state}`,
                      lat: place.geometry.location.lat,
                      lng: place.geometry.location.lng,
                      distance: Math.round(distance * 10) / 10
                    });
                  }
                }
              }
            }
          }
        } catch (_parseError) {
        }
      }
    }

    // Convert to array and sort alphabetically
    const cities = Array.from(allCities.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50);


    return NextResponse.json({ cities });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch nearby cities' },
      { status: 500 }
    );
  }
}

// Check if a city is considered major (should be included even if slightly outside radius)
function isMajorCity(cityName: string): boolean {
  const majorCities = [
    'Fort Worth', 'Arlington', 'Grand Prairie', 'Irving', 'Garland', 
    'Plano', 'McKinney', 'Mesquite', 'Carrollton', 'Richardson',
    'Frisco', 'Allen', 'Denton', 'Lewisville'
  ];
  
  return majorCities.some(major => 
    cityName.toLowerCase().includes(major.toLowerCase())
  );
}

// Calculate distance between coordinates
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Extract state from address string
function extractStateFromAddress(address: string): string | null {
  const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d/) || 
                    address.match(/,\s*([A-Z]{2})$/) ||
                    address.match(/\b(TX|TN|FL|GA|CA|AZ|CO|NV|IL|NY|NC|VA)\b/);
  
  return stateMatch ? stateMatch[1] : null;
}