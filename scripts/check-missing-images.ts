import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST || '', port: 443, protocol: 'https' }],
  apiKey: process.env.TYPESENSE_API_KEY || ''
});

async function check() {
  // Scan all active properties
  let page = 1;
  let allMissing: any[] = [];
  let total = 0;

  while (true) {
    const result = await client.collections('properties').documents().search({
      q: '*',
      query_by: 'address',
      filter_by: 'isActive:=true',
      per_page: 250,
      page: page,
      include_fields: 'id,address,city,state,primaryImage,zipCode'
    });

    if (page === 1) total = result.found || 0;

    const hits = result.hits || [];
    if (hits.length === 0) break;

    hits.forEach((h: any) => {
      const img = h.document.primaryImage;
      if (img === undefined || img === null || img === '') {
        allMissing.push(h.document);
      }
    });

    page++;
    if (page > 30) break; // Safety limit
  }

  console.log('Total active:', total);
  console.log('Missing images:', allMissing.length);
  console.log('\nProperties missing images:');
  allMissing.forEach((d: any) => {
    console.log('-', d.id, '|', d.address, '|', d.city, d.state, d.zipCode);
  });

  return allMissing;
}

check();
