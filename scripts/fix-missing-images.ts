import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST || '', port: 443, protocol: 'https' }],
  apiKey: process.env.TYPESENSE_API_KEY || ''
});

function getStreetViewUrl(address: string, city: string, state: string, zip: string): string {
  const fullAddress = `${address}, ${city}, ${state} ${zip}`;
  const encoded = encodeURIComponent(fullAddress);
  return `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encoded}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
}

async function fix() {
  // Find missing images
  let page = 1;
  const missing: any[] = [];

  while (true) {
    const result = await client.collections('properties').documents().search({
      q: '*',
      query_by: 'address',
      filter_by: 'isActive:=true',
      per_page: 250,
      page: page,
      include_fields: 'id,address,city,state,primaryImage,zipCode'
    });

    const hits = result.hits || [];
    if (hits.length === 0) break;

    hits.forEach((h: any) => {
      const img = h.document.primaryImage;
      if (img === undefined || img === null || img === '') {
        missing.push(h.document);
      }
    });

    page++;
    if (page > 30) break;
  }

  console.log('Found', missing.length, 'properties missing images');

  // Fix each one with Street View
  for (const doc of missing) {
    const streetViewUrl = getStreetViewUrl(doc.address, doc.city, doc.state, doc.zipCode || '');
    console.log('Fixing:', doc.id, '-', doc.address);

    try {
      await client.collections('properties').documents(doc.id).update({
        primaryImage: streetViewUrl
      });
      console.log('  ✓ Updated with Street View');
    } catch (err: any) {
      console.log('  ✗ Error:', err.message);
    }
  }

  console.log('\nDone! Fixed', missing.length, 'properties');
}

fix();
