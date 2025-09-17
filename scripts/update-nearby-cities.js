// Script to check and update nearby cities for all properties
// Using the comprehensive cities library we already have

const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Import the comprehensive cities data helper
const { findCitiesWithinRadius } = require('./nearby-cities-helper');

async function updatePropertiesWithNearbyCities() {
  try {
    console.log('Starting nearby cities update for properties missing cities or with < 5 cities...');

    // Get all properties
    const propertiesSnapshot = await db.collection('properties').get();
    const totalProperties = propertiesSnapshot.size;

    console.log(`Found ${totalProperties} total properties`);

    let processedCount = 0;
    let updatedCount = 0;
    let alreadyHasSufficientCities = 0;
    let errorCount = 0;

    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;
    const MIN_NEARBY_CITIES = 5; // Minimum number of nearby cities required

    for (const doc of propertiesSnapshot.docs) {
      const property = doc.data();
      processedCount++;

      // Check if property already has sufficient nearby cities (>= 5)
      if (property.nearbyCities && Array.isArray(property.nearbyCities) && property.nearbyCities.length >= MIN_NEARBY_CITIES) {
        alreadyHasSufficientCities++;
        console.log(`[${processedCount}/${totalProperties}] Property ${property.address} already has ${property.nearbyCities.length} nearby cities (sufficient)`);
        continue;
      }

      // Property needs update if it has no cities or less than 5
      const currentCityCount = property.nearbyCities?.length || 0;
      console.log(`[${processedCount}/${totalProperties}] Property ${property.address} has ${currentCityCount} cities (updating...)`);

      // Find nearby cities within 30 miles
      try {
        const nearbyCities = await findCitiesWithinRadius(
          property.city,
          property.state,
          30 // 30 mile radius
        );

        if (nearbyCities && nearbyCities.length > 0) {
          // Update the property with nearby cities
          batch.update(doc.ref, {
            nearbyCities: nearbyCities.map(city => city.name),
            nearbyCitiesSource: 'comprehensive-database',
            nearbyCitiesUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          batchCount++;
          updatedCount++;

          console.log(`[${processedCount}/${totalProperties}] Updated ${property.address} with ${nearbyCities.length} nearby cities`);

          // Commit batch when it reaches the limit
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`Committed batch of ${batchCount} updates`);
            batchCount = 0;
          }
        } else {
          console.log(`[${processedCount}/${totalProperties}] No nearby cities found for ${property.address}`);
        }
      } catch (error) {
        console.error(`Error finding nearby cities for ${property.address}:`, error.message);
        errorCount++;
      }

      // Add a small delay to avoid rate limiting
      if (processedCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${batchCount} updates`);
    }

    console.log('\n=== Summary ===');
    console.log(`Total properties: ${totalProperties}`);
    console.log(`Properties with sufficient nearby cities (>= 5): ${alreadyHasSufficientCities}`);
    console.log(`Properties updated: ${updatedCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log(`Properties still needing attention: ${totalProperties - alreadyHasSufficientCities - updatedCount - errorCount}`);

    // Get updated statistics
    console.log('\n=== Verification ===');
    const verifySnapshot = await db.collection('properties')
      .where('nearbyCities', '!=', null)
      .get();

    console.log(`Properties with nearby cities after update: ${verifySnapshot.size}`);

    // Sample some properties to show their nearby cities
    console.log('\n=== Sample Properties with Nearby Cities ===');
    let sampleCount = 0;
    for (const doc of verifySnapshot.docs) {
      if (sampleCount >= 5) break;
      const prop = doc.data();
      console.log(`${prop.address}, ${prop.city}, ${prop.state}: ${prop.nearbyCities?.length || 0} nearby cities`);
      if (prop.nearbyCities && prop.nearbyCities.length > 0) {
        console.log(`  Cities: ${prop.nearbyCities.slice(0, 5).join(', ')}${prop.nearbyCities.length > 5 ? '...' : ''}`);
      }
      sampleCount++;
    }

  } catch (error) {
    console.error('Error updating properties with nearby cities:', error);
  } finally {
    // Clean up
    await admin.app().delete();
  }
}

// Run the update
updatePropertiesWithNearbyCities();