import { NextRequest, NextResponse } from 'next/server';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_API_URL = 'https://api.heygen.com/v2/avatars';

// Cache configuration
let cache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  // Check cache first
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    console.log('Returning cached avatars data');
    return NextResponse.json(cache.data);
  }
  try {
    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: 'HeyGen API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(HEYGEN_API_URL, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': HEYGEN_API_KEY,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Failed to fetch avatars from HeyGen', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    // HeyGen API returns data in {error: null, data: {avatars: [], talking_photos: []}} format
    const apiData = data.data || data;

    const responseData = {
      success: true,
      avatars: apiData.avatars || [],
      talking_photos: apiData.talking_photos || [],
    };

    // Update cache
    cache = {
      data: responseData,
      timestamp: Date.now()
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching HeyGen avatars:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
