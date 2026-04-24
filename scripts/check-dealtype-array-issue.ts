import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

async function checkDealTypeArrayIssue() {
  console.log('=== CHECKING DEALTYPE vs DEALTYPES ARRAY ISSUE ===\n');
  
  const sample = await db.collection('properties')
    .where('isActive', '==', true)
    .limit(100)
    .get();
  
  let stats = {
    total: 0,
    hasDealType: 0,       // Old single field
    hasDealTypes: 0,      // New array field
    hasBoth: 0,
    hasNeither: 0,
    dealTypeString: 0,
    dealTypesArray: 0,
  };
  
  console.log('Checking first 100 active properties...\n');
  
  sample.docs.forEach(doc => {
    const data = doc.data();
    stats.total++;
    
    const hasDealType = data.dealType !== undefined && data.dealType !== null;
    const hasDealTypes = data.dealTypes !== undefined && data.dealTypes !== null;
    
    if (hasDealType) stats.hasDealType++;
    if (hasDealTypes) stats.hasDealTypes++;
    if (hasDealType && hasDealTypes) stats.hasBoth++;
    if (!hasDealType && !hasDealTypes) stats.hasNeither++;
    
    if (hasDealType && typeof data.dealType === 'string') stats.dealTypeString++;
    if (hasDealTypes && Array.isArray(data.dealTypes)) stats.dealTypesArray++;
    
    // Show first few examples
    if (stats.total <= 5) {
      console.log(`Property ${doc.id}:`);
      console.log(`  dealType (old): ${JSON.stringify(data.dealType)}`);
      console.log(`  dealTypes (new): ${JSON.stringify(data.dealTypes)}`);
      console.log(`  isOwnerFinance: ${data.isOwnerFinance}`);
      console.log(`  isCashDeal: ${data.isCashDeal}`);
      console.log();
    }
  });
  
  console.log('=== STATS ===');
  console.log(`Total checked: ${stats.total}`);
  console.log(`Has dealType (old single): ${stats.hasDealType} (${Math.round(stats.hasDealType/stats.total*100)}%)`);
  console.log(`Has dealTypes (new array): ${stats.hasDealTypes} (${Math.round(stats.hasDealTypes/stats.total*100)}%)`);
  console.log(`Has both: ${stats.hasBoth}`);
  console.log(`Has neither: ${stats.hasNeither}`);
  console.log(`dealType is string: ${stats.dealTypeString}`);
  console.log(`dealTypes is array: ${stats.dealTypesArray}`);
  
  // Check what the API is looking for
  console.log('\n=== CHECKING API EXPECTATIONS ===');
  console.log('The buyer/properties API filters for: dealType:=[owner_finance, both]');
  console.log('This expects the OLD single dealType field!');
  
  if (stats.hasDealType > stats.hasDealTypes) {
    console.log('\n✅ Most properties have the OLD dealType field (which the API uses)');
    console.log('The migration scripts I ran actually FIXED the issue by populating dealType');
  } else if (stats.hasDealTypes > stats.hasDealType) {
    console.log('\n❌ Most properties only have the NEW dealTypes array');
    console.log('The API needs to be updated to use dealTypes array OR');
    console.log('We need to populate the old dealType field from dealTypes array');
  }
  
  // Check recent properties added
  console.log('\n=== CHECKING RECENTLY ADDED PROPERTIES ===');
  const recent = await db.collection('properties')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  
  console.log('Last 10 properties added:');
  recent.docs.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?._seconds ? new Date(data.createdAt._seconds * 1000) : null;
    console.log(`  ${createdAt?.toLocaleDateString() || 'Unknown'}: dealType=${data.dealType}, dealTypes=${JSON.stringify(data.dealTypes)}`);
  });
}

checkDealTypeArrayIssue().then(() => {
  console.log('\n✅ Analysis complete!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});