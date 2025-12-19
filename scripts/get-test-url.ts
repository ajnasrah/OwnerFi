import { getAdminDb } from '../src/lib/firebase-admin';
import { generateSlug } from '../src/lib/property-seo';

async function getTestUrl() {
  const db = await getAdminDb();
  if (!db) {
    console.log('No DB');
    return;
  }

  const snap = await db.collection('zillow_imports').limit(1).get();
  if (snap.empty) {
    console.log('No properties found');
    return;
  }

  const doc = snap.docs[0];
  const data = doc.data();
  
  console.log('Property data:');
  console.log('  zpid:', data.zpid);
  console.log('  streetAddress:', data.streetAddress);
  console.log('  city:', data.city);
  console.log('  state:', data.state);
  console.log('  imgSrc:', data.imgSrc);
  
  const slug = generateSlug({
    address: data.streetAddress || data.fullAddress,
    city: data.city,
    state: data.state,
    id: data.zpid || doc.id
  });
  
  console.log('\nTest URL:');
  console.log('  http://localhost:3000/property/' + slug);
}

getTestUrl().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
