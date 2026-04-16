import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getTypesenseAdminClient, TYPESENSE_COLLECTIONS } from '../src/lib/typesense/client';

async function main() {
  const c = getTypesenseAdminClient()!;
  const ids = ['zpid_72813298', 'zpid_72796327'];  // 530 5th St, 1950 Johnson
  const labels = ['530 5th St (SHOWING)', '1950 Johnson St (NOT SHOWING)'];

  for (let i = 0; i < ids.length; i++) {
    const d: any = await c.collections(TYPESENSE_COLLECTIONS.PROPERTIES).documents(ids[i]).retrieve();
    console.log(`\n=== ${labels[i]} | ${ids[i]} ===`);
    const fields = ['address', 'city', 'state', 'zipCode', 'listPrice', 'zestimate', 'percentOfArv',
      'dealType', 'isActive', 'isLand', 'isAuction', 'isForeclosure', 'isBankOwned', 'isFixer',
      'propertyType', 'bedrooms', 'bathrooms', 'squareFeet'];
    for (const f of fields) console.log(`  ${f.padEnd(18)}: ${d[f]}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
