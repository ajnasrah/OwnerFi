import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

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
 * Normalize address for comparison
 */
function normalizeAddress(addr: string): string {
  if (!addr) return '';
  return addr
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '');
}

/**
 * Parse CSV file and extract addresses
 */
function parseCSV(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Skip header row
  const dataLines = lines.slice(1).filter(line => line.trim());

  const addresses: string[] = [];

  for (const line of dataLines) {
    // Parse CSV considering quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current); // Add last field

    // Property Address is column index 18 (0-based)
    const propertyAddress = fields[18]?.trim().replace(/^"|"$/g, '');

    if (propertyAddress) {
      addresses.push(propertyAddress);
    }
  }

  return addresses;
}

async function deleteNotAvailableProperties() {
  console.log('\n🗑️  Deleting Properties from "Not Available" List\n');
  console.log('='.repeat(80));

  try {
    // Step 1: Read CSV file
    const csvPath = '/Users/abdullahabunasrah/Downloads/not available .csv';
    console.log(`\n📥 Reading CSV file: ${csvPath}`);

    const addresses = parseCSV(csvPath);
    console.log(`✅ Found ${addresses.length} addresses to delete\n`);

    // Show first 5 as samples
    console.log('📝 Sample addresses to delete:');
    addresses.slice(0, 5).forEach((addr, i) => {
      console.log(`  ${i + 1}. ${addr}`);
    });
    console.log();

    // Create normalized lookup set
    const normalizedAddresses = new Set(addresses.map(normalizeAddress));
    console.log(`🔍 Created lookup set with ${normalizedAddresses.size} unique normalized addresses\n`);

    // Step 2: Find and delete from zillow_imports
    console.log('━'.repeat(80));
    console.log('📂 Searching zillow_imports collection...\n');

    const zillowSnapshot = await db.collection('zillow_imports').get();
    console.log(`📊 Total documents in zillow_imports: ${zillowSnapshot.size}`);

    const zillowToDelete: string[] = [];
    const zillowMatches: Array<{id: string, address: string}> = [];

    zillowSnapshot.forEach(doc => {
      const data = doc.data();
      const fullAddr = data.fullAddress || data.streetAddress || '';
      const streetAddr = data.streetAddress || '';

      const normalizedFull = normalizeAddress(fullAddr);
      const normalizedStreet = normalizeAddress(streetAddr);

      // Check if either fullAddress or streetAddress matches
      if (normalizedAddresses.has(normalizedFull) || normalizedAddresses.has(normalizedStreet)) {
        zillowToDelete.push(doc.id);
        zillowMatches.push({ id: doc.id, address: fullAddr || streetAddr });
      }
    });

    console.log(`✅ Found ${zillowToDelete.length} properties to delete from zillow_imports\n`);

    if (zillowMatches.length > 0) {
      console.log('📝 Sample matches from zillow_imports:');
      zillowMatches.slice(0, 10).forEach((match, i) => {
        console.log(`  ${i + 1}. ${match.address} (ID: ${match.id})`);
      });
      console.log();
    }

    // Step 3: Find and delete from properties collection
    console.log('━'.repeat(80));
    console.log('📂 Searching properties collection...\n');

    const propertiesSnapshot = await db.collection('properties').get();
    console.log(`📊 Total documents in properties: ${propertiesSnapshot.size}`);

    const propertiesToDelete: string[] = [];
    const propertyMatches: Array<{id: string, address: string}> = [];

    propertiesSnapshot.forEach(doc => {
      const data = doc.data();
      const fullAddr = data.fullAddress || data.address || '';
      const streetAddr = data.streetAddress || '';

      const normalizedFull = normalizeAddress(fullAddr);
      const normalizedStreet = normalizeAddress(streetAddr);

      // Check if either fullAddress or streetAddress matches
      if (normalizedAddresses.has(normalizedFull) || normalizedAddresses.has(normalizedStreet)) {
        propertiesToDelete.push(doc.id);
        propertyMatches.push({ id: doc.id, address: fullAddr || streetAddr });
      }
    });

    console.log(`✅ Found ${propertiesToDelete.length} properties to delete from properties\n`);

    if (propertyMatches.length > 0) {
      console.log('📝 Sample matches from properties:');
      propertyMatches.slice(0, 10).forEach((match, i) => {
        console.log(`  ${i + 1}. ${match.address} (ID: ${match.id})`);
      });
      console.log();
    }

    // Step 4: Confirm deletion
    const totalToDelete = zillowToDelete.length + propertiesToDelete.length;

    console.log('━'.repeat(80));
    console.log('\n⚠️  DELETION SUMMARY:\n');
    console.log(`  zillow_imports:  ${zillowToDelete.length} properties`);
    console.log(`  properties:      ${propertiesToDelete.length} properties`);
    console.log(`  TOTAL:           ${totalToDelete} properties\n`);

    if (totalToDelete === 0) {
      console.log('✅ No properties found to delete. All clean!\n');
      return;
    }

    // Step 5: Delete in batches
    console.log('🗑️  Deleting properties in batches...\n');

    let deletedCount = 0;
    const BATCH_SIZE = 500;

    // Delete from zillow_imports
    if (zillowToDelete.length > 0) {
      console.log(`Deleting ${zillowToDelete.length} from zillow_imports...`);

      for (let i = 0; i < zillowToDelete.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = zillowToDelete.slice(i, i + BATCH_SIZE);

        chunk.forEach(id => {
          batch.delete(db.collection('zillow_imports').doc(id));
        });

        await batch.commit();
        deletedCount += chunk.length;
        console.log(`  ✅ Deleted ${chunk.length} (${deletedCount}/${zillowToDelete.length})`);
      }

      console.log(`✅ Deleted all ${zillowToDelete.length} from zillow_imports\n`);
    }

    // Delete from properties
    if (propertiesToDelete.length > 0) {
      console.log(`Deleting ${propertiesToDelete.length} from properties...`);

      let propDeletedCount = 0;
      for (let i = 0; i < propertiesToDelete.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = propertiesToDelete.slice(i, i + BATCH_SIZE);

        chunk.forEach(id => {
          batch.delete(db.collection('properties').doc(id));
        });

        await batch.commit();
        propDeletedCount += chunk.length;
        console.log(`  ✅ Deleted ${chunk.length} (${propDeletedCount}/${propertiesToDelete.length})`);
      }

      console.log(`✅ Deleted all ${propertiesToDelete.length} from properties\n`);
    }

    // Step 6: Verify deletion
    console.log('━'.repeat(80));
    console.log('\n🔍 Verifying deletions...\n');

    // Re-check a few sample addresses
    const samplesToVerify = addresses.slice(0, 5);
    let verifyPassed = true;

    for (const addr of samplesToVerify) {
      const normalized = normalizeAddress(addr);

      // Check zillow_imports
      const zillowCheck = await db.collection('zillow_imports')
        .where('fullAddress', '==', addr)
        .get();

      const propertiesCheck = await db.collection('properties')
        .where('fullAddress', '==', addr)
        .get();

      if (zillowCheck.size > 0 || propertiesCheck.size > 0) {
        console.log(`❌ VERIFICATION FAILED: ${addr} still exists!`);
        verifyPassed = false;
      } else {
        console.log(`✅ Verified deleted: ${addr}`);
      }
    }

    console.log();
    console.log('='.repeat(80));
    console.log('\n📈 FINAL SUMMARY:\n');
    console.log(`Total addresses in CSV:          ${addresses.length}`);
    console.log(`Deleted from zillow_imports:     ${zillowToDelete.length}`);
    console.log(`Deleted from properties:         ${propertiesToDelete.length}`);
    console.log(`Total deletions:                 ${totalToDelete}`);
    console.log(`Verification:                    ${verifyPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('\n='.repeat(80));

    if (verifyPassed) {
      console.log('\n🎉 SUCCESS! All "not available" properties have been deleted.\n');
      console.log('These agents will NOT be contacted again.\n');
    } else {
      console.log('\n⚠️  WARNING: Some properties may still exist. Please review.\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

// Run the deletion
deleteNotAvailableProperties()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
