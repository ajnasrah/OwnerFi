import { cities, City } from './cities';

interface NearbyCity {
  name: string;
  state: string;
  distance: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
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

/**
 * Get nearby cities within specified radius
 */
export async function getNearbyCitiesDirect(
  centerCity: string, 
  state: string, 
  radiusMiles: number
): Promise<NearbyCity[]> {
  const center = cities.find(c => 
    c.name.toLowerCase() === centerCity.toLowerCase() && 
    c.state.toLowerCase() === state.toLowerCase()
  );
  
  if (!center) {
    return [];
  }

  const nearbyCities: NearbyCity[] = [];
  
  for (const city of cities) {
    const distance = calculateDistance(center.lat, center.lng, city.lat, city.lng);
    if (distance <= radiusMiles && city.name !== centerCity) {
      nearbyCities.push({
        name: city.name,
        state: city.state,
        distance
      });
    }
  }
  
  return nearbyCities.sort((a, b) => a.distance - b.distance);
}