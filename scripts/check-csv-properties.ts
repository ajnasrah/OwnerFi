import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

async function checkCSVProperties() {
  console.log('\n🔍 Checking CSV properties against database\n');
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

    // Create a map of addresses in the database
    const dbAddresses = new Map<string, any>();
    snapshot.forEach(doc => {
      const data = doc.data();
      const addresses = [
        data.fullAddress,
        data.streetAddress,
        data.address,
        `${data.streetAddress}, ${data.city}, ${data.state} ${data.zipCode}`.toLowerCase()
      ].filter(Boolean);

      addresses.forEach(addr => {
        if (addr) {
          const normalized = addr.toString().toLowerCase().trim();
          dbAddresses.set(normalized, { id: doc.id, address: data.fullAddress || data.address });
        }
      });
    });

    console.log(`🗺️  Unique addresses indexed: ${dbAddresses.size}\n`);
    console.log('=' .repeat(70));

    // Check each CSV property
    const notInDB: any[] = [];
    const inDB: any[] = [];

    for (const record of records) {
      const csvAddress = record['Property Address']?.trim();
      if (!csvAddress) continue;

      const normalized = csvAddress.toLowerCase().trim();
      const found = dbAddresses.has(normalized);

      if (found) {
        inDB.push({
          csvAddress,
          dbAddress: dbAddresses.get(normalized)?.address,
          price: record['Price ']
        });
      } else {
        notInDB.push({
          address: csvAddress,
          city: record['Property city'],
          state: record['State '],
          zip: record['zip code '],
          price: record['Price '],
          bedrooms: record['bedrooms'],
          bathrooms: record['bathrooms'],
          stage: record['stage']
        });
      }
    }

    console.log(`\n✅ Properties ALREADY in database: ${inDB.length}`);
    console.log(`❌ Properties NOT in database: ${notInDB.length}\n`);

    if (notInDB.length > 0) {
      console.log('=' .repeat(70));
      console.log('\n🚨 PROPERTIES NOT IN DATABASE:\n');

      notInDB.forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.address}`);
        console.log(`   📍 ${prop.city}, ${prop.state} ${prop.zip}`);
        console.log(`   💰 Price: $${prop.price}`);
        console.log(`   🏠 ${prop.bedrooms} bed, ${prop.bathrooms} bath`);
        console.log(`   📊 Stage: ${prop.stage}`);
        console.log('');
      });
    }

    // Summary statistics
    console.log('=' .repeat(70));
    console.log('\n📈 SUMMARY:\n');
    console.log(`Total in CSV:        ${records.length}`);
    console.log(`Already in DB:       ${inDB.length} (${((inDB.length / records.length) * 100).toFixed(1)}%)`);
    console.log(`Missing from DB:     ${notInDB.length} (${((notInDB.length / records.length) * 100).toFixed(1)}%)`);
    console.log('');

    // Save missing properties to a file
    if (notInDB.length > 0) {
      const outputPath = path.join(__dirname, '..', 'missing-properties.json');
      fs.writeFileSync(outputPath, JSON.stringify(notInDB, null, 2));
      console.log(`💾 Missing properties saved to: missing-properties.json\n`);
    }

    console.log('=' .repeat(70));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkCSVProperties()
  .then(() => {
    console.log('\n✅ Check complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
