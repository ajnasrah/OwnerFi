/**
 * Check a specific Zillow property across all collections
 * Usage: npx ts-node scripts/check-zillow-property.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  })
});

const db = admin.firestore();

// Property to check
const ZPID = '299122';
const URL = 'https://www.zillow.com/homedetails/1201-W-49th-St-North-Little-Rock-AR-72118/299122_zpid/';

async function checkProperty() {
  console.log('\n=== Checking Property ZPID:', ZPID, '===\n');
  console.log('URL:', URL);
  console.log('');

  // 1. Check scraper_queue by URL
  console.log('--- 1. Checking scraper_queue (by URL) ---');
  const queueByUrl = await db.collection('scraper_queue')
    .where('url', '==', URL)
    .get();

  if (queueByUrl.empty) {
    // Try without trailing slash
    const urlNoSlash = URL.replace(/\/$/, '');
    const queueByUrl2 = await db.collection('scraper_queue')
      .where('url', '==', urlNoSlash)
      .get();

    if (queueByUrl2.empty) {
      console.log('NOT FOUND in scraper_queue');
    } else {
      console.log('FOUND in scraper_queue (without trailing slash):');
      queueByUrl2.forEach(doc => {
        const d = doc.data();
        console.log('  Doc ID:', doc.id);
        console.log('  Status:', d.status);
        console.log('  Added At:', d.addedAt?.toDate?.() || d.addedAt);
        console.log('  Source:', d.source);
        if (d.failureReason) console.log('  Failure Reason:', d.failureReason);
      });
    }
  } else {
    console.log('FOUND in scraper_queue:');
    queueByUrl.forEach(doc => {
      const d = doc.data();
      console.log('  Doc ID:', doc.id);
      console.log('  Status:', d.status);
      console.log('  Added At:', d.addedAt?.toDate?.() || d.addedAt);
      console.log('  Source:', d.source);
      if (d.failureReason) console.log('  Failure Reason:', d.failureReason);
    });
  }
  console.log('');

  // 2. Check zillow_imports by ZPID
  console.log('--- 2. Checking zillow_imports (by ZPID) ---');
  const zillowByZpid = await db.collection('zillow_imports')
    .where('zpid', '==', parseInt(ZPID))
    .get();

  if (zillowByZpid.empty) {
    // Also try string version
    const zillowByZpidStr = await db.collection('zillow_imports')
      .where('zpid', '==', ZPID)
      .get();

    if (zillowByZpidStr.empty) {
      console.log('NOT FOUND in zillow_imports');
      console.log('  -> This means the property FAILED the owner financing filter');
      console.log('  -> The listing description likely does NOT contain owner financing keywords');
    } else {
      printZillowImport(zillowByZpidStr);
    }
  } else {
    printZillowImport(zillowByZpid);
  }
  console.log('');

  // 3. Check properties collection
  console.log('--- 3. Checking properties collection ---');
  const propDocId = `zpid_${ZPID}`;
  const propDoc = await db.collection('properties').doc(propDocId).get();

  if (!propDoc.exists) {
    console.log('NOT FOUND in properties collection');
  } else {
    const d = propDoc.data()!;
    console.log('FOUND in properties:');
    console.log('  Address:', d.address || d.fullAddress);
    console.log('  Owner Finance Verified:', d.ownerFinanceVerified);
    console.log('  Is Active:', d.isActive);
    console.log('  Source:', d.source);
    console.log('  Matched Keywords:', d.matchedKeywords);
  }
  console.log('');

  // 4. Summary
  console.log('--- SUMMARY ---');
  console.log('The property upload process works as follows:');
  console.log('1. URL is added to scraper_queue');
  console.log('2. Apify scrapes the Zillow listing');
  console.log('3. STRICT FILTER checks if description contains owner financing keywords');
  console.log('4. Only if keywords found -> saved to zillow_imports');
  console.log('');
  console.log('If property is NOT in zillow_imports, check the Zillow listing description.');
  console.log('It must contain one of: "owner financing", "seller financing", "owner carry",');
  console.log('"rent to own", "lease option", "contract for deed", etc.');
}

function printZillowImport(snapshot: admin.firestore.QuerySnapshot) {
  console.log('FOUND in zillow_imports:');
  snapshot.forEach(doc => {
    const d = doc.data();
    console.log('  Doc ID:', doc.id);
    console.log('  Address:', d.fullAddress);
    console.log('  City/State:', d.city, d.state);
    console.log('  Price:', d.price);
    console.log('  Owner Finance Verified:', d.ownerFinanceVerified);
    console.log('  Matched Keywords:', d.matchedKeywords);
    console.log('  Primary Keyword:', d.primaryKeyword);
    console.log('  Description Preview:', d.description?.substring(0, 200) + '...');
    console.log('  Found At:', d.foundAt?.toDate?.() || d.foundAt);
  });
}

checkProperty()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
