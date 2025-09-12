// Major cities in TX, FL, GA with their coordinates for radius calculations
export interface City {
  name: string;
  state: string;
  lat: number;
  lng: number;
  population?: number;
}

export const cities: City[] = [
  // Texas
  { name: "Houston", state: "TX", lat: 29.7604, lng: -95.3698, population: 2304580 },
  { name: "San Antonio", state: "TX", lat: 29.4241, lng: -98.4936, population: 1547253 },
  { name: "Dallas", state: "TX", lat: 32.7767, lng: -96.7970, population: 1343573 },
  { name: "Austin", state: "TX", lat: 30.2672, lng: -97.7431, population: 978908 },
  { name: "Fort Worth", state: "TX", lat: 32.7555, lng: -97.3308, population: 918915 },
  { name: "El Paso", state: "TX", lat: 31.7619, lng: -106.4850, population: 695044 },
  { name: "Arlington", state: "TX", lat: 32.7357, lng: -97.1081, population: 398854 },
  { name: "Corpus Christi", state: "TX", lat: 27.8006, lng: -97.3964, population: 326586 },
  { name: "Plano", state: "TX", lat: 33.0198, lng: -96.6989, population: 288061 },
  { name: "Lubbock", state: "TX", lat: 33.5779, lng: -101.8552, population: 258862 },
  { name: "Laredo", state: "TX", lat: 27.5306, lng: -99.4803, population: 255205 },
  { name: "Irving", state: "TX", lat: 32.8140, lng: -96.9489, population: 247220 },
  { name: "Garland", state: "TX", lat: 32.9126, lng: -96.6389, population: 246018 },
  { name: "Frisco", state: "TX", lat: 33.1507, lng: -96.8236, population: 200509 },
  { name: "McKinney", state: "TX", lat: 33.1972, lng: -96.6397, population: 199177 },
  { name: "Amarillo", state: "TX", lat: 35.2220, lng: -101.8313, population: 200393 },

  // Florida
  { name: "Jacksonville", state: "FL", lat: 30.3322, lng: -81.6557, population: 949611 },
  { name: "Miami", state: "FL", lat: 25.7617, lng: -80.1918, population: 442241 },
  { name: "Tampa", state: "FL", lat: 27.9506, lng: -82.4572, population: 384959 },
  { name: "Orlando", state: "FL", lat: 28.5383, lng: -81.3792, population: 307573 },
  { name: "St. Petersburg", state: "FL", lat: 27.7676, lng: -82.6403, population: 258308 },
  { name: "Hialeah", state: "FL", lat: 25.8576, lng: -80.2781, population: 223109 },
  { name: "Port St. Lucie", state: "FL", lat: 27.2939, lng: -80.3501, population: 204851 },
  { name: "Tallahassee", state: "FL", lat: 30.4518, lng: -84.2807, population: 194500 },
  { name: "Cape Coral", state: "FL", lat: 26.5629, lng: -81.9495, population: 194016 },
  { name: "Fort Lauderdale", state: "FL", lat: 26.1224, lng: -80.1373, population: 182760 },
  { name: "Pembroke Pines", state: "FL", lat: 25.7210, lng: -80.2242, population: 171178 },
  { name: "Hollywood", state: "FL", lat: 26.0112, lng: -80.1495, population: 153067 },
  { name: "Gainesville", state: "FL", lat: 29.6516, lng: -82.3248, population: 141085 },
  { name: "Coral Springs", state: "FL", lat: 26.2714, lng: -80.2706, population: 134394 },
  { name: "Clearwater", state: "FL", lat: 27.9659, lng: -82.8001, population: 117292 },
  { name: "Miami Beach", state: "FL", lat: 25.7907, lng: -80.1300, population: 82890 },

  // Georgia
  { name: "Atlanta", state: "GA", lat: 33.7490, lng: -84.3880, population: 498715 },
  { name: "Columbus", state: "GA", lat: 32.4609, lng: -84.9877, population: 206922 },
  { name: "Augusta", state: "GA", lat: 33.4734, lng: -82.0105, population: 202081 },
  { name: "Savannah", state: "GA", lat: 32.0835, lng: -81.0998, population: 147780 },
  { name: "Athens", state: "GA", lat: 33.9519, lng: -83.3576, population: 127315 },
  { name: "Sandy Springs", state: "GA", lat: 33.9304, lng: -84.3733, population: 108080 },
  { name: "Roswell", state: "GA", lat: 34.0232, lng: -84.3616, population: 94884 },
  { name: "Macon", state: "GA", lat: 32.8407, lng: -83.6324, population: 157346 },
  { name: "Johns Creek", state: "GA", lat: 34.0289, lng: -84.1986, population: 84551 },
  { name: "Albany", state: "GA", lat: 31.5785, lng: -84.1557, population: 72634 },
  { name: "Warner Robins", state: "GA", lat: 32.6130, lng: -83.6240, population: 80308 },
  { name: "Alpharetta", state: "GA", lat: 34.0754, lng: -84.2941, population: 65818 },
  { name: "Marietta", state: "GA", lat: 33.9526, lng: -84.5499, population: 60972 },
  { name: "Valdosta", state: "GA", lat: 30.8327, lng: -83.2785, population: 56481 },
  { name: "Smyrna", state: "GA", lat: 33.8840, lng: -84.5144, population: 56666 },
];

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
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

// Find cities within radius of a given city
export function getCitiesWithinRadius(centerCity: string, centerState: string, radiusMiles: number): City[] {
  const center = cities.find(city => 
    city.name.toLowerCase() === centerCity.toLowerCase() && 
    city.state === centerState
  );
  
  if (!center) return [];
  
  return cities.filter(city => {
    if (city.name === center.name && city.state === center.state) return true; // Include center city
    const distance = calculateDistance(center.lat, center.lng, city.lat, city.lng);
    return distance <= radiusMiles;
  });
}

// Search cities by name with fuzzy matching
export function searchCities(query: string, limit: number = 10): City[] {
  if (!query || query.length < 2) return [];
  
  const queryLower = query.toLowerCase();
  
  // Exact matches first
  const exactMatches = cities.filter(city => 
    city.name.toLowerCase() === queryLower
  );
  
  // Starts with matches
  const startsWithMatches = cities.filter(city => 
    city.name.toLowerCase().startsWith(queryLower) && 
    !exactMatches.some(exact => exact.name === city.name && exact.state === city.state)
  );
  
  // Contains matches
  const containsMatches = cities.filter(city => 
    city.name.toLowerCase().includes(queryLower) && 
    !exactMatches.some(exact => exact.name === city.name && exact.state === city.state) &&
    !startsWithMatches.some(starts => starts.name === city.name && starts.state === city.state)
  );
  
  const results = [...exactMatches, ...startsWithMatches, ...containsMatches]
    .sort((a, b) => (b.population || 0) - (a.population || 0)) // Sort by population
    .slice(0, limit);
  
  return results;
}

// Get city coordinates for property location matching
export function getCityCoordinates(cityName: string, state: string): { lat: number; lng: number } | null {
  const city = cities.find(c => 
    c.name.toLowerCase() === cityName.toLowerCase() && 
    c.state === state
  );
  
  return city ? { lat: city.lat, lng: city.lng } : null;
}