import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

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
  return addr.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function comprehensiveVerification() {
  console.log('\n🔍 COMPREHENSIVE VERIFICATION - Excel to Database\n');
  console.log('=' .repeat(70));

  try {
    // Read CSV file
    const csvPath = '/Users/abdullahabunasrah/Downloads';
    const files = fs.readdirSync(csvPath);
    const csvFile = files.find(f => f.includes('9.45.40') && f.endsWith('.csv'));

    if (!csvFile) {
      console.error('❌ CSV file not found');
      process.exit(1);
    }

    const fullPath = path.join(csvPath, csvFile);
    console.log(`📄 Reading Excel/CSV: ${csvFile}\n`);

    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`📊 Total properties in Excel: ${records.length}\n`);

    // Get all properties from database
    console.log('🔄 Fetching all properties from database...');
    const snapshot = await db.collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .get();

    console.log(`📊 Total properties in database: ${snapshot.size}\n`);

    // Build address lookup map
    const dbMap = new Map<string, any>();
    snapshot.forEach(doc => {
      const data = doc.data();
      const addresses = [
        data.fullAddress,
        data.streetAddress,
        data.address,
      ].filter(Boolean);

      addresses.forEach(addr => {
        if (addr) {
          const normalized = normalizeAddress(addr);
          dbMap.set(normalized, { id: doc.id, data });
        }
      });
    });

    console.log('=' .repeat(70));
    console.log('\n🔍 Checking each Excel property...\n');

    let foundCount = 0;
    let missingCount = 0;
    let dataMatchCount = 0;
    let dataMismatchCount = 0;
    const missing: any[] = [];
    const mismatches: any[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const csvAddress = record['Property Address']?.trim();

      if (!csvAddress) {
        console.log(`⚠️  Row ${i + 1}: No address found, skipping`);
        continue;
      }

      const normalized = normalizeAddress(csvAddress);
      const dbEntry = dbMap.get(normalized);

      if (!dbEntry) {
        missingCount++;
        missing.push({
          row: i + 1,
          address: csvAddress,
          city: record['Property city'],
          state: record['State '],
          price: record['Price ']
        });
        console.log(`❌ Row ${i + 2}: NOT FOUND - ${csvAddress}`);
      } else {
        foundCount++;

        // Verify data matches
        const dbData = dbEntry.data;
        const excelPrice = parseFloat(record['Price ']) || 0;
        const dbPrice = dbData.price || 0;
        const excelBeds = parseFloat(record['bedrooms']) || 0;
        const dbBeds = dbData.bedrooms || 0;
        const excelBaths = parseFloat(record['bathrooms']) || 0;
        const dbBaths = dbData.bathrooms || 0;

        // Check if key fields match
        const priceMatch = Math.abs(excelPrice - dbPrice) < 1;
        const bedsMatch = excelBeds === dbBeds;
        const bathsMatch = excelBaths === dbBaths;

        if (priceMatch && bedsMatch && bathsMatch) {
          dataMatchCount++;
          if (foundCount % 50 === 0) {
            console.log(`✅ Verified ${foundCount} properties...`);
          }
        } else {
          dataMismatchCount++;
          mismatches.push({
            row: i + 1,
            address: csvAddress,
            issues: [
              !priceMatch ? `Price: Excel=$${excelPrice} DB=$${dbPrice}` : null,
              !bedsMatch ? `Beds: Excel=${excelBeds} DB=${dbBeds}` : null,
              !bathsMatch ? `Baths: Excel=${excelBaths} DB=${dbBaths}` : null,
            ].filter(Boolean)
          });
          console.log(`⚠️  Row ${i + 2}: DATA MISMATCH - ${csvAddress}`);
        }
      }
    }

    // Final Report
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 FINAL VERIFICATION REPORT\n');
    console.log('=' .repeat(70));

    console.log('\n🔢 COUNTS:');
    console.log(`   Excel Properties:           ${records.length}`);
    console.log(`   Database Properties:        ${snapshot.size}`);
    console.log('');
    console.log(`   ✅ Found in Database:       ${foundCount} (${((foundCount / records.length) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Missing from Database:   ${missingCount} (${((missingCount / records.length) * 100).toFixed(1)}%)`);
    console.log('');
    console.log(`   ✅ Data Matches:            ${dataMatchCount} (${((dataMatchCount / foundCount) * 100).toFixed(1)}%)`);
    console.log(`   ⚠️  Data Mismatches:         ${dataMismatchCount} (${((dataMismatchCount / foundCount) * 100).toFixed(1)}%)`);

    // Show missing properties
    if (missing.length > 0) {
      console.log('\n' + '='.repeat(70));
      console.log('\n❌ MISSING PROPERTIES:\n');
      missing.slice(0, 10).forEach(item => {
        console.log(`Row ${item.row}: ${item.address}`);
        console.log(`   ${item.city}, ${item.state}`);
        console.log(`   Price: $${item.price}`);
        console.log('');
      });
      if (missing.length > 10) {
        console.log(`... and ${missing.length - 10} more\n`);
      }
    }

    // Show data mismatches
    if (mismatches.length > 0) {
      console.log('\n' + '='.repeat(70));
      console.log('\n⚠️  DATA MISMATCHES:\n');
      mismatches.slice(0, 10).forEach(item => {
        console.log(`Row ${item.row}: ${item.address}`);
        item.issues.forEach((issue: string) => console.log(`   ${issue}`));
        console.log('');
      });
      if (mismatches.length > 10) {
        console.log(`... and ${mismatches.length - 10} more\n`);
      }
    }

    // Success criteria
    console.log('\n' + '='.repeat(70));
    console.log('\n✅ VERIFICATION RESULT:\n');

    if (foundCount === records.length && dataMismatchCount === 0) {
      console.log('🎉 SUCCESS! All Excel properties are in the database with correct data!');
      console.log(`   • ${foundCount}/${records.length} properties found (100%)`);
      console.log(`   • ${dataMatchCount}/${foundCount} data matches (100%)`);
      console.log('\n✅ Excel and Database are fully synchronized!\n');
    } else if (foundCount === records.length) {
      console.log('✅ All properties found, but some data mismatches exist');
      console.log(`   • ${foundCount}/${records.length} properties found (100%)`);
      console.log(`   • ${dataMatchCount}/${foundCount} data matches (${((dataMatchCount / foundCount) * 100).toFixed(1)}%)`);
      console.log(`   • ${dataMismatchCount} properties have minor data differences`);
      console.log('\n⚠️  All properties imported, but review mismatches above\n');
    } else {
      console.log('❌ INCOMPLETE - Some properties are missing');
      console.log(`   • ${foundCount}/${records.length} properties found (${((foundCount / records.length) * 100).toFixed(1)}%)`);
      console.log(`   • ${missingCount} properties not found in database`);
      console.log('\n❌ Import incomplete - review missing properties above\n');
    }

    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

comprehensiveVerification()
  .then(() => {
    console.log('\n✅ Verification complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
