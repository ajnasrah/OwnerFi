import { config } from 'dotenv';
import { getAdminDb } from '../src/lib/firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { getCitiesWithinRadiusComprehensive, getCitiesWithinRadiusByCoordinates } from '../src/lib/comprehensive-cities';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function populateMissingNearbyCities() {
  try {
    const db = await getAdminDb() as Firestore | null;

    if (!db) {
      console.error('❌ Failed to initialize Firebase Admin SDK');
      console.error('Make sure FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL are set');
      process.exit(1);
    }

    console.log('🔍 Finding properties with missing nearby_cities...\n');

    // Get all properties with empty or missing nearby_cities
    const propertiesSnapshot = await db.collection('properties').get();

    const missingProperties: Array<{
      id: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      latitude?: number;
      longitude?: number;
    }> = [];

    propertiesSnapshot.forEach((doc) => {
      const data = doc.data();
      const nearbyCities = data.nearbyCities;

      // Check if nearby_cities is missing, null, or empty
      if (!nearbyCities ||
          (Array.isArray(nearbyCities) && nearbyCities.length === 0)) {
        missingProperties.push({
          id: doc.id,
          address: data.address || 'N/A',
          city: data.city,
          state: data.state,
          zipCode: data.zipCode || 'N/A',
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
    const failedProperties: Array<{property: typeof missingProperties[0], error: string}> = [];

    // Process each property
    for (let i = 0; i < missingProperties.length; i++) {
      const property = missingProperties[i];
      const progress = `[${i + 1}/${missingProperties.length}]`;

      try {
        console.log(`${progress} Processing: ${property.address}, ${property.city}, ${property.state}`);

        // Try to get nearby cities using city name first
        let nearbyCities = getCitiesWithinRadiusComprehensive(
          property.city,
          property.state,
          30 // 30 mile radius
        );

        // If no cities found by name and we have coordinates, try using coordinates
        if (nearbyCities.length === 0 && property.latitude && property.longitude) {
          console.log(`   ℹ️  City not in database, using coordinates...`);
          nearbyCities = getCitiesWithinRadiusByCoordinates(
            property.latitude,
            property.longitude,
            property.state,
            30 // 30 mile radius
          );
        }

        if (nearbyCities.length === 0) {
          console.log(`   ⚠️  No nearby cities found (no coordinates or no cities in state)`);
          failedCount++;
          failedProperties.push({
            property,
            error: 'No nearby cities found - no coordinates or no cities in database for this state'
          });
          continue;
        }

        // Format nearby cities for storage (simple array of city names)
        const cityNames = nearbyCities.map(city => ({
          name: city.name,
          state: city.state,
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

        // Rate limiting to avoid overloading Firestore
        if (i < missingProperties.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
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
populateMissingNearbyCities();
