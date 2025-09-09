// Calculate distance between two coordinates using Haversine formula
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

// Get coordinates for a city
export async function getCityCoordinates(cityName: string, state: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&city=${encodeURIComponent(cityName)}&state=${encodeURIComponent(state)}&country=us`,
      { headers: { 'User-Agent': 'OwnerFi-App/1.0' } }
    );
    const data = await response.json();
    
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to get city coordinates:', error);
    return null;
  }
}

// Check if a property city is within radius of buyer's preferred city
export async function isPropertyWithinRadius(
  propertyCity: string,
  propertyState: string,
  centerCity: string,
  centerState: string,
  radiusMiles: number
): Promise<{ withinRadius: boolean; distance?: number }> {
  try {
    // Get coordinates for both cities
    const [centerCoords, propertyCoords] = await Promise.all([
      getCityCoordinates(centerCity, centerState),
      getCityCoordinates(propertyCity, propertyState)
    ]);

    if (!centerCoords || !propertyCoords) {
      // If we can't get coordinates, include the property (benefit of doubt)
      return { withinRadius: true };
    }

    const distance = calculateDistance(
      centerCoords.lat, centerCoords.lng,
      propertyCoords.lat, propertyCoords.lng
    );

    return {
      withinRadius: distance <= radiusMiles,
      distance: Math.round(distance * 10) / 10
    };
  } catch (error) {
    console.error('Error checking radius:', error);
    // If there's an error, include the property
    return { withinRadius: true };
  }
}

// Apply buyer's filter to properties
export function applyBuyerFilter(properties: Record<string, unknown>[], buyerProfile: Record<string, unknown>): Record<string, unknown>[] {
  return properties.filter(property => {
    // Monthly payment filter
    if (buyerProfile.maxMonthlyPayment && property.monthlyPayment > buyerProfile.maxMonthlyPayment) {
      return false;
    }

    // Down payment filter  
    if (buyerProfile.maxDownPayment && property.downPaymentAmount > buyerProfile.maxDownPayment) {
      return false;
    }

    // Optional bedroom filter
    if (buyerProfile.minBedrooms && property.bedrooms < buyerProfile.minBedrooms) {
      return false;
    }

    // Optional bathroom filter
    if (buyerProfile.minBathrooms && property.bathrooms < buyerProfile.minBathrooms) {
      return false;
    }

    return true;
  });
}