import { config } from 'dotenv';
import { getAdminDb } from '../src/lib/firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { getCitiesWithinRadiusByCoordinates } from '../src/lib/comprehensive-cities';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Google Geocoding API
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Get coordinates for an address using Google Geocoding API
 */
async function getCoordinatesForAddress(address: string, city: string, state: string, zipCode: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('Google Maps API key not found');
    return null;
  }

  const fullAddress = `${address}, ${city}, ${state} ${zipCode}`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }

    console.error(`Geocoding failed for ${fullAddress}: ${data.status}`);
    return null;
  } catch (error) {
    console.error(`Error geocoding ${fullAddress}:`, error);
    return null;
  }
}

async function populateMissingNearbyCitiesWithGeocoding() {
  try {
    const db = await getAdminDb() as Firestore | null;

    if (!db) {
      console.error('❌ Failed to initialize Firebase Admin SDK');
      process.exit(1);
    }

    console.log('🔍 Finding properties with missing nearby_cities...\n');

    // Get all properties with empty or missing nearby_cities
    const propertiesSnapshot = await db.collection('properties').get();

    const missingProperties: Property[] = [];

    propertiesSnapshot.forEach((doc) => {
      const data = doc.data();
      const nearbyCities = data.nearbyCities;

      if (!nearbyCities || (Array.isArray(nearbyCities) && nearbyCities.length === 0)) {
        missingProperties.push({
          id: doc.id,
          address: data.address || 'N/A',
          city: data.city,
          state: data.state,
          zipCode: data.zipCode || '',
          latitude: data.latitude,
          longitude: data.longitude
        });
      }
    });

    if (missingProperties.length === 0) {
      console.log('✅ All properties have nearby_cities populated!');
      process.exit(0);
    }

    console.log(`Found ${missingProperties.length} properties missing nearby_cities\n`);
    console.log('═══════════════════════════════════════════════════');
    console.log('         POPULATING NEARBY CITIES');
    console.log('═══════════════════════════════════════════════════\n');

    let successCount = 0;
    let failedCount = 0;
    const failedProperties: Array<{ property: Property; error: string }> = [];

    // Process each property
    for (let i = 0; i < missingProperties.length; i++) {
      const property = missingProperties[i];
      const progress = `[${i + 1}/${missingProperties.length}]`;

      try {
        console.log(`${progress} Processing: ${property.address}, ${property.city}, ${property.state}`);

        let lat = property.latitude;
        let lng = property.longitude;

        // If no coordinates, geocode the address
        if (!lat || !lng) {
          console.log(`   ℹ️  No coordinates, geocoding address...`);
          const coords = await getCoordinatesForAddress(
            property.address,
            property.city,
            property.state,
            property.zipCode
          );

          if (!coords) {
            failedCount++;
            failedProperties.push({
              property,
              error: 'Failed to geocode address'
            });
            continue;
          }

          lat = coords.lat;
          lng = coords.lng;
          console.log(`   ✓ Got coordinates: ${lat}, ${lng}`);

          // Update property with coordinates
          await db.collection('properties').doc(property.id).update({
            latitude: lat,
            longitude: lng
          });
        }

        // Get nearby cities using comprehensive database (cities.json)
        console.log(`   ℹ️  Finding nearby cities using cities.json database...`);
        const nearbyCities = getCitiesWithinRadiusByCoordinates(lat, lng, property.state, 30);

        if (nearbyCities.length === 0) {
          console.log(`   ⚠️  No nearby cities found in ${property.state}`);
          failedCount++;
          failedProperties.push({
            property,
            error: `No nearby cities found in ${property.state} within 30 miles`
          });
          continue;
        }

        // Format nearby cities for storage
        const cityNames = nearbyCities.map(city => ({
          name: city.city,
          state: city.stateCode,
          distance: Math.round(city.distance * 10) / 10
        }));

        // Update the property document
        await db.collection('properties').doc(property.id).update({
          nearbyCities: cityNames,
          nearbyCitiesSource: 'comprehensive-database',
          nearbyCitiesUpdatedAt: new Date().toISOString()
        });

        console.log(`   ✅ Added ${nearbyCities.length} nearby cities`);
        successCount++;

        // Rate limiting for Google API (1 request per second)
        if (i < missingProperties.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1100));
        }

      } catch (error) {
        console.log(`   ❌ Failed: ${(error as Error).message}`);
        failedCount++;
        failedProperties.push({
          property,
          error: (error as Error).message
        });
      }
    }

    // Print summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('                   SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Total properties processed:  ${missingProperties.length}`);
    console.log(`✅ Successfully updated:     ${successCount}`);
    console.log(`❌ Failed:                   ${failedCount}`);
    console.log('═══════════════════════════════════════════════════\n');

    if (failedProperties.length > 0) {
      console.log('❌ Failed Properties:');
      console.log('───────────────────────────────────────────────────\n');
      failedProperties.forEach(({ property, error }) => {
        console.log(`• ${property.address}, ${property.city}, ${property.state}`);
        console.log(`  ID: ${property.id}`);
        console.log(`  Error: ${error}\n`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
populateMissingNearbyCitiesWithGeocoding();
