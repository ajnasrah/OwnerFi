import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '../src/lib/typesense/client';

async function main() {
  const c = getTypesenseAdminClient()!;
  const d: any = await c.collections(TYPESENSE_COLLECTIONS.PROPERTIES).documents('zpid_72796327').retrieve();
  console.log('Full Typesense doc for 1950 Johnson:');
  console.log(JSON.stringify(d, null, 2));

  // Also search: does OF filter pick it up?
  const searchRes: any = await c.collections(TYPESENSE_COLLECTIONS.PROPERTIES).documents().search({
    q: '1950 Johnson',
    query_by: 'address',
    filter_by: 'dealType:=owner_finance && isActive:=true',
  });
  console.log(`\nOF-filtered search result: found=${searchRes.found}`);
  if (searchRes.hits?.[0]) {
    console.log(`  first hit: ${searchRes.hits[0].document.id} ${searchRes.hits[0].document.address}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
