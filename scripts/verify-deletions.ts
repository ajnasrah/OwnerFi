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

function normalizeAddress(addr: string): string {
  if (!addr) return '';
  return addr
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '');
}

function parseCSV(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const dataLines = lines.slice(1).filter(line => line.trim());

  const addresses: string[] = [];

  for (const line of dataLines) {
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
    fields.push(current);

    const propertyAddress = fields[18]?.trim().replace(/^"|"$/g, '');
    if (propertyAddress) {
      addresses.push(propertyAddress);
    }
  }

  return addresses;
}

async function verifyDeletions() {
  console.log('\n🔍 Triple-Check Verification of Deletions\n');
  console.log('='.repeat(80));

  try {
    // Read CSV
    const csvPath = '/Users/abdullahabunasrah/Downloads/not available .csv';
    console.log(`\n📥 Reading CSV file: ${csvPath}`);

    const addresses = parseCSV(csvPath);
    console.log(`✅ Found ${addresses.length} addresses from CSV\n`);

    const normalizedAddresses = new Set(addresses.map(normalizeAddress));

    // Check zillow_imports
    console.log('━'.repeat(80));
    console.log('🔍 Checking zillow_imports collection...\n');

    const zillowSnapshot = await db.collection('zillow_imports').get();
    console.log(`📊 Current total in zillow_imports: ${zillowSnapshot.size}`);

    const stillInZillow: Array<{id: string, address: string}> = [];

    zillowSnapshot.forEach(doc => {
      const data = doc.data();
      const fullAddr = data.fullAddress || data.streetAddress || '';
      const streetAddr = data.streetAddress || '';

      const normalizedFull = normalizeAddress(fullAddr);
      const normalizedStreet = normalizeAddress(streetAddr);

      if (normalizedAddresses.has(normalizedFull) || normalizedAddresses.has(normalizedStreet)) {
        stillInZillow.push({ id: doc.id, address: fullAddr || streetAddr });
      }
    });

    console.log(`\n${stillInZillow.length === 0 ? '✅' : '❌'} Properties still in zillow_imports: ${stillInZillow.length}`);

    if (stillInZillow.length > 0) {
      console.log('\n⚠️  WARNING: Found properties that should have been deleted:\n');
      stillInZillow.slice(0, 20).forEach((prop, i) => {
        console.log(`  ${i + 1}. ${prop.address} (ID: ${prop.id})`);
      });
      if (stillInZillow.length > 20) {
        console.log(`  ... and ${stillInZillow.length - 20} more`);
      }
    }

    // Check properties collection
    console.log('\n━'.repeat(80));
    console.log('🔍 Checking properties collection...\n');

    const propertiesSnapshot = await db.collection('properties').get();
    console.log(`📊 Current total in properties: ${propertiesSnapshot.size}`);

    const stillInProperties: Array<{id: string, address: string}> = [];

    propertiesSnapshot.forEach(doc => {
      const data = doc.data();
      const fullAddr = data.fullAddress || data.address || '';
      const streetAddr = data.streetAddress || '';

      const normalizedFull = normalizeAddress(fullAddr);
      const normalizedStreet = normalizeAddress(streetAddr);

      if (normalizedAddresses.has(normalizedFull) || normalizedAddresses.has(normalizedStreet)) {
        stillInProperties.push({ id: doc.id, address: fullAddr || streetAddr });
      }
    });

    console.log(`\n${stillInProperties.length === 0 ? '✅' : '❌'} Properties still in properties: ${stillInProperties.length}`);

    if (stillInProperties.length > 0) {
      console.log('\n⚠️  WARNING: Found properties that should have been deleted:\n');
      stillInProperties.slice(0, 20).forEach((prop, i) => {
        console.log(`  ${i + 1}. ${prop.address} (ID: ${prop.id})`);
      });
      if (stillInProperties.length > 20) {
        console.log(`  ... and ${stillInProperties.length - 20} more`);
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 TRIPLE-CHECK VERIFICATION SUMMARY:\n');
    console.log(`Total addresses in CSV:                ${addresses.length}`);
    console.log(`Still in zillow_imports:               ${stillInZillow.length}`);
    console.log(`Still in properties:                   ${stillInProperties.length}`);
    console.log(`Total still present:                   ${stillInZillow.length + stillInProperties.length}`);

    const allDeleted = stillInZillow.length === 0 && stillInProperties.length === 0;
    console.log(`\nVerification Status:                   ${allDeleted ? '✅ PASSED - ALL DELETED' : '❌ FAILED - SOME REMAIN'}`);

    console.log('\n' + '='.repeat(80));

    if (allDeleted) {
      console.log('\n🎉 SUCCESS! Triple-check confirms all "not available" properties deleted.\n');
      console.log('✅ None of these agents will be contacted again!\n');
    } else {
      console.log('\n⚠️  WARNING: Some properties still exist and need manual review.\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

verifyDeletions()
  .then(() => {
    console.log('✅ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
