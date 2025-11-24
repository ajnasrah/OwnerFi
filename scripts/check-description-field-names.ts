import * as dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load environment variables
dotenv.config({ path: '.env.local' });

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

async function checkDescriptionFields() {
  console.log('\n🔍 CHECKING DESCRIPTION FIELD NAMES AND VALUES\n');
  console.log('='.repeat(80));

  // Get recent properties
  const recentProperties = await db
    .collection('zillow_imports')
    .orderBy('foundAt', 'desc')
    .limit(20)
    .get();

  console.log(`\n📦 Checking ${recentProperties.size} most recent properties\n`);

  const fieldNames = new Set<string>();
  let noDescriptionCount = 0;
  let emptyDescriptionCount = 0;
  let hasDescriptionCount = 0;

  console.log('SAMPLE PROPERTIES:');
  console.log('-'.repeat(80));

  recentProperties.docs.forEach((doc, idx) => {
    const data = doc.data();

    // Collect all field names
    Object.keys(data).forEach(key => fieldNames.add(key));

    // Check for description-related fields
    const description = data.description;
    const desc = data.desc;
    const remarks = data.remarks;
    const propertyDescription = data.propertyDescription;

    if (idx < 5) {
      console.log(`\n${idx + 1}. ${data.fullAddress || 'No address'}`);
      console.log(`   ZPID: ${data.zpid}`);
      console.log(`   description field: ${description ? `"${description.substring(0, 100)}..."` : 'NULL/UNDEFINED'}`);
      console.log(`   description length: ${description?.length || 0}`);
      console.log(`   desc field: ${desc ? 'EXISTS' : 'NO'}`);
      console.log(`   remarks field: ${remarks ? 'EXISTS' : 'NO'}`);
      console.log(`   propertyDescription field: ${propertyDescription ? 'EXISTS' : 'NO'}`);
      console.log(`   Owner Finance Verified: ${data.ownerFinanceVerified}`);
      console.log(`   Matched Keywords: ${data.matchedKeywords?.join(', ') || 'None'}`);
    }

    // Count descriptions
    if (!description) {
      noDescriptionCount++;
    } else if (typeof description === 'string' && description.trim().length === 0) {
      emptyDescriptionCount++;
    } else if (typeof description === 'string' && description.trim().length > 0) {
      hasDescriptionCount++;
    }
  });

  console.log('\n\n📊 DESCRIPTION STATISTICS (Recent 20 Properties)');
  console.log('-'.repeat(80));
  console.log(`✅ Has description: ${hasDescriptionCount}`);
  console.log(`❌ No description (null/undefined): ${noDescriptionCount}`);
  console.log(`⚠️  Empty description: ${emptyDescriptionCount}`);

  console.log('\n\n📋 ALL FIELD NAMES IN ZILLOW_IMPORTS:');
  console.log('-'.repeat(80));
  const sortedFields = Array.from(fieldNames).sort();
  sortedFields.forEach(field => {
    console.log(`   - ${field}`);
  });

  // Check property transformation
  console.log('\n\n🔍 CHECKING PROPERTY TRANSFORM LOGIC');
  console.log('-'.repeat(80));

  try {
    const transformPath = '/Users/abdullahabunasrah/Desktop/ownerfi/src/lib/property-transform.ts';
    console.log(`Reading: ${transformPath}`);
    console.log('(Check this file to see how "description" field is mapped from Apify data)');
  } catch (error) {
    console.log('Could not read transform file');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis complete!\n');
}

// Run the analysis
checkDescriptionFields()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
