/**
 * Check Zip Code Issues in Database
 * Find properties with descriptions in zip code field or missing zip codes
 */

import admin from 'firebase-admin';

async function checkZipCodeIssues() {
  console.log('🔍 CHECKING ZIP CODE ISSUES IN DATABASE\n');
  console.log('='.repeat(80));

  try {
    // Initialize Firebase Admin
    if (admin.apps.length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

      if (!projectId || !privateKey || !clientEmail) {
        console.error('❌ Missing Firebase credentials');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        })
      });
    }

    const db = admin.firestore();

    console.log('\n📊 Querying ALL properties...\n');

    const snapshot = await db.collection('properties').get();

    console.log(`Found ${snapshot.size} total properties\n`);

    // Categorize zip code issues
    const invalidZipCodes: any[] = [];
    const missingZipCodes: any[] = [];
    const validZipCodes: any[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const zipCode = data.zipCode || data.zip || '';
      const address = data.address || 'Unknown';
      const city = data.city || 'Unknown';
      const state = data.state || 'Unknown';

      // Check if zip code is valid (5 digits, optionally with -4 extension)
      const isValidZip = /^\d{5}(-\d{4})?$/.test(zipCode.toString().trim());
      const hasContent = zipCode && zipCode.toString().trim().length > 0;

      if (!hasContent) {
        missingZipCodes.push({
          id: doc.id,
          address,
          city,
          state,
          zipCode: zipCode || '(empty)',
          isActive: data.isActive
        });
      } else if (!isValidZip) {
        invalidZipCodes.push({
          id: doc.id,
          address,
          city,
          state,
          zipCode,
          isActive: data.isActive
        });
      } else {
        validZipCodes.push({
          id: doc.id,
          zipCode
        });
      }
    });

    // Show statistics
    console.log('📈 ZIP CODE STATISTICS:');
    console.log('-'.repeat(80));
    console.log(`Valid Zip Codes: ${validZipCodes.length} (${((validZipCodes.length / snapshot.size) * 100).toFixed(1)}%)`);
    console.log(`Invalid Zip Codes: ${invalidZipCodes.length} (${((invalidZipCodes.length / snapshot.size) * 100).toFixed(1)}%)`);
    console.log(`Missing Zip Codes: ${missingZipCodes.length} (${((missingZipCodes.length / snapshot.size) * 100).toFixed(1)}%)`);

    // Show invalid zip codes
    if (invalidZipCodes.length > 0) {
      console.log('\n\n🚨 PROPERTIES WITH INVALID ZIP CODES:');
      console.log('='.repeat(80));
      console.log(`Found ${invalidZipCodes.length} properties with invalid zip codes\n`);

      invalidZipCodes.slice(0, 20).forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
        console.log(`   Property ID: ${prop.id}`);
        console.log(`   Status: ${prop.isActive ? 'ACTIVE ✅' : 'Inactive'}`);
        console.log(`   Zip Code: "${prop.zipCode}"`);
        console.log(`   Issue: ${isNaN(prop.zipCode) ? 'Contains non-numeric characters' : 'Invalid format'}`);
        console.log('');
      });

      if (invalidZipCodes.length > 20) {
        console.log(`... and ${invalidZipCodes.length - 20} more\n`);
      }
    }

    // Show missing zip codes
    if (missingZipCodes.length > 0) {
      console.log('\n\n⚠️  PROPERTIES WITH MISSING ZIP CODES:');
      console.log('='.repeat(80));
      console.log(`Found ${missingZipCodes.length} properties with missing zip codes\n`);

      missingZipCodes.slice(0, 20).forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.address}, ${prop.city}, ${prop.state}`);
        console.log(`   Property ID: ${prop.id}`);
        console.log(`   Status: ${prop.isActive ? 'ACTIVE ✅' : 'Inactive'}`);
        console.log('');
      });

      if (missingZipCodes.length > 20) {
        console.log(`... and ${missingZipCodes.length - 20} more\n`);
      }
    }

    // Export to JSON for processing
    const issuesData = {
      invalid: invalidZipCodes,
      missing: missingZipCodes,
      timestamp: new Date().toISOString()
    };

    console.log('\n📝 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total Properties: ${snapshot.size}`);
    console.log(`✅ Valid: ${validZipCodes.length}`);
    console.log(`⚠️  Invalid: ${invalidZipCodes.length}`);
    console.log(`❌ Missing: ${missingZipCodes.length}`);
    console.log(`📊 Need Fixing: ${invalidZipCodes.length + missingZipCodes.length} (${(((invalidZipCodes.length + missingZipCodes.length) / snapshot.size) * 100).toFixed(1)}%)`);

    console.log('\n' + '='.repeat(80));
    console.log('');

    // Save to file for next script to use
    const fs = require('fs');
    fs.writeFileSync(
      'zip-code-issues.json',
      JSON.stringify(issuesData, null, 2)
    );
    console.log('✅ Issues saved to zip-code-issues.json');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  }
}

checkZipCodeIssues();
