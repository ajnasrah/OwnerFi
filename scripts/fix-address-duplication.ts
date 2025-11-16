import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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
 * Helper function to parse street address (remove city/state/zip)
 */
function parseStreetAddress(fullAddr: string, city?: string): string {
  if (!fullAddr) return '';

  // If we have city, split at the city
  if (city && fullAddr.toLowerCase().includes(city.toLowerCase())) {
    const parts = fullAddr.split(',');
    return parts[0].trim();
  }

  // Otherwise, take everything before the first comma
  const parts = fullAddr.split(',');
  return parts[0].trim();
}

/**
 * Clean and fix address fields for a property
 */
function cleanAddressFields(data: any): { updates: any; needsUpdate: boolean } {
  const updates: any = {};
  let needsUpdate = false;

  const city = data.city || '';
  const state = data.state || '';
  const zipCode = data.zipCode || '';

  // 1. Fix streetAddress if it contains city/state/zip
  let streetAddress = data.streetAddress || '';

  // If streetAddress contains city, extract just the street part
  if (streetAddress && city && streetAddress.toLowerCase().includes(city.toLowerCase())) {
    const cleanStreet = parseStreetAddress(streetAddress, city);
    if (cleanStreet !== streetAddress) {
      updates.streetAddress = cleanStreet;
      streetAddress = cleanStreet;
      needsUpdate = true;
    }
  } else if (streetAddress && streetAddress.includes(',')) {
    // If it has commas, likely has city/state/zip
    const cleanStreet = parseStreetAddress(streetAddress, city);
    if (cleanStreet !== streetAddress) {
      updates.streetAddress = cleanStreet;
      streetAddress = cleanStreet;
      needsUpdate = true;
    }
  }

  // 2. Remove redundant 'address' field if it exists
  if (data.address !== undefined) {
    updates.address = FieldValue.delete();
    needsUpdate = true;
  }

  // 3. Reconstruct fullAddress from components if incomplete
  const currentFullAddress = data.fullAddress || '';
  const expectedFullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`.trim();

  // Check if fullAddress is missing city/state/zip
  if (city && state && zipCode) {
    if (!currentFullAddress.toLowerCase().includes(city.toLowerCase()) ||
        !currentFullAddress.includes(state) ||
        !currentFullAddress.includes(zipCode)) {
      updates.fullAddress = expectedFullAddress;
      needsUpdate = true;
    }
  } else if (!currentFullAddress && streetAddress) {
    // If no fullAddress but we have streetAddress, construct it
    updates.fullAddress = expectedFullAddress;
    needsUpdate = true;
  }

  return { updates, needsUpdate };
}

async function fixAddressDuplication() {
  console.log('\n🔧 Fixing Address Duplication in Database\n');
  console.log('='.repeat(80));

  try {
    // Get all properties
    console.log('\n📥 Fetching all properties...');
    const snapshot = await db.collection('zillow_imports').get();

    console.log(`📊 Found ${snapshot.size} properties to process\n`);

    let processedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const issues: string[] = [];

    // Process in batches of 500 (Firestore limit)
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      processedCount++;

      // Clean address fields
      const { updates, needsUpdate } = cleanAddressFields(data);

      if (needsUpdate) {
        batch.update(doc.ref, updates);
        batchCount++;
        updatedCount++;

        // Log first 5 updates as samples
        if (updatedCount <= 5) {
          console.log(`\n📝 Sample Update #${updatedCount}:`);
          console.log(`   ID: ${doc.id}`);
          console.log(`   Before:`);
          console.log(`     streetAddress: "${data.streetAddress || 'N/A'}"`);
          console.log(`     address: "${data.address || 'N/A'}"`);
          console.log(`     fullAddress: "${data.fullAddress || 'N/A'}"`);
          console.log(`   After:`);
          if (updates.streetAddress) console.log(`     streetAddress: "${updates.streetAddress}"`);
          if (updates.address) console.log(`     address: DELETED`);
          if (updates.fullAddress) console.log(`     fullAddress: "${updates.fullAddress}"`);
        }

        // Commit batch when it reaches 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`\n💾 Committed batch of ${batchCount} updates (${updatedCount} total so far)`);
          batch = db.batch();
          batchCount = 0;
        }
      } else {
        skippedCount++;
      }

      // Progress indicator
      if (processedCount % 100 === 0) {
        console.log(`\n⏳ Progress: ${processedCount}/${snapshot.size} processed (${updatedCount} updated, ${skippedCount} skipped)`);
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\n💾 Committed final batch of ${batchCount} updates`);
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 MIGRATION SUMMARY:\n');
    console.log(`Total Properties:       ${snapshot.size}`);
    console.log(`Properties Updated:     ${updatedCount}`);
    console.log(`Properties Skipped:     ${skippedCount}`);
    console.log(`Success Rate:           ${((updatedCount / snapshot.size) * 100).toFixed(1)}%`);

    if (issues.length > 0) {
      console.log(`\n⚠️  Issues Found: ${issues.length}`);
      issues.slice(0, 10).forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
      if (issues.length > 10) {
        console.log(`   ... and ${issues.length - 10} more`);
      }
    }

    console.log('\n' + '='.repeat(80));

    // Verify results
    console.log('\n✅ Verifying migration results...\n');

    const verifySnapshot = await db.collection('zillow_imports').limit(10).get();

    verifySnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n━━━ Property ${index + 1} (After Migration) ━━━`);
      console.log(`streetAddress:  "${data.streetAddress || 'N/A'}"`);
      console.log(`fullAddress:    "${data.fullAddress || 'N/A'}"`);
      console.log(`address:        "${data.address || 'DELETED ✓'}"`);
      console.log(`city:           "${data.city || 'N/A'}"`);
      console.log(`state:          "${data.state || 'N/A'}"`);
      console.log(`zipCode:        "${data.zipCode || 'N/A'}"`);

      // Check for issues
      const hasFullInStreet = data.streetAddress && data.city &&
        data.streetAddress.toLowerCase().includes(data.city.toLowerCase());

      if (hasFullInStreet) {
        console.log('⚠️  WARNING: streetAddress still contains city');
      } else {
        console.log('✅ Address fields look clean');
      }
    });

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixAddressDuplication()
  .then(() => {
    console.log('\n✅ Address duplication fix complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
