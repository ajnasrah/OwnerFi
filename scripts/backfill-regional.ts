import { runSearchScraper, runDetailScraper } from '../src/lib/scraper-v2/apify-client';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { runUnifiedFilter } from '../src/lib/scraper-v2/unified-filter';
import { 
  transformProperty, 
  validateProperty, 
  createUnifiedPropertyDoc 
} from '../src/lib/scraper-v2/property-transformer';
import { indexPropertiesBatch } from '../src/lib/typesense/sync';
import { sendBatchToGHLWebhook, toGHLPayload } from '../src/lib/scraper-v2/ghl-webhook';

async function backfillRegional() {
  console.log('=== REGIONAL BACKFILL SEARCH ===');
  console.log('Time:', new Date().toISOString());
  console.log('Search: Regional with quality filters (NO day limit for backfill)');
  console.log('Filters: 3+ beds, 1.5+ baths, built 1950+, no condos/land/55+');
  console.log('');
  
  const { db } = getFirebaseAdmin();
  
  // Same URL but WITHOUT the doz (days on Zillow) filter for backfill
  const backfillUrl = 'https://www.zillow.com/homes/for_sale/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A42.94690053337595%2C%22south%22%3A32.73013902510411%2C%22east%22%3A-90.31017955650849%2C%22west%22%3A-103.36193736900849%7D%2C%22mapZoom%22%3A7%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22pmf%22%3A%7B%22value%22%3Atrue%7D%2C%22pf%22%3A%7B%22value%22%3Atrue%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A700000%7D%2C%22mp%22%3A%7B%22min%22%3Anull%2C%22max%22%3A55000%7D%2C%22tow%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%22built%22%3A%7B%22min%22%3A1950%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22beds%22%3A%7B%22min%22%3A3%7D%2C%22baths%22%3A%7B%22min%22%3A1.5%7D%7D%2C%22isListVisible%22%3Atrue%2C%22customRegionId%22%3A%22df7046a1c6X1-CR13v9mnyofzovu_179s8e%22%2C%22pagination%22%3A%7B%7D%2C%22usersSearchTerm%22%3A%22%22%7D';
  
  const metrics = {
    totalFound: 0,
    duplicates: 0,
    processed: 0,
    savedOwnerFinance: 0,
    savedCashDeal: 0,
    savedBoth: 0,
    sentToGHL: 0,
    errors: [] as any[]
  };
  
  try {
    // Step 1: Run search
    console.log('[STEP 1] Running search scraper...');
    const searchResults = await runSearchScraper([backfillUrl], {
      maxResults: 2500,
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
    
    // Step 3: Get property details (in batches)
    console.log('\n[STEP 3] Getting property details...');
    const propertyUrls = newProperties
      .map((p: any) => p.detailUrl || p.url)
      .filter((url: string) => url && url.includes('zillow.com'))
      .slice(0, 2500); // Process up to 2500 properties
    
    const detailedProperties: any[] = [];
    const batchSize = 500;
    
    for (let i = 0; i < propertyUrls.length; i += batchSize) {
      const batch = propertyUrls.slice(i, i + batchSize);
      console.log(`Getting details for batch ${Math.floor(i/batchSize) + 1} (${batch.length} properties)...`);
      try {
        const batchDetails = await runDetailScraper(batch, { timeoutSecs: 300 });
        detailedProperties.push(...batchDetails);
        console.log(`  Batch complete: ${batchDetails.length} properties`);
      } catch (error: any) {
        console.error(`  Batch failed: ${error.message}`);
      }
    }
    
    console.log(`Got ${detailedProperties.length} detailed properties total`);
    
    // Merge images from search results
    const searchByZpid = new Map();
    for (const item of searchResults) {
      if (item.zpid) {
        searchByZpid.set(String(item.zpid), item);
      }
    }
    
    for (const prop of detailedProperties) {
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
    const ghlProps: any[] = [];
    
    for (const raw of detailedProperties) {
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
        
        // Mark as regional for GHL
        (docData as any).sentToGHL = true;
        (docData as any).sentToGHLAt = new Date();
        (docData as any).isRegional = true;
        
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
        
        // Collect for GHL
        ghlProps.push({
          zpid: property.zpid,
          fullAddress: property.fullAddress,
          streetAddress: property.streetAddress,
          city: property.city,
          state: property.state,
          zipCode: property.zipCode,
          price: property.price,
          estimate: property.estimate,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          livingArea: property.squareFoot,
          yearBuilt: property.yearBuilt,
          homeType: property.homeType,
          description: property.description,
          zillowUrl: property.url,
          imgSrc: property.firstPropertyImage,
        });
        
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
    
    // Step 5: Send to GHL
    if (ghlProps.length > 0) {
      console.log('\n[STEP 5] Sending to GHL webhook...');
      try {
        const ghlPayloads = ghlProps.map(p => toGHLPayload(p));
        const ghlResult = await sendBatchToGHLWebhook(ghlPayloads, {
          delayMs: 100,
          onProgress: (sent, total) => {
            console.log(`[GHL] Progress: ${sent}/${total}`);
          },
        });
        metrics.sentToGHL = ghlResult.sent;
      } catch (error: any) {
        console.error('[GHL] Error:', error.message);
      }
    }
    
    console.log('\n=== BACKFILL COMPLETE ===');
    console.log(`Total found: ${metrics.totalFound}`);
    console.log(`Duplicates: ${metrics.duplicates}`);
    console.log(`Processed: ${metrics.processed}`);
    console.log(`Owner Finance: ${metrics.savedOwnerFinance}`);
    console.log(`Cash Deals: ${metrics.savedCashDeal}`);
    console.log(`Both: ${metrics.savedBoth}`);
    console.log(`Sent to GHL: ${metrics.sentToGHL}`);
    console.log(`Errors: ${metrics.errors.length}`);
    
  } catch (error: any) {
    console.error('Fatal error:', error.message);
  }
}

// Run the backfill
backfillRegional().catch(console.error);