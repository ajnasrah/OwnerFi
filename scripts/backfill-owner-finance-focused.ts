import { runSearchScraper, runDetailScraper } from '../src/lib/scraper-v2/apify-client';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { runUnifiedFilter } from '../src/lib/scraper-v2/unified-filter';
import { 
  transformProperty, 
  validateProperty, 
  createUnifiedPropertyDoc 
} from '../src/lib/scraper-v2/property-transformer';
import { indexPropertiesBatch } from '../src/lib/typesense/sync';

async function backfillOwnerFinanceFocused() {
  console.log('=== OWNER FINANCE FOCUSED BACKFILL ===');
  console.log('Time:', new Date().toISOString());
  console.log('Search: Owner finance with all filters (no foreclosure, no 55+, built 1950+, no MF/land/apartments/manufactured)');
  console.log('Expected: ~3,500 properties');
  console.log('');
  
  const { db } = getFirebaseAdmin();
  
  // Focused search with all the filters
  const backfillUrl = 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-124.35063425572206%2C%22east%22%3A-72.14360300572206%2C%22south%22%3A4.056014034205165%2C%22north%22%3A48.730804337116965%7D%2C%22mapZoom%22%3A5%2C%22usersSearchTerm%22%3A%22%22%2C%22customRegionId%22%3A%227737068f7fX1-CR1vsn1vnm6xxbg_1d5w1n%22%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22pmf%22%3A%7B%22value%22%3Atrue%7D%2C%22pf%22%3A%7B%22value%22%3Atrue%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A750000%7D%2C%22att%22%3A%7B%22value%22%3A%22%5C%22owner%20financing%5C%22%20%2C%20%5C%22seller%20financing%5C%22%20%2C%20%5C%22owner%20carry%5C%22%20%2C%20%5C%22seller%20carry%5C%22%20%2C%20%5C%22owner%20terms%5C%22%20%2C%20%5C%22seller%20terms%5C%22%20%2C%20%5C%22rent%20to%20own%5C%22%20%2C%20%5C%22lease%20option%5C%22%20%2C%20%5C%22contract%20for%20deed%5C%22%20%2C%20%5C%22land%20contract%5C%22%20%2C%20%5C%22assumable%20loan%5C%22%20%2C%20%5C%22no%20bank%20needed%5C%22%22%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22built%22%3A%7B%22min%22%3A1950%7D%7D%2C%22isListVisible%22%3Atrue%7D';
  
  const metrics = {
    totalFound: 0,
    duplicates: 0,
    processed: 0,
    savedOwnerFinance: 0,
    savedCashDeal: 0,
    savedBoth: 0,
    indexed: 0,
    errors: [] as any[]
  };
  
  try {
    // Step 1: Run search
    console.log('[STEP 1] Running search scraper...');
    const searchResults = await runSearchScraper([backfillUrl], {
      maxResults: 4000, // Set to 4000 to capture all ~3500
      mode: 'pagination'
    });
    
    metrics.totalFound = searchResults.length;
    console.log(`Found ${searchResults.length} properties from search`);
    
    if (searchResults.length === 0) {
      console.log('No properties found');
      return;
    }
    
    // Step 2: Check for duplicates
    console.log('\n[STEP 2] Checking for duplicates...');
    const zpids = searchResults
      .map(p => p.zpid)
      .filter(zpid => zpid)
      .map(zpid => typeof zpid === 'string' ? parseInt(zpid, 10) : zpid);
    
    const existingZpids = new Set<number>();
    for (let i = 0; i < zpids.length; i += 100) {
      const batch = zpids.slice(i, i + 100);
      const docIds = batch.map(z => `zpid_${z}`);
      const docRefs = docIds.map(id => db.collection('properties').doc(id));
      const snapshots = await db.getAll(...docRefs);
      snapshots.forEach((snap, idx) => {
        if (snap.exists) {
          existingZpids.add(batch[idx]);
        }
      });
    }
    
    metrics.duplicates = existingZpids.size;
    console.log(`Found ${existingZpids.size} duplicates`);
    
    const newProperties = searchResults.filter(p => {
      const zpid = typeof p.zpid === 'string' ? parseInt(p.zpid, 10) : p.zpid;
      return zpid && !existingZpids.has(zpid);
    });
    
    console.log(`${newProperties.length} new properties to process`);
    
    if (newProperties.length === 0) {
      console.log('All properties already exist in database');
      return;
    }
    
    // Step 3: Get property details (in batches of 500)
    console.log('\n[STEP 3] Getting property details...');
    const allDetailedProperties: any[] = [];
    const propertyUrls = newProperties
      .map((p: any) => p.detailUrl || p.url)
      .filter((url: string) => url && url.includes('zillow.com'));
    
    for (let i = 0; i < propertyUrls.length; i += 500) {
      const batch = propertyUrls.slice(i, i + 500);
      console.log(`Getting details for batch ${Math.floor(i/500) + 1} (${batch.length} properties)...`);
      const detailedBatch = await runDetailScraper(batch, { timeoutSecs: 300 });
      allDetailedProperties.push(...detailedBatch);
    }
    
    console.log(`Got ${allDetailedProperties.length} detailed properties total`);
    
    // Merge images from search results
    const searchByZpid = new Map();
    for (const item of searchResults) {
      if (item.zpid) {
        searchByZpid.set(String(item.zpid), item);
      }
    }
    
    for (const prop of allDetailedProperties) {
      if (!prop.imgSrc && prop.zpid) {
        const searchItem = searchByZpid.get(String(prop.zpid));
        if (searchItem?.imgSrc) {
          prop.imgSrc = searchItem.imgSrc;
        }
      }
    }
    
    // Step 4: Process and save
    console.log('\n[STEP 4] Processing and saving...');
    const batch = db.batch();
    let batchCount = 0;
    const typesenseProps: any[] = [];
    
    for (const raw of allDetailedProperties) {
      try {
        const property = transformProperty(raw, 'backfill', 'unified');
        const validation = validateProperty(property);
        
        if (!validation.valid) continue;
        
        const filterResult = runUnifiedFilter(
          property.description,
          property.price,
          property.estimate,
          property.homeType,
          {
            isAuction: property.isAuction,
            isForeclosure: property.isForeclosure,
            isBankOwned: property.isBankOwned
          }
        );
        
        // Only save if passes at least one filter
        if (!filterResult.shouldSave) continue;
        
        const docId = `zpid_${property.zpid}`;
        const docRef = db.collection('properties').doc(docId);
        const docData = createUnifiedPropertyDoc(property, filterResult);
        
        batch.set(docRef, docData, { merge: true });
        batchCount++;
        metrics.processed++;
        
        if (filterResult.isOwnerfinance && filterResult.isCashDeal) {
          metrics.savedBoth++;
        } else if (filterResult.isOwnerfinance) {
          metrics.savedOwnerFinance++;
        } else if (filterResult.isCashDeal) {
          metrics.savedCashDeal++;
        }
        
        // Collect for Typesense
        typesenseProps.push(property);
        
        console.log(`  [${filterResult.isOwnerfinance ? 'OF' : ''}${filterResult.isCashDeal ? 'CASH' : ''}] ${property.fullAddress}`);
        
        if (batchCount >= 100) {
          await batch.commit();
          batchCount = 0;
        }
      } catch (error: any) {
        metrics.errors.push({ error: error.message });
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    // Step 5: Index to Typesense
    if (typesenseProps.length > 0) {
      console.log('\n[STEP 5] Indexing to Typesense...');
      try {
        await indexPropertiesBatch(typesenseProps);
        metrics.indexed = typesenseProps.length;
        console.log(`Indexed ${typesenseProps.length} properties`);
      } catch (error: any) {
        console.error('[Typesense] Error:', error.message);
      }
    }
    
    console.log('\n=== BACKFILL COMPLETE ===');
    console.log(`Total found: ${metrics.totalFound}`);
    console.log(`Duplicates: ${metrics.duplicates}`);
    console.log(`Processed: ${metrics.processed}`);
    console.log(`Owner Finance: ${metrics.savedOwnerFinance}`);
    console.log(`Cash Deals: ${metrics.savedCashDeal}`);
    console.log(`Both: ${metrics.savedBoth}`);
    console.log(`Indexed: ${metrics.indexed}`);
    console.log(`Errors: ${metrics.errors.length}`);
    
  } catch (error: any) {
    console.error('Fatal error:', error.message);
  }
}

// Run the backfill
backfillOwnerFinanceFocused().catch(console.error);