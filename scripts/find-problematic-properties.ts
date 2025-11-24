/**
 * Find problematic properties in the database:
 * 1. False positives - marked as owner finance but explicitly say NO owner financing
 * 2. Missing descriptions
 * 3. Not owner finance - don't have owner financing keywords
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { hasOwnerFinancing, getFilterExplanation } from '../src/lib/owner-financing-filter';
import { detectNegativeFinancing } from '../src/lib/negative-financing-detector';

// Initialize Firebase
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('❌ Missing FIREBASE_PROJECT_ID environment variable');
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

interface PropertyData {
  id: string;
  address?: string;
  fullAddress?: string;
  street?: string;
  city?: string;
  state?: string;
  description?: string;
  listPrice?: number;
  price?: number;
  status?: string;
  isActive?: boolean;
  createdAt?: any;
  opportunityId?: string;
  zpid?: string | number;
  sentToGHL?: boolean;
}

interface ProblematicProperty {
  id: string;
  address: string;
  price: number;
  issue: string;
  details: string;
  descriptionPreview: string;
}

// Get collection name from command line args or default to zillow_imports
const collectionName = process.argv[2] || 'zillow_imports';

async function findProblematicProperties() {
  console.log('🔍 Finding Problematic Properties in Database\n');
  console.log(`📁 Collection: ${collectionName}`);
  console.log('='.repeat(80));

  // Query all properties from specified collection
  const snapshot = await db.collection(collectionName).get();

  console.log(`\n📊 Total properties in database: ${snapshot.size}\n`);

  const falsePositives: ProblematicProperty[] = [];
  const noDescription: ProblematicProperty[] = [];
  const notOwnerFinance: ProblematicProperty[] = [];
  const validOwnerFinance: ProblematicProperty[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data() as PropertyData;
    const id = doc.id;
    const address = data.fullAddress || data.address || data.street || (data.city && data.state ? `${data.city}, ${data.state}` : 'Unknown');
    const price = data.listPrice || data.price || 0;
    const description = data.description || '';
    const descriptionPreview = description.substring(0, 200).replace(/\n/g, ' ') || 'NO DESCRIPTION';

    // Check for missing description
    if (!description || description.trim().length === 0) {
      noDescription.push({
        id,
        address,
        price,
        issue: 'NO DESCRIPTION',
        details: 'Property has no description to analyze',
        descriptionPreview: 'EMPTY',
      });
      return;
    }

    // Check for negative financing indicators (false positives)
    const negativeResult = detectNegativeFinancing(description);
    if (negativeResult.isNegative) {
      falsePositives.push({
        id,
        address,
        price,
        issue: 'FALSE POSITIVE - EXPLICITLY NO OWNER FINANCING',
        details: `${negativeResult.reason}: ${negativeResult.matchedPattern || ''}`,
        descriptionPreview,
      });
      return;
    }

    // Check if property has owner financing keywords
    const filterResult = hasOwnerFinancing(description);
    if (!filterResult.shouldSend) {
      notOwnerFinance.push({
        id,
        address,
        price,
        issue: 'NOT OWNER FINANCE',
        details: filterResult.reason,
        descriptionPreview,
      });
      return;
    }

    // Valid owner finance property
    validOwnerFinance.push({
      id,
      address,
      price,
      issue: 'VALID',
      details: getFilterExplanation(description),
      descriptionPreview,
    });
  });

  // Print Summary
  console.log('='.repeat(80));
  console.log('📈 RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Valid owner financing properties: ${validOwnerFinance.length}`);
  console.log(`❌ FALSE POSITIVES (say NO owner financing): ${falsePositives.length}`);
  console.log(`⚠️  NO DESCRIPTION: ${noDescription.length}`);
  console.log(`📝 NOT OWNER FINANCE (no keywords): ${notOwnerFinance.length}`);
  console.log('='.repeat(80));

  // Show False Positives
  if (falsePositives.length > 0) {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('❌ FALSE POSITIVES - Properties that explicitly say NO owner financing');
    console.log('='.repeat(80));

    falsePositives.forEach((prop, i) => {
      console.log(`\n[${i + 1}/${falsePositives.length}]`);
      console.log(`ID: ${prop.id}`);
      console.log(`Address: ${prop.address}`);
      console.log(`Price: $${prop.price.toLocaleString()}`);
      console.log(`Issue: ${prop.details}`);
      console.log(`Description: ${prop.descriptionPreview}...`);
      console.log('-'.repeat(80));
    });
  }

  // Show No Description
  if (noDescription.length > 0) {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('⚠️  PROPERTIES WITH NO DESCRIPTION');
    console.log('='.repeat(80));

    const samplesToShow = Math.min(20, noDescription.length);
    noDescription.slice(0, samplesToShow).forEach((prop, i) => {
      console.log(`\n[${i + 1}/${samplesToShow}]`);
      console.log(`ID: ${prop.id}`);
      console.log(`Address: ${prop.address}`);
      console.log(`Price: $${prop.price.toLocaleString()}`);
      console.log('-'.repeat(80));
    });

    if (noDescription.length > samplesToShow) {
      console.log(`\n... and ${noDescription.length - samplesToShow} more properties without descriptions`);
    }
  }

  // Show Not Owner Finance
  if (notOwnerFinance.length > 0) {
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📝 NOT OWNER FINANCE - Properties without owner financing keywords');
    console.log('='.repeat(80));

    const samplesToShow = Math.min(20, notOwnerFinance.length);
    notOwnerFinance.slice(0, samplesToShow).forEach((prop, i) => {
      console.log(`\n[${i + 1}/${samplesToShow}]`);
      console.log(`ID: ${prop.id}`);
      console.log(`Address: ${prop.address}`);
      console.log(`Price: $${prop.price.toLocaleString()}`);
      console.log(`Reason: ${prop.details}`);
      console.log(`Description: ${prop.descriptionPreview}...`);
      console.log('-'.repeat(80));
    });

    if (notOwnerFinance.length > samplesToShow) {
      console.log(`\n... and ${notOwnerFinance.length - samplesToShow} more properties without owner financing`);
    }
  }

  // Export to JSON for further analysis
  const results = {
    summary: {
      total: snapshot.size,
      validOwnerFinance: validOwnerFinance.length,
      falsePositives: falsePositives.length,
      noDescription: noDescription.length,
      notOwnerFinance: notOwnerFinance.length,
    },
    falsePositives,
    noDescription,
    notOwnerFinance,
  };

  const fs = require('fs');
  fs.writeFileSync('/tmp/problematic-properties.json', JSON.stringify(results, null, 2));
  console.log('\n\n📄 Full results exported to /tmp/problematic-properties.json');

  // Export IDs for easy deletion
  if (falsePositives.length > 0 || noDescription.length > 0 || notOwnerFinance.length > 0) {
    const problematicIds = {
      falsePositiveIds: falsePositives.map(p => p.id),
      noDescriptionIds: noDescription.map(p => p.id),
      notOwnerFinanceIds: notOwnerFinance.map(p => p.id),
    };
    fs.writeFileSync('/tmp/problematic-property-ids.json', JSON.stringify(problematicIds, null, 2));
    console.log('📄 Property IDs exported to /tmp/problematic-property-ids.json');
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 RECOMMENDATIONS');
  console.log('='.repeat(80));

  if (falsePositives.length > 0) {
    console.log(`\n❌ ${falsePositives.length} FALSE POSITIVES should be removed or marked as invalid`);
    console.log('   These properties explicitly state NO owner financing is available');
  }

  if (noDescription.length > 0) {
    console.log(`\n⚠️  ${noDescription.length} properties have NO DESCRIPTION`);
    console.log('   Consider adding descriptions or removing these properties');
  }

  if (notOwnerFinance.length > 0) {
    console.log(`\n📝 ${notOwnerFinance.length} properties have NO owner financing keywords`);
    console.log('   Review these to determine if they should be in the database');
  }

  console.log('\n' + '='.repeat(80));
}

// Run the analysis
findProblematicProperties().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
