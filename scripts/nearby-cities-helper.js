// Helper to find nearby cities using Haversine formula
const fs = require('fs');
const path = require('path');

// Load US cities data
const citiesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/lib/us-cities-data.json'), 'utf8')
);

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

// Find cities within radius of a given city
function findCitiesWithinRadius(cityName, state, radiusMiles = 30) {
  // Normalize inputs
  const searchCity = cityName.trim().toLowerCase();
  const searchState = state.trim().toUpperCase();

  // Find the source city
  const sourceCity = citiesData.find(city =>
    city.name.toLowerCase() === searchCity &&
    city.state === searchState
  );

  if (!sourceCity) {
    console.log(`City not found: ${cityName}, ${state}`);
    return [];
  }

  // Find all cities within radius
  const nearbyCities = citiesData
    .filter(city => {
      // Skip the source city itself
      if (city.name === sourceCity.name && city.state === sourceCity.state) {
        return false;
      }

      // Calculate distance
      const distance = calculateDistance(
        sourceCity.lat,
        sourceCity.lng,
        city.lat,
        city.lng
      );

      return distance <= radiusMiles;
    })
    .map(city => ({
      name: city.name,
      state: city.state,
      distance: calculateDistance(
        sourceCity.lat,
        sourceCity.lng,
        city.lat,
        city.lng
      )
    }))
    .sort((a, b) => a.distance - b.distance);

  return nearbyCities;
}

module.exports = {
  findCitiesWithinRadius
};