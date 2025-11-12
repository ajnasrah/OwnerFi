/**
 * Check Exported Properties in Database
 *
 * Reads extracted opportunity IDs from Python script and verifies
 * which ones exist in Firebase database.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
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

interface ExportedProperty {
  id: string;
  name: string;
  address: string;
}

async function checkExportedInDatabase() {
  console.log('🔍 Checking which "exported to website" properties are in database...\n');

  // Read extracted IDs from Python script
  const idsPath = '/tmp/exported-opportunity-ids.json';

  if (!fs.existsSync(idsPath)) {
    console.error('❌ Extracted IDs file not found. Run verify-exported-props.py first.');
    process.exit(1);
  }

  const exportedProps: ExportedProperty[] = JSON.parse(fs.readFileSync(idsPath, 'utf-8'));

  console.log(`📋 Checking ${exportedProps.length} opportunity IDs...\n`);

  // Get all GHL properties from database
  console.log('📦 Fetching all GHL properties from database...');
  const dbSnapshot = await db.collection('properties')
    .where('source', '==', 'gohighlevel')
    .get();

  console.log(`   Found ${dbSnapshot.size} GHL properties in database\n`);

  // Create map of database properties by opportunity ID
  const dbPropsMap = new Map<string, any>();
  dbSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.opportunityId) {
      dbPropsMap.set(data.opportunityId, {
        docId: doc.id,
        ...data
      });
    }
  });

  console.log('═'.repeat(80) + '\n');

  // Check each exported property
  const found: ExportedProperty[] = [];
  const missing: ExportedProperty[] = [];

  exportedProps.forEach(prop => {
    if (dbPropsMap.has(prop.id)) {
      found.push(prop);
    } else {
      missing.push(prop);
    }
  });

  // Summary
  console.log('📊 VERIFICATION RESULTS\n');
  console.log(`Total "exported to website": ${exportedProps.length}`);
  console.log(`✅ Found in database: ${found.length} (${Math.round(found.length / exportedProps.length * 100)}%)`);
  console.log(`❌ Missing from database: ${missing.length} (${Math.round(missing.length / exportedProps.length * 100)}%)`);
  console.log('\n' + '═'.repeat(80) + '\n');

  if (missing.length > 0) {
    console.log(`\n❌ MISSING PROPERTIES (${missing.length} total):\n`);

    missing.slice(0, 50).forEach((prop, index) => {
      console.log(`${index + 1}. ${prop.name}`);
      console.log(`   Opportunity ID: ${prop.id}`);
      console.log(`   Address: ${prop.address}`);
      console.log('');
    });

    if (missing.length > 50) {
      console.log(`   ... and ${missing.length - 50} more\n`);
    }

    console.log('═'.repeat(80));
    console.log('\n🔍 POSSIBLE REASONS:\n');
    console.log('1. ❌ Webhook never fired from GoHighLevel');
    console.log('2. ❌ Webhook fired but validation failed (missing required fields: address, city, state, price)');
    console.log('3. ❌ Property was deleted from database after being added');
    console.log('4. ⚠️  Stage changed to "exported to website" without triggering save webhook\n');

    console.log('💡 NEXT STEPS:\n');
    console.log('1. Check webhook logs in GoHighLevel for these opportunity IDs');
    console.log('2. Verify webhook is configured to fire on stage change');
    console.log('3. Check if properties have all required fields in GHL');
    console.log('4. Manually trigger webhook test for a sample missing property\n');
  } else {
    console.log('\n✅ ALL EXPORTED PROPERTIES ARE IN DATABASE!\n');
  }

  // Sample of found properties
  if (found.length > 0) {
    console.log('\n✅ SAMPLE OF PROPERTIES CORRECTLY IN DATABASE:\n');

    found.slice(0, 10).forEach((prop, index) => {
      const dbProp = dbPropsMap.get(prop.id);
      console.log(`${index + 1}. ${prop.name}`);
      console.log(`   Opportunity ID: ${prop.id}`);
      console.log(`   Database Doc ID: ${dbProp.docId}`);
      console.log(`   Address: ${dbProp.address}, ${dbProp.city}, ${dbProp.state}`);
      console.log(`   Price: $${dbProp.price?.toLocaleString()}`);
      console.log('');
    });

    if (found.length > 10) {
      console.log(`   ... and ${found.length - 10} more\n`);
    }
  }

  // Write missing to file for reference
  if (missing.length > 0) {
    fs.writeFileSync(
      '/tmp/missing-properties.json',
      JSON.stringify(missing, null, 2)
    );
    console.log('\n💾 Missing properties list saved to /tmp/missing-properties.json');
  }
}

// Run the script
checkExportedInDatabase()
  .then(() => {
    console.log('\n✅ Verification completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
