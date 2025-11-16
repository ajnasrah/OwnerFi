/**
 * Check existing properties in zillow_imports to see their current state
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

async function checkExistingProperties() {
  console.log('🔍 Checking Existing Properties in zillow_imports\n');
  console.log('=' .repeat(80));

  // Get sample properties
  const snapshot = await db
    .collection('zillow_imports')
    .limit(10)
    .get();

  console.log(`\nTotal properties in zillow_imports: ${snapshot.size} (showing first 10)`);
  console.log('\n📋 Sample Properties:\n');

  snapshot.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log(`[${i + 1}] ${data.fullAddress || 'No address'}`);
    console.log(`   ZPID: ${data.zpid || 'N/A'}`);
    console.log(`   Status: ${data.status || 'NOT SET'}`);
    console.log(`   Owner Finance Verified: ${data.ownerFinanceVerified || 'NOT SET'}`);
    console.log(`   Primary Keyword: ${data.primaryKeyword || 'NOT SET'}`);
    console.log(`   Matched Keywords: ${data.matchedKeywords?.join(', ') || 'NOT SET'}`);
    console.log(`   Sent to GHL: ${data.sentToGHL || false}`);
    console.log(`   Description preview: ${(data.description || '').substring(0, 100)}...`);
    console.log('');
  });

  // Count properties by field existence
  const allSnapshot = await db.collection('zillow_imports').get();

  let withStatus = 0;
  let withKeywords = 0;
  let withOldData = 0;

  allSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.status) withStatus++;
    if (data.primaryKeyword || data.matchedKeywords) withKeywords++;
    if (!data.status && !data.primaryKeyword) withOldData++;
  });

  console.log('=' .repeat(80));
  console.log('📊 PROPERTY ANALYSIS');
  console.log('=' .repeat(80));
  console.log(`Total properties: ${allSnapshot.size.toLocaleString()}`);
  console.log(`With 'status' field (NEW): ${withStatus.toLocaleString()}`);
  console.log(`With keywords (NEW): ${withKeywords.toLocaleString()}`);
  console.log(`Old properties (no status/keywords): ${withOldData.toLocaleString()}`);
  console.log('=' .repeat(80));

  console.log('\n💡 RECOMMENDATION:');
  if (withOldData > 0) {
    console.log(`You have ${withOldData.toLocaleString()} old properties without the new fields.`);
    console.log('Options:');
    console.log('1. Run migration script to add status/keywords to existing properties');
    console.log('2. Delete old properties and re-scrape with new system');
    console.log('3. Keep old properties hidden until re-scraped');
  }
}

checkExistingProperties().catch(console.error);
