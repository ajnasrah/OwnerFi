/**
 * Check Missing Properties from GHL CSV
 *
 * Compares properties in "Exported to Website" stage from GHL CSV
 * with properties actually in Firestore database
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials in .env.local');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    })
  });
}

const db = getFirestore();

async function checkMissingProperties() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 CHECKING MISSING PROPERTIES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Read CSV file
  const csvPath = '/Users/abdullahabunasrah/Downloads/opportunities.csv';
  console.log(`📂 Reading CSV: ${csvPath}`);

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');

  console.log(`   Total rows in CSV: ${lines.length - 1}`);

  // Find column indices
  const stageIndex = headers.findIndex(h => h.toLowerCase().includes('stage'));
  const addressIndex = headers.findIndex(h => h.toLowerCase().includes('property address'));
  const cityIndex = headers.findIndex(h => h.toLowerCase().includes('property city'));
  const stateIndex = headers.findIndex(h => h.toLowerCase().replace(/"/g, '').trim().includes('state'));
  const zipIndex = headers.findIndex(h => h.toLowerCase().includes('zip code'));
  const opportunityIdIndex = headers.findIndex(h => h.toLowerCase().includes('opportunity id'));

  console.log(`\n📋 Column indices:`);
  console.log(`   Stage: ${stageIndex}`);
  console.log(`   Address: ${addressIndex}`);
  console.log(`   City: ${cityIndex}`);
  console.log(`   State: ${stateIndex}`);
  console.log(`   ZIP: ${zipIndex}`);
  console.log(`   Opportunity ID: ${opportunityIdIndex}`);

  // Parse CSV and filter "Exported to Website"
  const exportedProperties: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const columns = line.split(',');
    const stage = columns[stageIndex]?.toLowerCase().trim();

    if (stage === 'exported to website') {
      exportedProperties.push({
        opportunityId: columns[opportunityIdIndex]?.trim(),
        address: columns[addressIndex]?.trim(),
        city: columns[cityIndex]?.trim(),
        state: columns[stateIndex]?.trim(),
        zip: columns[zipIndex]?.trim(),
        fullAddress: `${columns[addressIndex]?.trim()} ${columns[cityIndex]?.trim()} ${columns[stateIndex]?.trim()} ${columns[zipIndex]?.trim()}`
      });
    }
  }

  console.log(`\n✅ Found ${exportedProperties.length} properties in "Exported to Website" stage\n`);

  // Get all properties from Firestore
  console.log('🔍 Fetching properties from Firestore...');
  const propertiesSnapshot = await db.collection('properties').get();
  console.log(`   Found ${propertiesSnapshot.size} properties in database\n`);

  // Create map of database properties by ghlOpportunityId and address
  const dbPropertiesByGhlId = new Map();
  const dbPropertiesByAddress = new Map();

  propertiesSnapshot.forEach(doc => {
    const data = doc.data();

    // Index by GHL opportunity ID
    if (data.ghlOpportunityId) {
      dbPropertiesByGhlId.set(data.ghlOpportunityId, {
        id: doc.id,
        address: data.address,
        city: data.city,
        state: data.state,
        ...data
      });
    }

    // Index by address (normalized)
    const normalizedAddress = `${data.address} ${data.city} ${data.state}`.toLowerCase().replace(/\s+/g, ' ').trim();
    dbPropertiesByAddress.set(normalizedAddress, {
      id: doc.id,
      address: data.address,
      city: data.city,
      state: data.state,
      ghlOpportunityId: data.ghlOpportunityId,
      ...data
    });
  });

  console.log(`📊 Database properties indexed:`);
  console.log(`   By GHL ID: ${dbPropertiesByGhlId.size}`);
  console.log(`   By Address: ${dbPropertiesByAddress.size}\n`);

  // Check which CSV properties are missing
  const missing: any[] = [];
  const found: any[] = [];

  for (const prop of exportedProperties) {
    const normalizedCsvAddress = `${prop.address} ${prop.city} ${prop.state}`.toLowerCase().replace(/\s+/g, ' ').trim();

    // Check by GHL ID first
    if (prop.opportunityId && dbPropertiesByGhlId.has(prop.opportunityId)) {
      found.push({
        ...prop,
        matchedBy: 'GHL ID',
        dbProperty: dbPropertiesByGhlId.get(prop.opportunityId)
      });
    }
    // Then check by address
    else if (dbPropertiesByAddress.has(normalizedCsvAddress)) {
      found.push({
        ...prop,
        matchedBy: 'Address',
        dbProperty: dbPropertiesByAddress.get(normalizedCsvAddress)
      });
    }
    // Not found!
    else {
      missing.push(prop);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ Found in database: ${found.length}`);
  console.log(`❌ Missing from database: ${missing.length}\n`);

  if (missing.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ MISSING PROPERTIES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    missing.forEach((prop, index) => {
      console.log(`${index + 1}. ${prop.fullAddress}`);
      console.log(`   Opportunity ID: ${prop.opportunityId || 'N/A'}`);
      console.log(`   Address: ${prop.address}`);
      console.log(`   City: ${prop.city}`);
      console.log(`   State: ${prop.state}`);
      console.log(`   ZIP: ${prop.zip}`);
      console.log('');
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 POSSIBLE CAUSES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('1. Import script never ran for these properties');
    console.log('2. Import script failed for these properties (check logs)');
    console.log('3. Properties were in "Exported to Website" AFTER last import');
    console.log('4. Import script has filtering logic that excluded these');
    console.log('5. Address formatting mismatch between GHL and import\n');
  }

  // Show sample of found properties
  if (found.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SAMPLE OF FOUND PROPERTIES (First 5)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    found.slice(0, 5).forEach((prop, index) => {
      console.log(`${index + 1}. ${prop.fullAddress}`);
      console.log(`   Matched by: ${prop.matchedBy}`);
      console.log(`   GHL ID: ${prop.opportunityId || 'N/A'}`);
      console.log(`   DB ID: ${prop.dbProperty?.id || 'N/A'}`);
      console.log('');
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Calculate percentage
  const foundPercentage = ((found.length / exportedProperties.length) * 100).toFixed(1);
  const missingPercentage = ((missing.length / exportedProperties.length) * 100).toFixed(1);

  console.log(`📈 STATISTICS:`);
  console.log(`   CSV "Exported to Website": ${exportedProperties.length}`);
  console.log(`   Database properties: ${propertiesSnapshot.size}`);
  console.log(`   Found: ${found.length} (${foundPercentage}%)`);
  console.log(`   Missing: ${missing.length} (${missingPercentage}%)`);
  console.log('');
}

checkMissingProperties()
  .then(() => {
    console.log('✅ Analysis complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
