import { getAdminDb } from '../src/lib/firebase-admin';
import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '../src/lib/typesense/client';

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

function getStreetViewUrl(address: string, city: string, state: string): string {
  if (!GOOGLE_MAPS_KEY) return '';
  const fullAddress = address + ', ' + city + ', ' + state;
  return 'https://maps.googleapis.com/maps/api/streetview?size=800x600&location=' + encodeURIComponent(fullAddress) + '&key=' + GOOGLE_MAPS_KEY;
}

async function massFixImages() {
  const db = await getAdminDb();
  const client = getTypesenseAdminClient();

  if (!db || !client) {
    console.log('Missing DB or Typesense client');
    return;
  }

  if (!GOOGLE_MAPS_KEY) {
    console.log('ERROR: No GOOGLE_MAPS_API_KEY - cannot add Street View images');
    return;
  }

  console.log('Mass fixing ALL missing images with Street View...\n');

  // Get ALL properties missing images from Typesense
  let page = 1;
  let totalFixed = 0;
  let totalMissing = 0;

  while (true) {
    const results = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
      .documents()
      .search({
        q: '*',
        query_by: 'address',
        filter_by: 'isActive:=true',
        per_page: 250,
        page,
        include_fields: 'id,address,city,state,primaryImage'
      });

    if (!results.hits || results.hits.length === 0) break;

    for (const hit of results.hits) {
      const doc = hit.document as any;
      
      // Check if missing image
      if (doc.primaryImage && doc.primaryImage.length > 10) continue;

      totalMissing++;

      const streetViewUrl = getStreetViewUrl(doc.address || '', doc.city || '', doc.state || '');
      if (!streetViewUrl) continue;

      // Update Typesense only (faster, and Firestore will be updated on next scrape)
      try {
        await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
          .documents(doc.id)
          .update({ primaryImage: streetViewUrl });
        totalFixed++;
      } catch (e) {
        // OK
      }
    }

    console.log('Page ' + page + ': Found ' + totalMissing + ' missing, fixed ' + totalFixed);
    page++;
    if (page > 50) break;
  }

  console.log('\n=== COMPLETE ===');
  console.log('Total missing images found: ' + totalMissing);
  console.log('Total fixed with Street View: ' + totalFixed);
}

massFixImages().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
