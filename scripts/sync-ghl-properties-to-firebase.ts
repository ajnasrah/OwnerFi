/**
 * Sync all "exported to website" properties from GHL CSV to Firebase
 * This will import all 614 properties with their proper Opportunity IDs and addresses
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as csv from 'csv-parser';

// Initialize Firebase
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = getFirestore();

interface PropertyData {
  opportunityId: string;
  contactId: string;
  contactName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  fullAddress: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  livingArea: number;
  homeType: string;
  yearBuilt: number;
  description: string;
  imageUrl: string;
  balloon: number;
  interestRate: number;
  downPaymentPercent: number;
  monthlyPayment: number;
  lotSize: number;
  taxAmount: number;
  hoa: number;
  zestimate: number;
  phone: string;
  email: string;
  stage: string;
  createdAt: number;
  updatedAt: number;
}

async function syncProperties() {
  console.log('🔄 Syncing GHL properties to Firebase...\n');

  const properties: PropertyData[] = [];
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';

  // Read CSV
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // Only process "exported to website" properties
        if (row.stage?.trim().toLowerCase() !== 'exported to website') {
          return;
        }

        const opportunityId = row['Opportunity ID']?.trim();
        const address = row['Property Address']?.trim();

        if (!opportunityId || !address) {
          return;
        }

        properties.push({
          opportunityId,
          contactId: row['Contact ID']?.trim() || '',
          contactName: row['Contact Name']?.trim() || '',
          address,
          city: row['Property city']?.trim() || '',
          state: row['State ']?.trim() || '',
          zipCode: row['zip code ']?.trim() || '',
          fullAddress: `${address} ${row['Property city'] || ''} ${row['State '] || ''} ${row['zip code '] || ''}`.trim(),
          price: parseFloat(row['Price ']?.replace(/,/g, '') || '0'),
          bedrooms: parseInt(row['bedrooms'] || '0'),
          bathrooms: parseFloat(row['bathrooms'] || '0'),
          livingArea: parseInt(row['livingArea']?.replace(/,/g, '') || '0'),
          homeType: row['homeType']?.trim() || '',
          yearBuilt: parseInt(row['yearBuilt'] || '0'),
          description: row['New Description ']?.trim() || row['description ']?.trim() || '',
          imageUrl: row['Image link']?.trim() || '',
          balloon: parseFloat(row['Balloon '] || '0'),
          interestRate: parseFloat(row['Interest rate '] || '0'),
          downPaymentPercent: parseFloat(row['down payment %'] || '0'),
          monthlyPayment: parseFloat(row['Monthly payment']?.replace(/,/g, '') || '0'),
          lotSize: parseFloat(row['lot sizes']?.replace(/,/g, '') || '0'),
          taxAmount: parseFloat(row['Tax amount ']?.replace(/,/g, '') || '0'),
          hoa: parseFloat(row['hoa ']?.replace(/,/g, '') || '0'),
          zestimate: parseFloat(row['zestimate ']?.replace(/,/g, '') || '0'),
          phone: row['phone']?.trim() || '',
          email: row['email']?.trim() || '',
          stage: row['stage']?.trim() || '',
          createdAt: row['Created on'] ? new Date(row['Created on']).getTime() : Date.now(),
          updatedAt: row['Updated on'] ? new Date(row['Updated on']).getTime() : Date.now(),
        });
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });

  console.log(`📊 Found ${properties.length} properties to sync\n`);

  // Check existing properties in Firebase
  const existingSnapshot = await db.collection('properties').get();
  const existingByOppId = new Map();

  existingSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.opportunityId) {
      existingByOppId.set(data.opportunityId, doc.id);
    }
  });

  console.log(`📦 Found ${existingByOppId.size} existing properties in Firebase\n`);

  // Sync properties
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const property of properties) {
    try {
      const existingDocId = existingByOppId.get(property.opportunityId);

      if (existingDocId) {
        // Update existing property
        const docRef = db.collection('properties').doc(existingDocId);
        batch.update(docRef, property);
        updated++;
      } else {
        // Add new property
        const docRef = db.collection('properties').doc();
        batch.set(docRef, property);
        added++;
      }

      batchCount++;

      // Commit batch every 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`   ✅ Committed batch (Added: ${added}, Updated: ${updated})`);
        batchCount = 0;
      }

    } catch (error) {
      console.error(`   ❌ Error processing ${property.address}:`, error);
      errors++;
    }
  }

  // Commit remaining batch
  if (batchCount > 0) {
    await batch.commit();
    console.log(`   ✅ Committed final batch\n`);
  }

  console.log('='.repeat(80));
  console.log('📊 SYNC RESULTS');
  console.log('='.repeat(80));
  console.log(`✅ Added: ${added}`);
  console.log(`🔄 Updated: ${updated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📦 Total: ${added + updated}`);
  console.log('='.repeat(80));

  // Verify final count
  const finalSnapshot = await db.collection('properties').get();
  console.log(`\n✅ Final Firebase count: ${finalSnapshot.size} properties`);
  console.log(`✅ GHL "exported to website" count: ${properties.length} properties\n`);

  if (finalSnapshot.size === properties.length) {
    console.log('🎉 SUCCESS! All properties are now synced!\n');
  } else {
    console.log(`⚠️  Mismatch: ${properties.length - finalSnapshot.size} properties difference\n`);
  }
}

syncProperties().catch(console.error);
