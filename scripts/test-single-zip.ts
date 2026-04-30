#!/usr/bin/env npx tsx
/**
 * Test script for single zip to verify validation fix
 */

import * as dotenv from 'dotenv';
import { TARGETED_ZIP_URLS } from '../src/lib/scraper-v2/search-config';
import { getFirebaseAdmin } from '../src/lib/scraper-v2/firebase-admin';
import { runSearchScraper, runDetailScraper, type ScrapedProperty } from '../src/lib/scraper-v2/apify-client';
import {
  runUnifiedFilter,
  logFilterResult,
  calculateFilterStats,
  logFilterStats,
  FilterResult,
} from '../src/lib/scraper-v2/unified-filter';
import {
  transformProperty,
  validateProperty,
  createUnifiedPropertyDoc,
} from '../src/lib/scraper-v2/property-transformer';

dotenv.config({ path: '.env.local' });

function removeDozFilter(url: string): string {
  const match = url.match(/searchQueryState=([^&]+)/);
  if (!match) return url;
  
  try {
    const decoded = decodeURIComponent(match[1]);
    const queryState = JSON.parse(decoded);
    
    if (queryState.filterState && queryState.filterState.doz) {
      delete queryState.filterState.doz;
    }
    
    const newEncoded = encodeURIComponent(JSON.stringify(queryState));
    return url.replace(/searchQueryState=[^&]+/, `searchQueryState=${newEncoded}`);
  } catch (error) {
    console.error('Error removing doz filter:', error);
    return url;
  }
}

async function testSingleZip() {
  console.log('=== TESTING SINGLE ZIP ===\n');
  
  const { db } = getFirebaseAdmin();
  
  // Test with first URL
  const originalUrl = TARGETED_ZIP_URLS[0];
  const url = removeDozFilter(originalUrl);
  const zipMatch = url.match(/(\d{5})/);
  const zip = zipMatch ? zipMatch[1] : 'test';
  
  console.log(`Testing zip: ${zip}`);
  console.log(`URL: ${url.substring(0, 100)}...`);
  
  try {
    // STEP 1: Search
    const searchResults = await runSearchScraper([url], {
      maxResults: 50, // Minimum 20 required by Apify
      mode: 'pagination'
    });
    
    console.log(`Found ${searchResults.length} search results`);
    
    if (searchResults.length === 0) {
      console.log('No properties found');
      return;
    }

    // STEP 2: Get details for first property only
    const firstProperty = searchResults[0];
    const propertyUrl = firstProperty.detailUrl || firstProperty.url;
    
    if (!propertyUrl) {
      console.log('No detail URL available');
      return;
    }
    
    console.log(`Getting details for ZPID: ${firstProperty.zpid}`);
    
    const detailedProperties = await runDetailScraper([propertyUrl], { timeoutSecs: 300 });
    
    if (detailedProperties.length === 0) {
      console.log('No detailed properties returned');
      return;
    }
    
    const rawProperty = detailedProperties[0];
    console.log(`Got detailed property: ${rawProperty.zpid}`);
    
    // STEP 3: Transform
    const property = transformProperty(rawProperty, 'scraper-v2', 'test');
    console.log(`✅ Transform succeeded for ZPID: ${property.zpid}`);
    
    // STEP 4: Validate
    const validation = validateProperty(property);
    console.log(`Validation result:`, validation);
    
    if (!validation.valid) {
      console.log(`❌ Validation failed: ${validation.reason}`);
      return;
    }
    
    console.log(`✅ Validation passed!`);
    
    // STEP 5: Run filters
    const filterResult = runUnifiedFilter(
      property,
      String(property.description || ''),
      String(property.listingRemarks || ''),
      String(property.publicRemarks || '')
    );
    
    console.log(`Filter results:`);
    console.log(`- Owner Finance: ${filterResult.passesOwnerfinance}`);
    console.log(`- Cash Deal: ${filterResult.passesCashDeal}`);
    console.log(`- Owner Finance Keywords: ${filterResult.ownerFinanceKeywords}`);
    console.log(`- Cash Deal Reason: ${filterResult.cashDealReason}`);
    console.log(`- Discount %: ${filterResult.discountPercentage}`);
    
    if (filterResult.passesOwnerfinance || filterResult.passesCashDeal) {
      console.log(`🎯 PROPERTY PASSES FILTERS!`);
      
      // STEP 6: Create document
      const docData = createUnifiedPropertyDoc(property, filterResult);
      console.log(`✅ Document created successfully`);
      
      // STEP 7: Save to Firebase (test)
      const docId = `zpid_${property.zpid}`;
      await db.collection('properties').doc(docId).set(docData, { merge: true });
      console.log(`✅ Saved to Firebase: ${docId}`);
      
    } else {
      console.log(`❌ Property does not pass filters`);
    }
    
    console.log(`\n✅ Single zip test completed successfully!`);
    
  } catch (error) {
    console.error(`❌ Test failed:`, error);
  }
}

testSingleZip().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});