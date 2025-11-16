import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

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

// Helper function to parse CSV value
function parseValue(value: string | undefined | null): string | number | null {
  if (!value || value === '') return null;

  // Try to parse as number
  const num = parseFloat(value);
  if (!isNaN(num)) return num;

  return value.trim();
}

// Helper function to build property document from CSV row
function buildPropertyFromCSV(record: any): any {
  const address = record['Property Address']?.trim() || '';
  const city = record['Property city']?.trim() || '';
  const state = record['State ']?.trim() || '';
  const zip = record['zip code ']?.trim() || '';

  // Build full address
  const fullAddress = address;
  const streetAddress = address.split(',')[0]?.trim() || address;

  // Parse numeric values
  const price = parseValue(record['Price ']);
  const bedrooms = parseValue(record['bedrooms']);
  const bathrooms = parseValue(record['bathrooms']);
  const livingArea = parseValue(record['livingArea']);
  const yearBuilt = parseValue(record['yearBuilt']);
  const downPaymentAmount = parseValue(record['down payment amount ']);
  const downPaymentPercent = parseValue(record['down payment %']);
  const monthlyPayment = parseValue(record['Monthly payment']);
  const interestRate = parseValue(record['Interest rate ']);
  const balloon = parseValue(record['Balloon ']);
  const taxAmount = parseValue(record['Tax amount ']);
  const hoa = parseValue(record['hoa ']);
  const zestimate = parseValue(record['zestimate ']);
  const rentalEstimate = parseValue(record['Rental estimate ']);
  const lotSize = parseValue(record['lot sizes']);
  const daysOnZillow = parseValue(record['daysOnZillow']);
  const amortizationMonths = parseValue(record['Amortization schedule months ']);

  const now = new Date();

  return {
    // Address fields
    fullAddress,
    streetAddress,
    address: fullAddress,
    city,
    state,
    zipCode: zip,

    // Property details
    price: price || 0,
    listPrice: price || 0,
    bedrooms: bedrooms || 0,
    bathrooms: bathrooms || 0,
    squareFoot: livingArea || 0,
    squareFeet: livingArea || 0,
    lotSquareFoot: lotSize || 0,
    lotSize: lotSize || 0,
    yearBuilt: yearBuilt || null,
    homeType: record['homeType']?.trim() || 'Single Family',
    buildingType: record['homeType']?.trim() || 'Single Family',
    propertyType: record['homeType']?.trim() || 'Single Family',

    // Owner financing details
    ownerFinanceVerified: true,
    monthlyPayment: monthlyPayment || null,
    downPayment: downPaymentAmount || null,
    downPaymentPercent: downPaymentPercent || null,
    interestRate: interestRate || null,
    balloonPayment: balloon || null,
    termYears: amortizationMonths ? Math.round(amortizationMonths / 12) : null,
    loanTermYears: amortizationMonths ? Math.round(amortizationMonths / 12) : null,

    // Additional details
    description: record['New Description ']?.trim() || record['description ']?.trim() || '',
    taxAmount: taxAmount || null,
    hoaFees: hoa || null,
    zestimate: zestimate || null,
    rentalEstimate: rentalEstimate || null,
    daysOnZillow: daysOnZillow || null,

    // Images
    firstPropertyImage: record['Image link']?.trim() || null,
    imageUrl: record['Image link']?.trim() || null,
    propertyImages: record['Image link']?.trim() ? [record['Image link'].trim()] : [],
    imageUrls: record['Image link']?.trim() ? [record['Image link'].trim()] : [],

    // Metadata
    source: 'CSV Import',
    stage: record['stage']?.trim() || 'exported to website',
    status: null, // No financing terms added yet
    importedAt: now,
    foundAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

async function importAndUpdateProperties() {
  console.log('\n🚀 Starting CSV Import and Update Process\n');
  console.log('=' .repeat(70));

  try {
    // Find and read the CSV file
    const csvPath = '/Users/abdullahabunasrah/Downloads';
    const files = fs.readdirSync(csvPath);
    const csvFile = files.find(f => f.includes('9.45.40') && f.endsWith('.csv'));

    if (!csvFile) {
      console.error('❌ CSV file not found');
      process.exit(1);
    }

    const fullPath = path.join(csvPath, csvFile);
    console.log(`📄 Reading CSV: ${csvFile}\n`);

    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`📊 Total properties in CSV: ${records.length}\n`);

    // Get all properties from database
    console.log('🔄 Fetching all properties from database...');
    const snapshot = await db.collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .get();

    console.log(`📊 Total properties in database: ${snapshot.size}\n`);

    // Create a map of addresses in the database with doc IDs
    const dbAddressMap = new Map<string, { id: string; data: any }>();
    snapshot.forEach(doc => {
      const data = doc.data();
      const addresses = [
        data.fullAddress,
        data.streetAddress,
        data.address,
      ].filter(Boolean);

      addresses.forEach(addr => {
        if (addr) {
          const normalized = addr.toString().toLowerCase().trim();
          dbAddressMap.set(normalized, { id: doc.id, data });
        }
      });
    });

    console.log('=' .repeat(70));

    // Categorize properties
    const toAdd: any[] = [];
    const toUpdate: any[] = [];

    for (const record of records) {
      const csvAddress = record['Property Address']?.trim();
      if (!csvAddress) continue;

      const normalized = csvAddress.toLowerCase().trim();
      const existing = dbAddressMap.get(normalized);

      if (existing) {
        toUpdate.push({
          id: existing.id,
          csvData: record,
          dbData: existing.data
        });
      } else {
        toAdd.push(record);
      }
    }

    console.log(`\n📊 Analysis:`);
    console.log(`   ➕ Properties to ADD: ${toAdd.length}`);
    console.log(`   🔄 Properties to UPDATE: ${toUpdate.length}`);
    console.log(`   📝 Total to process: ${toAdd.length + toUpdate.length}\n`);

    console.log('=' .repeat(70));

    // Add missing properties
    let addedCount = 0;
    if (toAdd.length > 0) {
      console.log(`\n➕ Adding ${toAdd.length} missing properties...\n`);

      const batch = db.batch();
      let batchCount = 0;

      for (const record of toAdd) {
        const propertyData = buildPropertyFromCSV(record);

        if (!propertyData.fullAddress) {
          console.log(`⚠️  Skipping property with no address`);
          continue;
        }

        const docRef = db.collection('zillow_imports').doc();
        batch.set(docRef, propertyData);
        batchCount++;
        addedCount++;

        if (batchCount % 10 === 0) {
          console.log(`   ✓ Prepared ${batchCount}/${toAdd.length} properties for import`);
        }

        // Firestore has a 500 operation limit per batch
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   💾 Committed batch of ${batchCount} properties`);
          batchCount = 0;
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   💾 Committed final batch of ${batchCount} properties`);
      }

      console.log(`\n✅ Added ${addedCount} new properties to database`);
    }

    // Update existing properties
    let updatedCount = 0;
    if (toUpdate.length > 0) {
      console.log(`\n🔄 Updating ${toUpdate.length} existing properties...\n`);

      const batch = db.batch();
      let batchCount = 0;

      for (const { id, csvData } of toUpdate) {
        const updates = buildPropertyFromCSV(csvData);

        // Don't overwrite importedAt/foundAt from original scrape
        delete updates.importedAt;
        delete updates.foundAt;
        delete updates.createdAt;

        // Keep updatedAt
        updates.updatedAt = new Date();

        const docRef = db.collection('zillow_imports').doc(id);
        batch.update(docRef, updates);
        batchCount++;
        updatedCount++;

        if (batchCount % 10 === 0) {
          console.log(`   ✓ Prepared ${batchCount}/${toUpdate.length} properties for update`);
        }

        // Firestore has a 500 operation limit per batch
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   💾 Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   💾 Committed final batch of ${batchCount} updates`);
      }

      console.log(`\n✅ Updated ${updatedCount} existing properties`);
    }

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('\n📈 FINAL SUMMARY:\n');
    console.log(`CSV Properties:           ${records.length}`);
    console.log(`Properties Added:         ${addedCount}`);
    console.log(`Properties Updated:       ${updatedCount}`);
    console.log(`Total Processed:          ${addedCount + updatedCount}`);

    // Get new total
    const finalSnapshot = await db.collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .get();

    console.log(`\nDatabase Total (before):  ${snapshot.size}`);
    console.log(`Database Total (after):   ${finalSnapshot.size}`);
    console.log(`Net Increase:             +${finalSnapshot.size - snapshot.size}`);

    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

importAndUpdateProperties()
  .then(() => {
    console.log('\n✅ Import and update complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
