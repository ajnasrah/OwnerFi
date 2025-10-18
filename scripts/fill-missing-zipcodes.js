const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin SDK
const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      privateKey: privateKey.replace(/\\n/g, '\n'),
      clientEmail,
    })
  });
}

const db = admin.firestore();

/**
 * Use Google Maps Geocoding API to get zip code from address
 */
async function getZipCodeFromAddress(address, city, state) {
  if (!googleMapsApiKey) {
    console.error('❌ Google Maps API key not configured');
    return null;
  }

  try {
    // Build full address string (handle empty city or state)
    let fullAddress = address;
    if (city && city.trim()) {
      fullAddress += `, ${city}`;
    }
    if (state && state.trim()) {
      fullAddress += `, ${state}`;
    }
    const encodedAddress = encodeURIComponent(fullAddress.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${googleMapsApiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.log(`   ⚠️  Google Maps could not parse address: ${data.status}`);
      return null;
    }

    const result = data.results[0];
    const components = result.address_components;

    // Extract zip code
    let zipCode = null;
    for (const component of components) {
      if (component.types.includes('postal_code')) {
        zipCode = component.long_name;
        break;
      }
    }

    return zipCode;
  } catch (error) {
    console.error(`   ❌ Error geocoding address: ${error.message}`);
    return null;
  }
}

/**
 * Fill missing zip codes for all properties
 */
async function fillMissingZipCodes() {
  console.log('========================================');
  console.log('FILL MISSING ZIP CODES');
  console.log('========================================\n');

  if (!googleMapsApiKey) {
    console.error('❌ GOOGLE_MAPS_API_KEY not found in environment variables');
    console.log('Please add GOOGLE_MAPS_API_KEY to your .env.local file');
    process.exit(1);
  }

  try {
    // Get all properties
    console.log('Fetching properties from database...');
    const snapshot = await db.collection('properties').get();
    console.log(`Found ${snapshot.size} total properties\n`);

    // Find properties missing zip codes
    const propertiesNeedingZipCode = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const zipCode = data.zipCode || '';

      // Check if zip code is missing or empty
      if (!zipCode || zipCode.trim() === '') {
        propertiesNeedingZipCode.push({
          id: doc.id,
          address: data.address || '',
          city: data.city || '',
          state: data.state || ''
        });
      }
    });

    console.log(`Found ${propertiesNeedingZipCode.length} properties missing zip codes\n`);

    if (propertiesNeedingZipCode.length === 0) {
      console.log('✅ All properties already have zip codes!');
      return;
    }

    // Process each property
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    console.log('Starting to fill missing zip codes...\n');

    for (let i = 0; i < propertiesNeedingZipCode.length; i++) {
      const property = propertiesNeedingZipCode[i];
      const progress = `[${i + 1}/${propertiesNeedingZipCode.length}]`;

      console.log(`${progress} Processing property: ${property.id}`);
      console.log(`   Address: ${property.address}`);
      console.log(`   City: ${property.city}`);
      console.log(`   State: ${property.state || '(empty)'}`);

      // Skip if missing address (city and state are optional - we can try geocoding without them)
      if (!property.address) {
        console.log(`   ⏭️  Skipping - missing address\n`);
        skippedCount++;
        continue;
      }

      // Get zip code from Google Maps (state is optional)
      const zipCode = await getZipCodeFromAddress(
        property.address,
        property.city,
        property.state || ''
      );

      if (zipCode) {
        // Update property in database
        try {
          await db.collection('properties').doc(property.id).update({
            zipCode: zipCode,
            lastUpdated: new Date().toISOString()
          });
          console.log(`   ✅ Successfully updated zip code: ${zipCode}\n`);
          successCount++;
        } catch (updateError) {
          console.log(`   ❌ Failed to update database: ${updateError.message}\n`);
          failureCount++;
        }
      } else {
        console.log(`   ❌ Could not find zip code\n`);
        failureCount++;
      }

      // Rate limiting - wait 100ms between requests to avoid hitting API limits
      if (i < propertiesNeedingZipCode.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Print summary
    console.log('========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`Total properties processed: ${propertiesNeedingZipCode.length}`);
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`❌ Failed to update: ${failureCount}`);
    console.log(`⏭️  Skipped (missing data): ${skippedCount}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error filling zip codes:', error);
    process.exit(1);
  }
}

// Run the script
fillMissingZipCodes()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
