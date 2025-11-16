/**
 * Check What Data Fields Are Actually Populated
 * Analyzes zillow_imports to see what data exists
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function checkDataFields() {
  console.log('🔍 CHECKING WHAT DATA IS ACTUALLY POPULATED\n');
  console.log('=' .repeat(80));

  const snapshot = await db
    .collection('zillow_imports')
    .where('ownerFinanceVerified', '==', true)
    .limit(50)
    .get();

  const properties = snapshot.docs.map(doc => doc.data());

  console.log(`\nAnalyzing ${properties.length} properties...\n`);

  // Check which fields exist and how often
  const fieldStats: any = {};

  properties.forEach((prop: any) => {
    Object.keys(prop).forEach(field => {
      if (!fieldStats[field]) {
        fieldStats[field] = {
          count: 0,
          hasValue: 0,
          sampleValues: []
        };
      }
      fieldStats[field].count++;

      const value = prop[field];
      if (value !== null && value !== undefined && value !== '') {
        fieldStats[field].hasValue++;
        if (fieldStats[field].sampleValues.length < 3) {
          fieldStats[field].sampleValues.push(value);
        }
      }
    });
  });

  // Sort by how often field has values
  const sortedFields = Object.entries(fieldStats)
    .sort((a: any, b: any) => b[1].hasValue - a[1].hasValue);

  console.log('📊 FIELD ANALYSIS (out of 50 properties):\n');
  console.log('Field Name                    | Present | Has Value | % Populated');
  console.log('-'.repeat(80));

  sortedFields.forEach(([field, stats]: [string, any]) => {
    const percent = Math.round((stats.hasValue / properties.length) * 100);
    const fieldName = field.padEnd(28);
    const present = String(stats.count).padStart(7);
    const hasValue = String(stats.hasValue).padStart(9);
    const pct = String(percent + '%').padStart(11);
    console.log(`${fieldName} | ${present} | ${hasValue} | ${pct}`);
  });

  // Show sample property with ALL fields
  console.log('\n\n' + '=' .repeat(80));
  console.log('📄 SAMPLE PROPERTY WITH ALL FIELDS');
  console.log('=' .repeat(80));

  const sample = properties[0];
  console.log('\nProperty:', sample.fullAddress || sample.streetAddress);
  console.log('\nAll available fields:\n');

  Object.entries(sample).forEach(([key, value]) => {
    let displayValue = value;

    if (value === null) displayValue = '❌ null';
    else if (value === undefined) displayValue = '❌ undefined';
    else if (value === '') displayValue = '❌ empty string';
    else if (Array.isArray(value)) displayValue = `✅ [${value.length} items]`;
    else if (typeof value === 'object') displayValue = '✅ [object]';
    else if (typeof value === 'string' && value.length > 50) displayValue = `✅ "${value.substring(0, 50)}..."`;
    else displayValue = `✅ ${value}`;

    console.log(`   ${key}: ${displayValue}`);
  });

  // Check specific important fields
  console.log('\n\n' + '=' .repeat(80));
  console.log('🎯 IMPORTANT FIELDS STATUS');
  console.log('=' .repeat(80));

  const importantFields = [
    'fullAddress',
    'streetAddress',
    'city',
    'state',
    'zipCode',
    'price',
    'bedrooms',
    'bathrooms',
    'squareFeet',
    'lotSize',
    'yearBuilt',
    'description',
    'imageUrls',
    'zillowImageUrl',
    'imgSrc',
    'primaryKeyword',
    'matchedKeywords',
    'monthlyPayment',
    'downPaymentAmount',
    'interestRate',
    'loanTermYears',
    'status',
    'zpid',
    'zillowUrl'
  ];

  console.log('\nField                | Populated in    | Status');
  console.log('-'.repeat(70));

  importantFields.forEach(field => {
    const stats = fieldStats[field];
    if (!stats) {
      console.log(`${field.padEnd(19)} | 0/50            | ❌ MISSING FROM ALL`);
    } else {
      const populated = `${stats.hasValue}/${properties.length}`.padEnd(15);
      const status = stats.hasValue === properties.length ? '✅ ALWAYS' :
                     stats.hasValue > properties.length * 0.8 ? '🟡 MOSTLY' :
                     stats.hasValue > 0 ? '🟠 SOMETIMES' : '❌ NEVER';
      console.log(`${field.padEnd(19)} | ${populated} | ${status}`);
    }
  });

  console.log('\n' + '=' .repeat(80));
}

checkDataFields().catch(console.error);
