import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [{ host: process.env.TYPESENSE_HOST || '', port: 443, protocol: 'https' }],
  apiKey: process.env.TYPESENSE_API_KEY || '',
  connectionTimeoutSeconds: 5,
});

async function check() {
  const all = await client.collections('properties').documents().search({ q: '*', query_by: 'address', per_page: 0 });
  console.log('Total properties:', all.found);

  const active = await client.collections('properties').documents().search({ q: '*', query_by: 'address', filter_by: 'isActive:=true', per_page: 0 });
  console.log('Active:', active.found);

  const notLand = await client.collections('properties').documents().search({ q: '*', query_by: 'address', filter_by: 'isActive:=true && isLand:=false', per_page: 0 });
  console.log('Active non-land:', notLand.found);

  const withBeds = await client.collections('properties').documents().search({ q: '*', query_by: 'address', filter_by: 'isActive:=true && isLand:=false && bedrooms:>0', per_page: 10, include_fields: 'address,city,state,listPrice,bedrooms,bathrooms,squareFeet,primaryImage,isLand' });
  console.log('Non-land with beds>0:', withBeds.found);
  for (const h of (withBeds.hits || [])) {
    const d = h.document as any;
    console.log(`  ${d.address}, ${d.city}, ${d.state} — $${d.listPrice} | ${d.bedrooms}bd/${d.bathrooms}ba | img: ${d.primaryImage ? 'yes' : 'no'}`);
  }

  const land = await client.collections('properties').documents().search({ q: '*', query_by: 'address', filter_by: 'isActive:=true && isLand:=true', per_page: 0 });
  console.log('\nLand parcels:', land.found);

  // Also check without isLand filter but with bedrooms
  const anyWithBeds = await client.collections('properties').documents().search({ q: '*', query_by: 'address', filter_by: 'isActive:=true && bedrooms:>0', per_page: 10, include_fields: 'address,city,state,listPrice,bedrooms,primaryImage,isLand,propertyType' });
  console.log('\nActive with beds>0 (any):', anyWithBeds.found);
  for (const h of (anyWithBeds.hits || [])) {
    const d = h.document as any;
    console.log(`  ${d.address}, ${d.city}, ${d.state} — $${d.listPrice} | ${d.bedrooms}bd | land:${d.isLand} | type:${d.propertyType} | img:${d.primaryImage ? 'yes' : 'no'}`);
  }
}
check().catch(console.error);
