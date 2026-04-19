/**
 * Street-level geocoding via Google Maps Geocoding API.
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
    console.warn('[geocode] GOOGLE_MAPS_API_KEY not configured');
    return null;
  }

  const parts = [params.street, params.city, params.state, params.zip]
    .map(s => (s || '').trim())
    .filter(Boolean);
  if (parts.length < 2) return null; // need at least street + city or similar

  const query = parts.join(', ') + ', USA';
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
      const { lat, lng } = data.results[0].geometry.location;
      return {
        lat,
        lng,
        formattedAddress: data.results[0].formatted_address,
      };
    }
    return null;
  } catch (err) {
    console.error('[geocode] error', err);
    return null;
  }
}
