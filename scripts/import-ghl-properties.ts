#!/usr/bin/env tsx
/**
 * Import GHL Properties from CSV
 *
 * Imports only properties with stage "exported to website"
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';

config({ path: resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebase-admin';

async function importGHLProperties() {
  console.log('📥 Importing GHL Properties from CSV\n');
  console.log('='.repeat(70));

  const db = await getAdminDb();
  if (!db) {
    console.error('❌ Failed to initialize Firebase Admin SDK');
    return;
  }

  // Read CSV
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities-2.csv';
  const csvContent = readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');

  // Parse header
  const headers = lines[0].split(',');
  console.log(`\n📊 CSV has ${lines.length - 1} total rows\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = lines[i].split(',');
    const row: any = {};

    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });

    // Only import if stage is "exported to website"
    if (row.stage !== 'exported to website') {
      skipped++;
      continue;
    }

    try {
      const propertyId = row['Opportunity ID'] || `ghl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      const property = {
        // Basic info
        address: row['Property Address'] || '',
        city: row['Property city'] || '',
        state: row['State '] || '',
        zipCode: row['zip code '] || '',

        // Financial details
        price: parseFloat(row['Price ']) || 0,
        downPaymentAmount: parseFloat(row['down payment amount ']) || 0,
        downPaymentPercent: parseFloat(row['down payment %']) || 0,
        monthlyPayment: parseFloat(row['Monthly payment']) || 0,
        interestRate: parseFloat(row['Interest rate ']) || 0,
        balloon: parseFloat(row['Balloon ']) || 0,
        amortizationMonths: parseInt(row['Amortization schedule months ']) || 360,
        taxAmount: parseFloat(row['Tax amount ']) || 0,
        hoa: parseFloat(row['hoa ']) || 0,

        // Property details
        bedrooms: parseInt(row['bedrooms']) || 0,
        bathrooms: parseFloat(row['bathrooms']) || 0,
        livingArea: parseInt(row['livingArea']) || 0,
        lotSize: parseFloat(row['lot sizes']) || 0,
        yearBuilt: parseInt(row['yearBuilt']) || 0,
        homeType: row['homeType'] || '',
        daysOnZillow: parseInt(row['daysOnZillow']) || 0,

        // Estimates
        zestimate: parseFloat(row['zestimate ']) || 0,
        rentalEstimate: parseFloat(row['Rental estimate ']) || 0,

        // Media
        imageUrls: row['Image link'] ? [row['Image link']] : [],
        description: row['description'] || '',

        // Contact info
        contactName: row['Contact Name'] || '',
        contactPhone: row['phone'] || '',
        contactEmail: row['email'] || '',

        // GHL data
        opportunityId: row['Opportunity ID'] || '',
        contactId: row['Contact ID'] || '',
        pipelineId: row['Pipeline ID'] || '',
        pipelineStageId: row['Pipeline Stage ID'] || '',
        pipeline: row['pipeline'] || '',
        stage: row['stage'] || '',

        // Metadata
        source: 'gohighlevel',
        sourceUrl: row['source'] || '',
        status: 'active',
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.collection('properties').doc(propertyId).set(property);
      imported++;

      if (imported % 50 === 0) {
        console.log(`  ✅ Imported ${imported} properties...`);
      }
    } catch (err) {
      errors++;
      console.error(`  ❌ Error importing row ${i}:`, err);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Import Complete!');
  console.log('='.repeat(70));
  console.log(`\n📈 Summary:`);
  console.log(`   Imported: ${imported} properties`);
  console.log(`   Skipped: ${skipped} (not "exported to website")`);
  console.log(`   Errors: ${errors}`);
  console.log('');
}

importGHLProperties().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
