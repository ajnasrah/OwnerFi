#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST!,
    port: 443,
    protocol: 'https'
  }],
  apiKey: process.env.TYPESENSE_API_KEY!,
  connectionTimeoutSeconds: 10
});

async function main() {
  // Check collection stats
  const collection = await client.collections('properties').retrieve();
  console.log('Typesense collection stats:');
  console.log('  Total documents:', collection.num_documents);

  // Search for all properties and check their dealType
  const result = await client.collections('properties').documents().search({
    q: '*',
    query_by: 'city',
    per_page: 250,
    include_fields: 'id,address,city,dealType,primaryImage'
  });

  let ownerFinance = 0;
  let cashDeal = 0;
  let both = 0;
  let other = 0;
  let hasImage = 0;

  const hits = result.hits || [];
  hits.forEach((hit: any) => {
    const doc = hit.document;
    if (doc.dealType === 'owner_finance') ownerFinance++;
    else if (doc.dealType === 'cash_deal') cashDeal++;
    else if (doc.dealType === 'both') both++;
    else other++;

    if (doc.primaryImage) hasImage++;
  });

  console.log('\n=== TYPESENSE BREAKDOWN ===');
  console.log('owner_finance:', ownerFinance);
  console.log('cash_deal:', cashDeal);
  console.log('both:', both);
  console.log('other/undefined:', other);
  console.log('Has primaryImage:', hasImage);

  // Show sample with no image
  const noImage = hits.filter((h: any) => !h.document.primaryImage).slice(0, 3);
  console.log('\nSample properties WITHOUT image:');
  noImage.forEach((h: any) => {
    console.log(' -', h.document.address, h.document.city);
  });
}

main().catch(console.error);
