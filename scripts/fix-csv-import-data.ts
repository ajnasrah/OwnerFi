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

// Helper function to generate Google Street View image URL
function getStreetViewImageByAddress(address: string): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return '';
  }

  const encodedAddress = encodeURIComponent(address);

  // High quality settings: 800x500, 90 degree FOV, slight pitch for better view
  return `https://maps.googleapis.com/maps/api/streetview?` +
    `size=800x500&` +
    `location=${encodedAddress}&` +
    `heading=0&` +
    `fov=90&` +
    `pitch=10&` +
    `key=${apiKey}`;
}

async function fixCSVImportData() {
  console.log('\n🔧 FIXING CSV IMPORT DATA\n');
  console.log('='.repeat(70));

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
    console.log(`📄 Reading CSV: ${csvFile}\n`);

    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`📊 Total properties in CSV: ${records.length}\n`);

    // Get all CSV imports from database
    console.log('🔄 Fetching CSV imports from database...');
    const snapshot = await db.collection('zillow_imports')
      .where('source', '==', 'CSV Import')
      .get();

    console.log(`📊 Found ${snapshot.size} CSV imports in database\n`);

    // Build lookup map
    const dbMap = new Map<string, { id: string; data: any }>();
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

    console.log('='.repeat(70));
    console.log('\n🔍 Matching CSV data to database properties...\n');

    let fixedCount = 0;
    let skippedCount = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const record of records) {
      const csvAddress = record['Property Address']?.trim();
      if (!csvAddress) {
        skippedCount++;
        continue;
      }

      const normalized = normalizeAddress(csvAddress);
      const dbEntry = dbMap.get(normalized);

      if (!dbEntry) {
        skippedCount++;
        continue;
      }

      // Extract data from CSV with proper parsing (NO trailing spaces in column names due to trim: true)
      const price = parseFloat(record['Price']) || null;
      const state = record['State'] || '';
      const zipCode = record['zip code'] || '';
      const description = record['New Description'] || record['description'] || '';
      const imageUrl = record['Image link'] || null;

      // Only update if we have better data
      const currentData = dbEntry.data;
      const needsUpdate = !currentData.price || price > 0 ||
                         !currentData.state || state ||
                         !currentData.zipCode || zipCode ||
                         !currentData.description || description ||
                         !currentData.firstPropertyImage || imageUrl;

      if (needsUpdate) {
        const updates: any = {
          updatedAt: new Date(),
        };

        // Only update fields that have values
        if (price && price > 0) updates.price = price;
        if (price && price > 0) updates.listPrice = price;
        if (state) updates.state = state;
        if (zipCode) updates.zipCode = zipCode;
        if (description) updates.description = description;

        // Image handling with fail-safe to Google Street View
        if (imageUrl) {
          updates.firstPropertyImage = imageUrl;
          updates.imageUrl = imageUrl;
          updates.propertyImages = [imageUrl];
          updates.imageUrls = [imageUrl];
          updates.imageSource = 'CSV';
        } else if (!currentData.firstPropertyImage && !currentData.imageUrl) {
          // No image in CSV and property missing image - add Street View
          const streetViewUrl = getStreetViewImageByAddress(csvAddress);
          if (streetViewUrl) {
            updates.firstPropertyImage = streetViewUrl;
            updates.imageUrl = streetViewUrl;
            updates.propertyImages = [streetViewUrl];
            updates.imageUrls = [streetViewUrl];
            updates.imageSource = 'Google Street View';
          }
        }

        const docRef = db.collection('zillow_imports').doc(dbEntry.id);
        batch.update(docRef, updates);
        batchCount++;
        fixedCount++;

        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   ✓ Updated ${fixedCount} properties...`);
          batch = db.batch(); // Create new batch
          batchCount = 0;
        }
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   ✓ Updated ${fixedCount} properties`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n📊 RESULTS:\n');
    console.log(`Properties fixed:    ${fixedCount}`);
    console.log(`Properties skipped:  ${skippedCount}`);

    console.log('\n✅ Data fix complete!\n');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixCSVImportData()
  .then(() => {
    console.log('\n✅ Fix complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });
