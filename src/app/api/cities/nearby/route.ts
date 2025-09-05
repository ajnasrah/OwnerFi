import { NextRequest, NextResponse } from 'next/server';
import { cityCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseInt(searchParams.get('radius') || '50');

    if (!lat || !lng) {
      return NextResponse.json({ error: 'Missing latitude or longitude' }, { status: 400 });
    }

    // Check cache first - round coordinates to reduce cache misses
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLng = Math.round(lng * 100) / 100;
    const cacheKey = `nearby:${roundedLat}:${roundedLng}:${radius}`;
    const cached = cityCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Expanded search to get more cities in the area
    const searchRadius = radius * 0.015; // Convert miles to approximate degrees for wider search
    const nominatimQueries = [
      // Search for cities in general area
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=100&countrycodes=us&q=city&bounded=1&viewbox=${lng-searchRadius},${lat+searchRadius},${lng+searchRadius},${lat-searchRadius}`,
      // Search for towns in general area  
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=100&countrycodes=us&q=town&bounded=1&viewbox=${lng-searchRadius},${lat+searchRadius},${lng+searchRadius},${lat-searchRadius}`,
      // Search for villages/communities
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=100&countrycodes=us&q=village&bounded=1&viewbox=${lng-searchRadius},${lat+searchRadius},${lng+searchRadius},${lat-searchRadius}`,
    ];
    
    try {
      let allResults: any[] = [];
      
      // Fetch from multiple search queries to get more comprehensive results
      for (const url of nominatimQueries) {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'OwnerFi-App/1.0'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            allResults = [...allResults, ...data];
          }
        } catch (queryError) {
          console.warn('One search query failed, continuing with others');
        }
        
        // Small delay between requests to be respectful to API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Remove duplicates and filter/calculate distances
      const uniqueCities = new Map();
      
      allResults
        .filter((item: any) => {
          return item.address && 
                 item.address.country_code === 'us' &&
                 item.address.state &&
                 (item.address.city || item.address.town || item.address.village || item.name);
        })
        .forEach((item: any) => {
          const cityName = item.address.city || item.address.town || item.address.village || item.name;
          const stateAbbr = getStateAbbreviation(item.address.state);
          const cityLat = parseFloat(item.lat);
          const cityLng = parseFloat(item.lon);
          const distance = calculateDistance(lat, lng, cityLat, cityLng);
          
          // Only include cities within radius
          if (distance <= radius && cityName && cityName.length > 0) {
            const key = `${cityName.toLowerCase()}-${stateAbbr}`;
            
            if (!uniqueCities.has(key) || uniqueCities.get(key).distance > distance) {
              uniqueCities.set(key, {
                name: cityName,
                state: stateAbbr,
                fullName: `${cityName}, ${stateAbbr}`,
                lat: cityLat,
                lng: cityLng,
                distance: Math.round(distance * 10) / 10, // Round to 1 decimal
                importance: item.importance || 0
              });
            }
          }
        });

      // Convert to array and sort by distance
      const cities = Array.from(uniqueCities.values())
        .sort((a: any, b: any) => a.distance - b.distance)
        .slice(0, 30); // Increased limit to 30 cities

      // Cache the results
      const result = { cities };
      cityCache.set(cacheKey, result, 1800000); // Cache for 30 minutes
      
      return NextResponse.json(result);
      
    } catch (apiError) {
      return NextResponse.json(
        { error: 'Failed to fetch nearby cities', details: (apiError as Error).message },
        { status: 500 }
      );
    }

  } catch (error) {
    return NextResponse.json(
      { error: 'Search failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Convert full state names to abbreviations
function getStateAbbreviation(stateName: string): string {
  const stateMap: { [key: string]: string } = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  };
  
  return stateMap[stateName] || stateName;
}