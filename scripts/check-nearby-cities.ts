import { getAdminDb } from '../src/lib/firebase-admin';

async function checkNearbyCities() {
  try {
    const db = await getAdminDb();

    if (!db) {
      console.error('❌ Failed to initialize Firebase Admin SDK');
      console.error('Make sure FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL are set');
      process.exit(1);
    }

    console.log('🔍 Checking nearby_cities population status...\n');

    // Get all properties
    const propertiesSnapshot = await db.collection('properties').get();
    const total = propertiesSnapshot.size;

    if (total === 0) {
      console.log('No properties found in database');
      process.exit(0);
    }

    let populated = 0;
    let empty = 0;
    let nullCount = 0;
    let emptyArrayCount = 0;
    const missingProperties: Array<{
      id: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      nearbyCities: unknown;
    }> = [];

    propertiesSnapshot.forEach((doc) => {
      const data = doc.data();
      const nearbyCities = data.nearbyCities;

      if (nearbyCities === null || nearbyCities === undefined) {
        empty++;
        nullCount++;
        missingProperties.push({
          id: doc.id,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          nearbyCities: 'null/undefined'
        });
      } else if (Array.isArray(nearbyCities) && nearbyCities.length === 0) {
        empty++;
        emptyArrayCount++;
        missingProperties.push({
          id: doc.id,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          nearbyCities: '[]'
        });
      } else if (Array.isArray(nearbyCities) && nearbyCities.length > 0) {
        populated++;
      } else {
        empty++;
        missingProperties.push({
          id: doc.id,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          nearbyCities: typeof nearbyCities
        });
      }
    });

    // Print summary
    console.log('═══════════════════════════════════════════════════');
    console.log('         NEARBY CITIES POPULATION STATUS');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Total properties:           ${total}`);
    console.log(`With nearby_cities:         ${populated} (${((populated/total)*100).toFixed(2)}%)`);
    console.log(`Missing nearby_cities:      ${empty} (${((empty/total)*100).toFixed(2)}%)`);
    console.log(`  - null/undefined:         ${nullCount}`);
    console.log(`  - empty array:            ${emptyArrayCount}`);
    console.log(`  - invalid type:           ${empty - nullCount - emptyArrayCount}`);
    console.log('═══════════════════════════════════════════════════\n');

    // Show sample of missing properties
    if (missingProperties.length > 0) {
      console.log('🔴 Sample Properties Missing nearby_cities:');
      console.log('───────────────────────────────────────────────────\n');

      missingProperties.slice(0, 15).forEach((prop, idx) => {
        console.log(`${idx + 1}. ${prop.address}`);
        console.log(`   ${prop.city}, ${prop.state} ${prop.zipCode}`);
        console.log(`   ID: ${prop.id}`);
        console.log(`   nearbyCities: ${prop.nearbyCities}`);
        console.log('');
      });

      if (missingProperties.length > 15) {
        console.log(`... and ${missingProperties.length - 15} more properties\n`);
      }
    }

    // Show sample of populated properties
    if (populated > 0) {
      console.log('✅ Sample Properties WITH nearby_cities:');
      console.log('───────────────────────────────────────────────────\n');

      let samplesShown = 0;
      for (const doc of propertiesSnapshot.docs) {
        if (samplesShown >= 3) break;

        const data = doc.data();
        const nearbyCities = data.nearbyCities;

        if (Array.isArray(nearbyCities) && nearbyCities.length > 0) {
          console.log(`${samplesShown + 1}. ${data.address}`);
          console.log(`   ${data.city}, ${data.state} ${data.zipCode}`);
          console.log(`   ID: ${doc.id}`);
          console.log(`   nearbyCities (${nearbyCities.length}): ${nearbyCities.slice(0, 5).join(', ')}${nearbyCities.length > 5 ? '...' : ''}`);
          console.log('');
          samplesShown++;
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking nearby cities:', error);
    process.exit(1);
  }
}

checkNearbyCities();
