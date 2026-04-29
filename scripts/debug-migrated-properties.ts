/**
 * Debug migrated properties to see why 0 qualified through the unified filter
 * 
 * Usage: npx tsx scripts/debug-migrated-properties.ts
 */

import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { runUnifiedFilter } from '../src/lib/scraper-v2/unified-filter';

async function debugMigratedProperties() {
  console.log('🔍 Debugging migrated properties...');
  
  const { db } = getFirebaseAdmin();
  
  // Get a few migrated properties to examine
  const snapshot = await db.collection('properties')
    .where('migratedFromSnapshot', '==', true)
    .limit(5)
    .get();
  
  console.log(`Found ${snapshot.size} migrated properties to examine\n`);
  
  snapshot.forEach((doc, index) => {
    const data = doc.data();
    
    console.log(`=== PROPERTY ${index + 1} ===`);
    console.log(`ID: ${doc.id}`);
    console.log(`Address: ${data.address || data.fullAddress || 'Unknown'}`);
    console.log(`Price: $${data.price?.toLocaleString() || 'Unknown'}`);
    console.log(`Zestimate: $${data.zestimate?.toLocaleString() || 'Unknown'}`);
    console.log(`Home Type: ${data.homeType || 'Unknown'}`);
    console.log(`Description: "${(data.description || '').substring(0, 200)}..."`);
    
    // Run unified filter
    const filterResult = runUnifiedFilter(
      data.description,
      data.price,
      data.zestimate,
      data.homeType,
      {
        isAuction: data.isAuction,
        isForeclosure: data.isForeclosure,
        isBankOwned: data.isBankOwned
      }
    );
    
    console.log(`\nFILTER RESULTS:`);
    console.log(`  Should Save: ${filterResult.shouldSave}`);
    console.log(`  Owner Finance: ${filterResult.passesOwnerfinance}`);
    console.log(`  Cash Deal: ${filterResult.passesCashDeal}`);
    console.log(`  Deal Types: [${filterResult.dealTypes.join(', ')}]`);
    
    if (filterResult.passesOwnerfinance) {
      console.log(`  OF Keywords: [${filterResult.ownerFinanceKeywords.join(', ')}]`);
    }
    
    if (filterResult.passesCashDeal) {
      console.log(`  Cash Reason: ${filterResult.cashDealReason}`);
      console.log(`  Discount: ${filterResult.discountPercentage?.toFixed(1)}%`);
      console.log(`  80% Zestimate: $${filterResult.eightyPercentOfZestimate?.toLocaleString()}`);
    }
    
    if (!filterResult.shouldSave) {
      console.log(`  ❌ REJECTED because:`);
      if (!filterResult.passesOwnerfinance && !filterResult.passesCashDeal) {
        console.log(`    - No owner finance keywords found`);
        if (data.price && data.zestimate) {
          const discount = ((data.zestimate - data.price) / data.zestimate) * 100;
          console.log(`    - Price is ${discount.toFixed(1)}% discount (needs >20% for cash deal)`);
        } else {
          console.log(`    - Missing price or zestimate data`);
        }
      }
    }
    
    console.log('');
  });
}

debugMigratedProperties().catch(console.error);