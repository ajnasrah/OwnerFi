import { getAdminDb } from '../src/lib/firebase-admin';

async function check() {
  const db = await getAdminDb();
  if (!db) {
    console.log('No DB');
    return;
  }

  console.log('=== Checking zillow_imports ===');
  const zillowSnap = await db.collection('zillow_imports').limit(3).get();
  zillowSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log('---');
    console.log('zpid:', d.zpid);
    console.log('imgSrc:', d.imgSrc?.substring(0, 100));
    console.log('firstPropertyImage:', d.firstPropertyImage?.substring(0, 100));
    console.log('propertyImages count:', d.propertyImages?.length || 0);
  });

  console.log('\n=== Checking cash_houses ===');
  const cashSnap = await db.collection('cash_houses').limit(3).get();
  cashSnap.docs.forEach(doc => {
    const d = doc.data();
    console.log('---');
    console.log('zpid:', d.zpid);
    console.log('imgSrc:', d.imgSrc?.substring(0, 100));
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
