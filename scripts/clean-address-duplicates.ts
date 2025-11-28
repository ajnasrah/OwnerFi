import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

/**
 * Extract just the street address from a full address string
 * Only cleans if city/state/zip are actually duplicated
 * "8670 Tanoak Dr, Germantown, TN 38138" -> "8670 Tanoak Dr"
 * "759 Ocean Shores Boulevard NW #D" -> unchanged (no city/state)
 */
function extractStreetAddress(address: string, city?: string, state?: string, zipCode?: string): string | null {
  if (!address) return null;

  const addressLower = address.toLowerCase();
  const cityLower = (city || '').toLowerCase();
  const stateLower = (state || '').toLowerCase();

  // Check if address actually contains city or state (indicating duplication)
  const hasCity = cityLower && cityLower.length > 2 && addressLower.includes(cityLower);
  const hasState = stateLower && stateLower.length >= 2 && (
    addressLower.includes(`, ${stateLower}`) ||
    addressLower.includes(` ${stateLower} `) ||
    addressLower.endsWith(` ${stateLower}`)
  );
  const hasZip = zipCode && address.includes(zipCode);

  // Only clean if we detect city/state/zip duplication
  if (!hasCity && !hasState && !hasZip) {
    return null; // No cleanup needed
  }

  // Split by comma and take the first part (street address)
  const parts = address.split(',');
  const streetPart = parts[0]?.trim();

  // Validate we got something reasonable (at least a number + word)
  if (!streetPart || streetPart.length < 5 || !/\d/.test(streetPart)) {
    return null; // Skip if result looks wrong
  }

  // Make sure we're not returning the same thing
  if (streetPart === address) {
    return null;
  }

  return streetPart;
}

async function cleanAddresses() {
  console.log('🧹 Starting address cleanup...\n');
  console.log('Only cleaning addresses where city/state/zip are duplicated in street address field\n');

  // Process zillow_imports collection
  console.log('📦 Processing zillow_imports collection...');
  const zillowDocs = await db.collection('zillow_imports').get();
  console.log(`Found ${zillowDocs.size} documents\n`);

  let zillowUpdated = 0;
  let zillowSkipped = 0;
  let batch: WriteBatch = db.batch();
  let batchCount = 0;

  for (const docSnapshot of zillowDocs.docs) {
    const data = docSnapshot.data();
    const address = data.streetAddress || data.address || '';
    const city = data.city || '';
    const state = data.state || '';
    const zipCode = data.zipCode || data.zipcode || '';

    const cleanStreet = extractStreetAddress(address, city, state, zipCode);

    if (cleanStreet) {
      batch.update(docSnapshot.ref, {
        streetAddress: cleanStreet,
        address: cleanStreet,
      });
      batchCount++;
      zillowUpdated++;

      if (zillowUpdated <= 20) {
        console.log(`  ✏️  "${address}"`);
        console.log(`      -> "${cleanStreet}"`);
      }

      // Commit batch every 400 operations
      if (batchCount >= 400) {
        await batch.commit();
        console.log(`  💾 Committed batch of ${batchCount} updates`);
        batch = db.batch();
        batchCount = 0;
      }
    } else {
      zillowSkipped++;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`  💾 Committed final batch of ${batchCount} updates`);
  }

  console.log(`\n✅ zillow_imports: ${zillowUpdated} updated, ${zillowSkipped} skipped\n`);

  // Process properties collection
  console.log('📦 Processing properties collection...');
  const propertiesDocs = await db.collection('properties').get();
  console.log(`Found ${propertiesDocs.size} documents\n`);

  let propertiesUpdated = 0;
  let propertiesSkipped = 0;
  batch = db.batch();
  batchCount = 0;

  for (const docSnapshot of propertiesDocs.docs) {
    const data = docSnapshot.data();
    const address = data.streetAddress || data.address || '';
    const city = data.city || '';
    const state = data.state || '';
    const zipCode = data.zipCode || data.zipcode || '';

    const cleanStreet = extractStreetAddress(address, city, state, zipCode);

    if (cleanStreet) {
      batch.update(docSnapshot.ref, {
        streetAddress: cleanStreet,
        address: cleanStreet,
      });
      batchCount++;
      propertiesUpdated++;

      if (propertiesUpdated <= 20) {
        console.log(`  ✏️  "${address}"`);
        console.log(`      -> "${cleanStreet}"`);
      }

      if (batchCount >= 400) {
        await batch.commit();
        console.log(`  💾 Committed batch of ${batchCount} updates`);
        batch = db.batch();
        batchCount = 0;
      }
    } else {
      propertiesSkipped++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  💾 Committed final batch of ${batchCount} updates`);
  }

  console.log(`\n✅ properties: ${propertiesUpdated} updated, ${propertiesSkipped} skipped`);

  console.log('\n🎉 Address cleanup complete!');
  console.log(`Total updated: ${zillowUpdated + propertiesUpdated}`);
}

cleanAddresses().catch(console.error);
