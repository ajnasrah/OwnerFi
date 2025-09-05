import { NextRequest, NextResponse } from 'next/server';
import { cityCache } from '@/lib/cache';
import { externalApiLimiter } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 3) {
      return NextResponse.json({ cities: [] });
    }

    // Check cache first
    const cacheKey = `search:${query}:${limit}`;
    const cached = cityCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Check rate limit for external API calls
    const clientIp = request.headers.get('x-forwarded-for') || 'localhost';
    const canMakeRequest = await externalApiLimiter.check(clientIp);
    
    if (!canMakeRequest) {
      // If rate limited, use fallback
      console.log('Rate limited, using local fallback');
      const { searchCities } = await import('@/lib/cities');
      const results = searchCities(query, limit);
      
      const fallbackResult = { 
        cities: results.map(city => ({
          name: city.name,
          state: city.state,
          fullName: `${city.name}, ${city.state}`,
          lat: city.lat,
          lng: city.lng,
          population: city.population
        }))
      };
      
      cityCache.set(cacheKey, fallbackResult, 600000); // Cache for 10 minutes
      return NextResponse.json(fallbackResult);
    }

    // Use Nominatim (OpenStreetMap) free geocoding API for all US cities
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=${limit}&countrycodes=us&city=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'OwnerFi-App/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error('Nominatim API error');
      }
      
      const data = await response.json();
      
      // Filter and format results
      const cities = data
        .filter((item: any) => {
          // Include any place with an address in the US
          return item.address && 
                 item.address.country_code === 'us' &&
                 item.address.state &&
                 (item.address.city || item.address.town || item.address.village || item.name);
        })
        .map((item: any) => {
          const cityName = item.address.city || item.address.town || item.address.village || item.name;
          const stateAbbr = getStateAbbreviation(item.address.state);
          
          return {
            name: cityName,
            state: stateAbbr,
            fullName: `${cityName}, ${stateAbbr}`,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            importance: item.importance || 0
          };
        })
        .filter((city: any) => city.state && city.name && city.name.length > 0)
        .sort((a: any, b: any) => b.importance - a.importance);

      // Cache the results
      const result = { cities };
      cityCache.set(cacheKey, result, 1800000); // Cache for 30 minutes
      
      return NextResponse.json(result);
      
    } catch (apiError) {
      // Fallback to our local database if external API fails
      console.log('External API failed, using fallback');
      const { searchCities } = await import('@/lib/cities');
      const results = searchCities(query, limit);
      
      return NextResponse.json({ 
        cities: results.map(city => ({
          name: city.name,
          state: city.state,
          fullName: `${city.name}, ${city.state}`,
          lat: city.lat,
          lng: city.lng,
          population: city.population
        }))
      });
    }

  } catch (error) {
    return NextResponse.json(
      { error: 'Search failed', details: (error as Error).message },
      { status: 500 }
    );
  }
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