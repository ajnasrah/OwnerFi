import { getAdminDb } from '../src/lib/firebase-admin';
import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '../src/lib/typesense/client';

async function syncImages() {
  const db = await getAdminDb();
  const client = getTypesenseAdminClient();

  if (!db || !client) {
    console.log('No DB or Typesense client');
    return;
  }

  console.log('Syncing images from zillow_imports to Typesense...');

  const snap = await db.collection('zillow_imports')
    .where('status', '==', 'active')
    .limit(100)
    .get();

  let updated = 0;
  let noImage = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const primaryImage = data.firstPropertyImage || data.imgSrc || data.imageUrl || '';

    if (!primaryImage) {
      noImage++;
      continue;
    }

    const zpid = data.zpid;
    const docId = String(zpid || doc.id);

    try {
      await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
        .documents(docId)
        .update({ primaryImage });
      updated++;
    } catch (e: any) {
      // Document might not exist in Typesense
      if (e.httpStatus !== 404) {
        console.error('Error updating:', docId, e.message);
      }
    }
  }

  console.log(`Updated ${updated} documents, ${noImage} had no image`);
}

syncImages().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
