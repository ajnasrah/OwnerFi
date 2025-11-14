/**
 * Fix and Fill Zip Codes
 * 1. Remove descriptions from zip code field
 * 2. Look up correct zip codes using Google Geocoding API
 * 3. Update database
 */

import admin from 'firebase-admin';
import * as fs from 'fs';

interface PropertyIssue {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  isActive: boolean;
}

interface IssuesData {
  invalid: PropertyIssue[];
  missing: PropertyIssue[];
}

async function lookupZipCode(address: string, city: string, state: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('⚠️  GOOGLE_MAPS_API_KEY not set - cannot lookup zip codes');
    return null;
  }

  const fullAddress = `${address}, ${city}, ${state}`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const addressComponents = data.results[0].address_components;

      // Find zip code component
      for (const component of addressComponents) {
        if (component.types.includes('postal_code')) {
          return component.long_name;
        }
      }
    }

    console.log(`   ⚠️  No zip code found for: ${fullAddress}`);
    return null;
  } catch (error) {
    console.error(`   ❌ Error looking up zip code for ${fullAddress}:`, error);
    return null;
  }
}

async function fixAndFillZipCodes() {
  console.log('🔧 FIXING AND FILLING ZIP CODES\n');
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

    // Load issues from JSON file
    console.log('\n📂 Loading zip code issues from file...\n');

    if (!fs.existsSync('zip-code-issues.json')) {
      console.error('❌ zip-code-issues.json not found. Run check-zipcode-issues.ts first.');
      return;
    }

    const issuesData: IssuesData = JSON.parse(fs.readFileSync('zip-code-issues.json', 'utf-8'));
    const allIssues = [...issuesData.invalid, ...issuesData.missing];

    console.log(`Found ${allIssues.length} properties to fix\n`);

    const results = {
      success: [] as string[],
      failed: [] as { id: string; reason: string }[],
      skipped: [] as { id: string; reason: string }[]
    };

    // Process each property
    for (let i = 0; i < allIssues.length; i++) {
      const prop = allIssues[i];

      console.log(`\n[${i + 1}/${allIssues.length}] Processing: ${prop.address}, ${prop.city}, ${prop.state}`);
      console.log(`   Property ID: ${prop.id}`);
      console.log(`   Current Zip: "${prop.zipCode}"`);

      // Skip if already valid
      if (/^\d{5}(-\d{4})?$/.test(prop.zipCode)) {
        console.log(`   ✅ Already valid - skipping`);
        results.skipped.push({ id: prop.id, reason: 'Already valid' });
        continue;
      }

      // Look up correct zip code
      console.log(`   🔍 Looking up zip code...`);
      const correctZip = await lookupZipCode(prop.address, prop.city, prop.state);

      if (!correctZip) {
        console.log(`   ❌ Could not find zip code`);
        results.failed.push({ id: prop.id, reason: 'Zip code not found via API' });
        continue;
      }

      console.log(`   ✅ Found zip code: ${correctZip}`);

      // Update in database - use set with merge instead of update
      try {
        const docRef = db.collection('properties').doc(prop.id);
        await docRef.set({
          zipCode: correctZip,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`   ✅ Updated in database`);
        results.success.push(prop.id);
      } catch (error) {
        console.error(`   ❌ Error updating database:`, error);
        results.failed.push({ id: prop.id, reason: `Database update failed: ${error}` });
      }

      // Rate limit - wait 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Summary
    console.log('\n\n📊 RESULTS:');
    console.log('='.repeat(80));
    console.log(`Total Processed: ${allIssues.length}`);
    console.log(`✅ Successfully Fixed: ${results.success.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⏭️  Skipped: ${results.skipped.length}`);

    if (results.failed.length > 0) {
      console.log('\n\n❌ FAILED PROPERTIES:');
      console.log('-'.repeat(80));
      results.failed.forEach((fail, index) => {
        console.log(`${index + 1}. Property ID: ${fail.id}`);
        console.log(`   Reason: ${fail.reason}`);
      });
    }

    // Save results
    fs.writeFileSync(
      'zip-code-fix-results.json',
      JSON.stringify(results, null, 2)
    );
    console.log('\n✅ Results saved to zip-code-fix-results.json');

    console.log('\n' + '='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (admin.apps.length > 0) {
      await admin.app().delete();
    }
  }
}

fixAndFillZipCodes();
