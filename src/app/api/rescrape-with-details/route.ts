import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { runAllInOneScraper } from '@/lib/scraper-v2/apify-client';
import { runUnifiedFilter } from '@/lib/scraper-v2/unified-filter';
import { transformPropertyForTypesense } from '@/lib/typesense/sync';
import { logger } from '@/lib/structured-logger';

// The same URLs from the original scrape-all endpoint
const ALL_PROPERTY_URLS = [
  // Knoxville, TN
  'https://www.zillow.com/knoxville-tn-37923/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-84.20138590563965%2C%22east%22%3A-83.96809809436036%2C%22south%22%3A35.8457228991423%2C%22north%22%3A36.008497899716474%7D%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74560%2C%22regionType%22%3A7%7D%5D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3A0%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22beds%22%3A%7B%22min%22%3A2%7D%2C%22baths%22%3A%7B%22min%22%3A1.5%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%22Knoxville%20TN%2037923%22%7D',
  // Add 5 sample URLs for testing
  'https://www.zillow.com/knoxville-tn-37916/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-84.05%2C%22east%22%3A-83.89%2C%22south%22%3A35.89%2C%22north%22%3A36.05%7D%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A74556%2C%22regionType%22%3A7%7D%5D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3A0%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22beds%22%3A%7B%22min%22%3A2%7D%2C%22baths%22%3A%7B%22min%22%3A1.5%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%22Knoxville%20TN%2037916%22%7D',
  'https://www.zillow.com/athens-ga-30607/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-83.54%2C%22east%22%3A-83.38%2C%22south%22%3A33.86%2C%22north%22%3A34.02%7D%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A30346%2C%22regionType%22%3A7%7D%5D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3A0%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22beds%22%3A%7B%22min%22%3A2%7D%2C%22baths%22%3A%7B%22min%22%3A1.5%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%22Athens%20GA%2030607%22%7D',
  'https://www.zillow.com/columbus-oh-43215/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-83.08%2C%22east%22%3A-82.92%2C%22south%22%3A39.93%2C%22north%22%3A40.09%7D%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A72616%2C%22regionType%22%3A7%7D%5D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3A0%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22beds%22%3A%7B%22min%22%3A2%7D%2C%22baths%22%3A%7B%22min%22%3A1.5%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%22Columbus%20OH%2043215%22%7D',
  'https://www.zillow.com/columbus-oh-43223/?searchQueryState=%7B%22pagination%22%3A%7B%7D%2C%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22west%22%3A-83.14%2C%22east%22%3A-82.98%2C%22south%22%3A39.86%2C%22north%22%3A40.02%7D%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A72626%2C%22regionType%22%3A7%7D%5D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22price%22%3A%7B%22min%22%3A0%2C%22max%22%3A300000%7D%2C%22mp%22%3A%7B%22min%22%3A0%2C%22max%22%3A55000%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22hoa%22%3A%7B%22min%22%3Anull%2C%22max%22%3A200%7D%2C%22built%22%3A%7B%22min%22%3A1970%2C%22max%22%3Anull%7D%2C%2255plus%22%3A%7B%22value%22%3A%22e%22%7D%2C%22beds%22%3A%7B%22min%22%3A2%7D%2C%22baths%22%3A%7B%22min%22%3A1.5%7D%7D%2C%22isListVisible%22%3Atrue%2C%22mapZoom%22%3A13%2C%22usersSearchTerm%22%3A%22Columbus%20OH%2043223%22%7D'
];

