import { cities, City } from './cities';

interface NearbyCity {
  name: string;
  state: string;
  distance: number;
}

/**
 * Ultra-fast nearby cities lookup with optimized distance calculation
 */
export async function getNearbyCitiesUltraFast(
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
  const radiusSquared = radiusMiles * radiusMiles;
  
  // Pre-filter by approximate bounding box for performance
  const latRange = radiusMiles / 69; // Approximate miles per degree of latitude
  const lngRange = radiusMiles / (69 * Math.cos(center.lat * Math.PI / 180));
  
  for (const city of cities) {
    // Quick bounding box check
    if (Math.abs(city.lat - center.lat) <= latRange && 
        Math.abs(city.lng - center.lng) <= lngRange &&
        city.name !== centerCity) {
      
      // Precise distance calculation only for candidates
      const R = 3959;
      const dLat = (city.lat - center.lat) * Math.PI / 180;
      const dLng = (city.lng - center.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(center.lat * Math.PI / 180) * Math.cos(city.lat * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      if (distance <= radiusMiles) {
        nearbyCities.push({
          name: city.name,
          state: city.state,
          distance
        });
      }
    }
  }
  
  return nearbyCities.sort((a, b) => a.distance - b.distance);
}