/**
 * Clean Property Addresses Script
 *
 * Removes city, state, and zip from the address field when they're duplicated
 * Example: "1512 W Fairmont Dr, Tempe, Az 85282" -> "1512 W Fairmont Dr"
 *
 * Usage: node scripts/clean-property-addresses.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin SDK
const projectId = process.env.FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

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

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

/**
 * Clean address by removing city, state, zip if present
 */
function cleanAddress(address, city, state, zipCode) {
  if (!address || !city) {
    return address;
  }

  let cleaned = address.trim();

  // Build patterns to remove
  const patterns = [];

  // Pattern 1: ", City, State Zip" (most common)
  if (city && state && zipCode) {
    patterns.push(new RegExp(`,\\s*${escapeRegex(city)}\\s*,\\s*${escapeRegex(state)}\\s+${escapeRegex(zipCode)}\\s*$`, 'i'));
  }

  // Pattern 2: ", City, State"
  if (city && state) {
    patterns.push(new RegExp(`,\\s*${escapeRegex(city)}\\s*,\\s*${escapeRegex(state)}\\s*$`, 'i'));
  }

  // Pattern 3: ", City Zip"
  if (city && zipCode) {
    patterns.push(new RegExp(`,\\s*${escapeRegex(city)}\\s+${escapeRegex(zipCode)}\\s*$`, 'i'));
  }

  // Pattern 4: ", City"
  if (city) {
    patterns.push(new RegExp(`,\\s*${escapeRegex(city)}\\s*$`, 'i'));
  }

  // Apply patterns
  for (const pattern of patterns) {
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, '').trim();
      break; // Only apply the first matching pattern
    }
  }

  return cleaned;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str) {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Main execution
 */
async function main() {
  console.log('🏠 Property Address Cleanup Script');
  console.log('=====================================\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Fetch all properties
    const propertiesRef = db.collection('properties');
    const snapshot = await propertiesRef.get();

    console.log(`📊 Total properties: ${snapshot.size}\n`);

    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const updates = [];

    for (const doc of snapshot.docs) {
      processedCount++;
      const property = doc.data();
      const { address, city, state, zipCode } = property;

      if (!address) {
        continue;
      }

      // Clean the address
      const cleanedAddress = cleanAddress(address, city, state, zipCode);

      // Check if address was changed
      if (cleanedAddress !== address) {
        updatedCount++;

        console.log(`\n✏️  Property ${processedCount}/${snapshot.size}:`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   Before: "${address}"`);
        console.log(`   After:  "${cleanedAddress}"`);
        console.log(`   City: ${city}, State: ${state}, Zip: ${zipCode}`);

        if (!isDryRun) {
          updates.push({
            id: doc.id,
            address: cleanedAddress
          });
        }
      }
    }

    // Perform batch updates if not dry run
    if (!isDryRun && updates.length > 0) {
      console.log(`\n\n📝 Updating ${updates.length} properties...\n`);

      for (const update of updates) {
        try {
          await propertiesRef.doc(update.id).update({
            address: update.address,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`✅ Updated: ${update.id}`);
        } catch (error) {
          console.error(`❌ Error updating ${update.id}:`, error.message);
          errorCount++;
        }
      }
    }

    // Summary
    console.log('\n\n=====================================');
    console.log('📊 SUMMARY');
    console.log('=====================================');
    console.log(`Total properties processed: ${processedCount}`);
    console.log(`Properties needing cleanup: ${updatedCount}`);
    console.log(`Properties updated: ${isDryRun ? 0 : updates.length - errorCount}`);
    console.log(`Errors: ${errorCount}`);

    if (isDryRun && updatedCount > 0) {
      console.log('\n💡 Run without --dry-run to apply changes');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