export async function POST(request: NextRequest) {
  logger.info('Starting property re-scraping with full details', {
    operation: 'rescrape-with-details',
    scraper: 'all-in-one'
  });
  
  try {
    const body = await request.json().catch(() => ({}));
    const { testMode = true, limit = 5 } = body;
    
    const urlsToScrape = testMode ? ALL_PROPERTY_URLS.slice(0, limit) : ALL_PROPERTY_URLS;
    
    logger.info('Initiating property scraping', {
      operation: 'rescrape-with-details',
      urlCount: urlsToScrape.length,
      testMode,
      includeFullDetails: true
    });
    
    // Use all-in-one scraper to get search results WITH full property details
    const properties = await runAllInOneScraper(urlsToScrape, {
      maxItems: testMode ? 50 : 2000,
      includeDetails: true,  // This is the key - get full property descriptions
      timeoutSecs: 600       // 10 minutes timeout
    });
    
    logger.info('Scraping completed successfully', {
      operation: 'rescrape-with-details',
      propertiesFound: properties.length
    });
    
    // Show sample of what we got
    if (properties.length > 0) {
      const sample = properties[0];
      logger.info('Sample scraped property with full details', {
        operation: 'rescrape-with-details',
        sample: {
          address: sample.address,
          price: sample.price,
          descriptionLength: sample.description?.length || 0,
          agentName: sample.agentName || 'Not provided',
          agentPhone: sample.agentPhone || 'Not provided'
        }
      });
    }
    
    // Quick analysis of descriptions
    let withDescriptions = 0;
    let withAgentInfo = 0;
    let ownerFinanceKeywords = 0;
    
    for (const prop of properties) {
      if (prop.description && prop.description.length > 10) {
        withDescriptions++;
      }
      if (prop.agentPhone || prop.agentName) {
        withAgentInfo++;
      }
      const desc = (prop.description || '').toLowerCase();
      if (desc.includes('owner financ') || desc.includes('seller financ') || 
          desc.includes('owner carry') || desc.includes('rent to own')) {
        ownerFinanceKeywords++;
      }
    }
    
    // Save to main properties collection with unified filter processing
    const { db } = getFirebaseAdmin();
    const batch = db.batch();
    const collection = db.collection('properties');
    
    let saved = 0;
    let qualified = 0;
    let finalOwnerFinance = 0;
    let finalCashDeals = 0;
    
    for (const prop of properties) {
      if (prop.zpid) {
        // Run unified filter to determine if property qualifies
        const filterResult = runUnifiedFilter(
          prop.description,
          prop.price,
          prop.zestimate,
          prop.homeType,
          {
            isAuction: prop.isAuction,
            isForeclosure: prop.isForeclosure,
            isBankOwned: prop.isBankOwned
          }
        );
        
        // Only save properties that pass at least one filter
        if (filterResult.shouldSave) {
          // Transform property data for main collection
          const transformedProperty = await transformPropertyForTypesense({
            ...prop,
            // Add unified filter results
            isOwnerfinance: filterResult.isOwnerfinance,
            isCashDeal: filterResult.isCashDeal,
            dealTypes: filterResult.dealTypes,
            
            // Metadata
            ownerFinanceKeywords: filterResult.ownerFinanceKeywords,
            primaryOwnerfinanceKeyword: filterResult.primaryOwnerfinanceKeyword,
            financingType: filterResult.financingType,
            cashDealReason: filterResult.cashDealReason,
            discountPercentage: filterResult.discountPercentage,
            eightyPercentOfZestimate: filterResult.eightyPercentOfZestimate,
            needsWork: filterResult.needsWork,
            needsWorkKeywords: filterResult.needsWorkKeywords,
            isFixer: filterResult.isFixer,
            isLand: filterResult.isLand,
            suspiciousDiscount: filterResult.suspiciousDiscount,
            
            // Processing flags
            rescrapedAt: new Date().toISOString(),
            rescrapedWithFullDetails: true,
            processedThroughUnifiedFilter: true,
            isActive: true, // Make properties visible on website
            testMode,
            addedToAgentOutreach: false // Ready for agent outreach
          });
          
          // Clean undefined values
          const cleanProp = Object.fromEntries(
            Object.entries(transformedProperty).filter(([_, value]) => value !== undefined)
          );
          
          batch.set(collection.doc(`prop_${prop.zpid}`), cleanProp);
          qualified++;
          
          if (filterResult.isOwnerfinance) finalOwnerFinance++;
          if (filterResult.isCashDeal) finalCashDeals++;
        }
        
        saved++;
        
        if (saved % 400 === 0) {
          await batch.commit();
        }
      }
    }
    
    if (saved % 400 !== 0) {
      await batch.commit();
    }
    
    return NextResponse.json({
      success: true,
      testMode,
      totalProperties: properties.length,
      withDescriptions,
      withAgentInfo,
      ownerFinanceKeywords,
      qualifiedProperties: qualified,
      finalOwnerFinance,
      finalCashDeals,
      savedToMainCollection: qualified,
      message: `Successfully re-scraped ${properties.length} properties with full details. ${qualified} qualified and saved to main collection (${finalOwnerFinance} owner finance, ${finalCashDeals} cash deals). Ready for website and agent outreach.`
    });
    
  } catch (error: any) {
    console.error('Re-scraping error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}