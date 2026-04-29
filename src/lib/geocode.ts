/**
 * Street-level geocoding via Google Maps Geocoding API.
 * COST PROTECTED: Rate limited to prevent expense explosions
 *
 * Used by the agent-response YES handler + backfill scripts to ensure
 * agent-ingested properties have latitude/longitude set. Without these,
 * Typesense doesn't get a `location` field and the property is invisible
 * to buyer geo-radius searches.
 *
 * Returns null on any failure (missing key, API error, no results). Callers
 * should write the property doc with lat/lng undefined in that case — not
 * block the flip to owner_finance.
 */

import { logger } from './structured-logger';
import { createGeocodingRateLimiter } from './rate-limiter-memory-safe';

// Memory-safe rate limiter for geocoding API calls
const geocodingLimiter = createGeocodingRateLimiter();

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export async function geocodeAddress(params: {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    logger.warn('GOOGLE_MAPS_API_KEY not configured', { function: 'geocodeAddress' });
    return null;
  }

  const parts = [params.street, params.city, params.state, params.zip]
    .map(s => (s || '').trim())
    .filter(Boolean);
  if (parts.length < 2) return null; // need at least street + city or similar

  // COST PROTECTION: Memory-safe rate limiting
  const address = parts.join(', ');
  if (!geocodingLimiter.isAllowed('geocoding')) {
    logger.warn('Geocoding rate limit exceeded', {
      function: 'geocodeAddress',
      address,
      cost: 5, // $5 per 1000 requests
      ...geocodingLimiter.getUsage('geocoding')
    });
    return null;
  }

  const query = parts.join(', ') + ', USA';
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

  try {
    const startTime = Date.now();
    const res = await fetch(url);
    const data = await res.json();
    const duration = Date.now() - startTime;

    if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
      const { lat, lng } = data.results[0].geometry.location;
      const usage = geocodingLimiter.recordCall('geocoding');
      
      logger.cost('Geocoding API call successful', 0.005, {
        function: 'geocodeAddress',
        query,
        callsThisHour: usage.current,
        limit: usage.limit,
        duration
      });
      return {
        lat,
        lng,
        formattedAddress: data.results[0].formatted_address,
      };
    }
    return null;
  } catch (err) {
    logger.error('Geocoding API error', { function: 'geocodeAddress', query }, err as Error);
    return null;
  }
}
