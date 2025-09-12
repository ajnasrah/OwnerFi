import { NextRequest, NextResponse } from 'next/server';

interface OverpassElement {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    name?: string;
    place?: string;
    state?: string;
    'addr:state'?: string;
  };
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface CityResult {
  name: string;
  state: string;
  lat: number;
  lng: number;
  distance: number;
  type: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseInt(searchParams.get('radius') || '50');

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Latitude and longitude required' },
        { status: 400 }
      );
    }

    // Use Overpass API to find all cities within radius
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["place"~"^(city|town|village)$"](around:${radius * 1609.34},${lat},${lng});
        way["place"~"^(city|town|village)$"](around:${radius * 1609.34},${lat},${lng});
        relation["place"~"^(city|town|village)$"](around:${radius * 1609.34},${lat},${lng});
      );
      out center;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: overpassQuery
      });

      if (!response.ok) {
        throw new Error('Overpass API error');
      }

      const data: OverpassResponse = await response.json();
      
      // Process and filter results
      const cities = data.elements
        .filter((element: OverpassElement) => element.tags && element.tags.name)
        .map((element: OverpassElement) => {
          const elementLat = element.lat || element.center?.lat;
          const elementLng = element.lon || element.center?.lon;
          
          if (!elementLat || !elementLng) return null;
          
          // Calculate actual distance
          const distance = calculateDistance(lat, lng, elementLat, elementLng);
          
          return {
            name: element.tags?.name || 'Unknown',
            state: element.tags?.['addr:state'] || element.tags?.state || 'Unknown',
            lat: elementLat,
            lng: elementLng,
            distance: Math.round(distance * 10) / 10,
            type: element.tags?.place || 'city'
          };
        })
        .filter((city): city is CityResult => city !== null && city.name !== 'Unknown' && city.distance <= radius)
        .sort((a, b) => a.distance - b.distance);

      return NextResponse.json({
        centerCity: { lat, lng },
        radius,
        totalCities: cities.length,
        cities: cities.slice(0, 100) // Limit to 100 cities
      });

    } catch (error) {
      // Fallback to simple radius calculation using major cities
      return NextResponse.json({
        centerCity: { lat, lng },
        radius,
        totalCities: 0,
        cities: [],
        error: 'Unable to fetch cities in radius'
      });
    }

  } catch (error) {
    return NextResponse.json(
      { error: 'Search failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}