import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '../src/lib/typesense/client';

async function main() {
  const client = getTypesenseAdminClient();
  if (!client) { console.log('No Typesense client'); return; }

  const doc: any = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES).documents('zpid_904492').retrieve();
  console.log('=== Typesense zpid_904492 full document ===');
  console.log(JSON.stringify(doc, null, 2));

  // Also compare to a known-working one (e.g., 2617 Hancock that the user saw in the screenshot)
  console.log('\n\n=== Compare: zpid_34964453 (2617 Hancock, working) ===');
  const good: any = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES).documents('zpid_34964453').retrieve();
  console.log(JSON.stringify(good, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
