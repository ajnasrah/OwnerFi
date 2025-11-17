import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

/**
 * Parse street address from full address (remove city/state/zip)
 */
function parseStreetAddress(addr: string, city?: string): string {
  if (!addr) return '';

  // If we have city, split at the city
  if (city && addr.toLowerCase().includes(city.toLowerCase())) {
    const parts = addr.split(',');
    return parts[0].trim();
  }

  // Otherwise, take everything before the first comma
  const parts = addr.split(',');
  return parts[0].trim();
}

async function fixAllPropertyAddresses() {
  console.log('\n🔧 Fixing All Property Addresses in Database\n');
  console.log('='.repeat(80));

  try {

    // Get all properties from zillow_imports
    console.log('\n📥 Fetching all properties from zillow_imports...');
    const snapshot = await db.collection('zillow_imports').get();
    console.log(`📊 Found ${snapshot.size} properties to process\n`);

    let processedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process in batches of 500
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      processedCount++;

      try {
        const city = data.city || '';
        const state = data.state || '';
        const zipCode = data.zipCode || '';

        let needsUpdate = false;
        const updates: any = {};

        // Fix streetAddress if it contains city/state/zip
        let streetAddress = data.streetAddress || data.address || '';
        const fullAddress = data.fullAddress || '';

        // If streetAddress contains commas or the city name, it's likely a full address
        if (streetAddress && (streetAddress.includes(',') ||
            (city && streetAddress.toLowerCase().includes(city.toLowerCase())))) {
          const cleanStreet = parseStreetAddress(streetAddress, city);
          if (cleanStreet !== streetAddress) {
            updates.streetAddress = cleanStreet;
            streetAddress = cleanStreet;
            needsUpdate = true;
          }
        }

        // If streetAddress is empty but we have fullAddress, extract it
        if (!streetAddress && fullAddress) {
          const cleanStreet = parseStreetAddress(fullAddress, city);
          updates.streetAddress = cleanStreet;
          streetAddress = cleanStreet;
          needsUpdate = true;
        }

        // Reconstruct fullAddress if it's incomplete or missing
        if (streetAddress && city && state && zipCode) {
          const expectedFullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`.trim();

          // Update fullAddress if it's missing or doesn't match expected format
          if (!fullAddress || fullAddress !== expectedFullAddress) {
            updates.fullAddress = expectedFullAddress;
            needsUpdate = true;
          }
        }

        // Apply updates if needed
        if (needsUpdate) {
          batch.update(doc.ref, updates);
          batchCount++;
          updatedCount++;

          // Log first 10 updates as samples
          if (updatedCount <= 10) {
            console.log(`\n📝 Sample Update #${updatedCount}:`);
            console.log(`   ID: ${doc.id}`);
            console.log(`   Before:`);
            console.log(`     streetAddress: "${data.streetAddress || 'N/A'}"`);
            console.log(`     fullAddress: "${data.fullAddress || 'N/A'}"`);
            console.log(`   After:`);
            if (updates.streetAddress) console.log(`     streetAddress: "${updates.streetAddress}"`);
            if (updates.fullAddress) console.log(`     fullAddress: "${updates.fullAddress}"`);
          }

          // Commit batch when it reaches limit
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`\n💾 Committed batch of ${batchCount} updates (${updatedCount} total so far)`);
            batch = db.batch();
            batchCount = 0;
          }
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing property ${doc.id}:`, error);
        errorCount++;
      }

      // Progress indicator
      if (processedCount % 100 === 0) {
        console.log(`\n⏳ Progress: ${processedCount}/${snapshot.size} processed (${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors)`);
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\n💾 Committed final batch of ${batchCount} updates`);
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 FIX SUMMARY:\n');
    console.log(`Total Properties:       ${snapshot.size}`);
    console.log(`Properties Updated:     ${updatedCount}`);
    console.log(`Properties Skipped:     ${skippedCount}`);
    console.log(`Errors:                 ${errorCount}`);
    console.log(`Success Rate:           ${((updatedCount / snapshot.size) * 100).toFixed(1)}%`);
    console.log('\n' + '='.repeat(80));

    // Verify results
    console.log('\n✅ Verifying results...\n');
    const verifySnapshot = await db.collection('zillow_imports').limit(10).get();

    verifySnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n━━━ Property ${index + 1} ━━━`);
      console.log(`streetAddress:  "${data.streetAddress || 'N/A'}"`);
      console.log(`fullAddress:    "${data.fullAddress || 'N/A'}"`);
      console.log(`city:           "${data.city || 'N/A'}"`);
      console.log(`state:          "${data.state || 'N/A'}"`);
      console.log(`zipCode:        "${data.zipCode || 'N/A'}"`);

      // Check for issues
      const hasFullInStreet = data.streetAddress && data.city &&
        data.streetAddress.toLowerCase().includes(data.city.toLowerCase());

      if (hasFullInStreet) {
        console.log('⚠️  WARNING: streetAddress still contains city');
      } else if (data.streetAddress && !data.streetAddress.includes(',')) {
        console.log('✅ Address looks clean');
      } else if (data.streetAddress && data.streetAddress.includes(',')) {
        console.log('⚠️  WARNING: streetAddress contains comma');
      }
    });

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixAllPropertyAddresses()
  .then(() => {
    console.log('\n✅ All property addresses fixed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });
