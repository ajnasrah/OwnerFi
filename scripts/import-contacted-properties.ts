import * as XLSX from 'xlsx';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

// Helper function to extract street number and first word
function extractAddressKey(address: string): string {
  if (!address) return '';
  const parts = address.trim().toLowerCase().match(/^(\d+)\s+(\w+)/);
  return parts ? `${parts[1]} ${parts[2]}` : address.trim().toLowerCase();
}

async function importContactedProperties() {
  try {
    const filePath = process.argv[2] || '/Users/abdullahabunasrah/Downloads/opportunities.csv';

    console.log(`Reading file: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${data.length} records`);

    let imported = 0;
    let skipped = 0;
    let batch = db.batch();

    for (const row of data) {
      const propertyAddress = row['Property Address'] || row['property address'] || '';
      const contactName = row['Contact Name'] || row['contact name'] || '';
      const phone = row['phone'] || '';
      const email = row['email'] || '';

      if (!propertyAddress) {
        skipped++;
        continue;
      }

      // Extract street number and first word only
      const normalizedAddress = extractAddressKey(propertyAddress);
      const normalizedAgent = contactName.trim().toLowerCase();

      // Create composite key
      const compositeKey = `${normalizedAddress}__${normalizedAgent}`;

      const docRef = db.collection('contacted_properties').doc(compositeKey);
      batch.set(docRef, {
        propertyAddress: propertyAddress.trim(),
        normalizedAddress,
        contactName: contactName.trim(),
        normalizedAgent,
        phone: String(phone || '').trim(),
        email: String(email || '').trim(),
        city: String(row['Property city'] || row['city'] || ''),
        state: String(row['State '] || row['state'] || ''),
        zipCode: String(row['zip code '] || row['Zip code'] || ''),
        price: parseFloat(row['Price '] || row['price'] || 0),
        bedrooms: parseInt(row['bedrooms'] || 0),
        bathrooms: parseInt(row['bathrooms'] || 0),
        livingArea: parseInt(row['livingArea'] || 0),
        homeType: String(row['homeType'] || ''),
        yearBuilt: parseInt(row['yearBuilt'] || 0),
        imageLink: String(row['Image link'] || ''),
        taxAmount: parseFloat(row['Tax amount '] || 0),
        hoa: parseFloat(row['hoa '] || 0),
        zestimate: parseFloat(row['zestimate '] || 0),
        opportunityId: String(row['Opportunity ID'] || ''),
        contactId: String(row['Contact ID'] || ''),
        status: String(row['status'] || ''),
        stage: String(row['stage'] || ''),
        createdOn: String(row['Created on'] || ''),
        updatedOn: String(row['Updated on'] || ''),
        importedAt: new Date(),
        source: 'ghl-export'
      });

      imported++;

      // Firestore batch limit is 500
      if (imported % 400 === 0) {
        await batch.commit();
        console.log(`Committed batch: ${imported} properties`);
        batch = db.batch(); // Create new batch after committing
      }
    }

    // Commit remaining
    if (imported % 400 !== 0) {
      await batch.commit();
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${data.length}`);
    console.log(`\nExample normalized address: "1371 S Parkway E" -> "${extractAddressKey('1371 S Parkway E')}"`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importContactedProperties();
