import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/scraper-v2/firebase-admin';
import { runAllInOneScraper } from '@/lib/scraper-v2/apify-client';
import { runUnifiedFilter } from '@/lib/scraper-v2/unified-filter';
import { ApifyClient } from 'apify-client';
import { hasStrictOwnerfinancing } from '@/lib/owner-financing-filter-strict';
import { hasNegativeKeywords } from '@/lib/negative-keywords';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';
import { getMarketAnalysis, getQualifiedMarkets } from '@/lib/market-cost-analysis';

// City path mappings for nationwide target cities
// Prioritized for: affordable homes (<$300k), high cash flow, owner financing opportunities
const CITY_PATHS: Record<string, string> = {
  // === TIER 1: TOP CASH FLOW MARKETS ===
  // Midwest - Best cash flow nationwide (9%+ rental yields)
  'cleveland': 'cleveland-oh',           // 9.8% yield, $150k median
  'toledo': 'toledo-oh',                // Manufacturing boom, affordable
  'indianapolis': 'indianapolis-in',     // Diverse economy, steady growth
  'kansas-city': 'kansas-city-mo',      // Central logistics hub
  'milwaukee': 'milwaukee-wi',          // Industrial revival
  'cincinnati': 'cincinnati-oh',        // Strong rental demand
  'columbus': 'columbus-oh',            // Tech/healthcare growth
  'detroit': 'detroit-mi',              // Major turnaround, 9%+ yields
  
  // South - High yields with growth potential
  'memphis': 'memphis-tn',              // 11% rent-to-price ratio
  'birmingham': 'birmingham-al',        // Medical/tech sectors
  'little-rock': 'little-rock-ar',      // State capital stability
  'jackson': 'jackson-ms',              // Affordable entry point
  'shreveport': 'shreveport-la',        // Oil/gas recovery market
  
  // === TIER 2: BALANCED GROWTH + CASH FLOW ===
  // Tennessee - No state income tax + growth
  'nashville': 'nashville-tn',          // Music City boom
  'knoxville': 'knoxville-tn',          // University town stability
  'chattanooga': 'chattanooga-tn',      // Tech renaissance
  
  // Kentucky - Affordable + stable
  'louisville': 'louisville-ky',        // Derby City, healthcare hub
  'lexington': 'lexington-ky',          // Horse capital, universities
  
  // North Carolina - Research Triangle spillover
  'charlotte': 'charlotte-nc',          // Banking center
  'greensboro': 'greensboro-nc',        // Affordable alternative
  'winston-salem': 'winston-salem-nc',  // Medical/education
  
  // === TIER 3: EMERGING MARKETS ===
  // Florida - Population growth
  'tampa': 'tampa-fl',                  // Tourism + tech growth
  'orlando': 'orlando-fl',              // Theme parks + tech
  'jacksonville': 'jacksonville-fl',    // Port city, logistics
  
  // Georgia - Business-friendly
  'atlanta': 'atlanta-ga',              // Major metro, film industry
  'augusta': 'augusta-ga',              // Masters Tournament city
  'savannah': 'savannah-ga',            // Tourism + port activity
  'athens': 'athens-ga',                // University of Georgia
  
  // Texas - No state income tax
  'dallas': 'dallas-tx',                // Major business hub
  'houston': 'houston-tx',              // Energy capital
  'austin': 'austin-tx',                // Tech boom (expensive but strong)
  'san-antonio': 'san-antonio-tx',      // Military + healthcare
  'fort-worth': 'fort-worth-tx',        // DFW metroplex
  
  // === TIER 4: RUST BELT REVIVAL ===
  // Ohio Valley - Industrial comeback
  'pittsburgh': 'pittsburgh-pa',        // Tech/healthcare growth
  'youngstown': 'youngstown-oh',        // Ultra-affordable turnaround
  'akron': 'akron-oh',                  // Polymer/advanced manufacturing
  'dayton': 'dayton-oh',                // Aerospace hub
  
  // Great Lakes - Affordable with potential
  'buffalo': 'buffalo-ny',              // Rising star, tourism growth
  'grand-rapids': 'grand-rapids-mi',    // Furniture capital revival
  'rockford': 'rockford-il',            // Chicago spillover market
  
  // === TIER 5: SOUTHWEST/MOUNTAIN WEST ===
  // Arizona - Retiree + investor magnet
  'phoenix': 'phoenix-az',              // Major growth market
  'tucson': 'tucson-az',                // University/aerospace
  
  // New Mexico - Affordable Southwest
  'albuquerque': 'albuquerque-nm',      // Tech/defense contractors
  
  // Arkansas - Natural State opportunities
  'fayetteville': 'fayetteville-ar',    // University of Arkansas, tech
  
  // === TIER 6: MOUNTAIN/PLAINS STATES ===
  // Colorado - High growth but pricier
  'colorado-springs': 'colorado-springs-co', // Military + tourism
  
  // Iowa - Agricultural stability
  'des-moines': 'des-moines-ia',        // Insurance capital
  
  // Nebraska - Warren Buffett's market
  'omaha': 'omaha-ne',                  // 5.3% yield, stable returns
  
  // Oklahoma - Energy + affordable
  'oklahoma-city': 'oklahoma-city-ok',  // State capital, energy sector
  'tulsa': 'tulsa-ok'                   // Oil capital revival
};

// Generate standardized Zillow URL for a zip code
function generateZillowURL(zipCode: string, cityPath: string): string {
  // Get rough center coordinates for the zip (simplified - could use real geocoding API)
  const lat = 36.0; // Default to rough center of target region
  const lng = -84.0;
  
  const searchQueryState = {
    pagination: {},
    isMapVisible: true,
    mapBounds: {
      west: lng - 0.08,
      east: lng + 0.08, 
      south: lat - 0.08,
      north: lat + 0.08
    },
    regionSelection: [{ 
      regionId: parseInt(zipCode), 
      regionType: 7 
    }],
    filterState: {
      sort: { value: "globalrelevanceex" },
      price: { min: 0, max: 300000 },
      mp: { min: 0, max: 55000 },
      land: { value: false },
      apa: { value: false },
      manu: { value: false },
      hoa: { min: null, max: 200 },
      built: { min: 1970, max: null },
      "55plus": { value: "e" },
      beds: { min: 2 },
      baths: { min: 1.5 }
    },
    isListVisible: true,
    mapZoom: 13,
    usersSearchTerm: `${cityPath.replace('-', ' ')} ${zipCode}`.toUpperCase()
  };

  const encoded = encodeURIComponent(JSON.stringify(searchQueryState));
  return `https://www.zillow.com/${cityPath}-${zipCode}/?searchQueryState=${encoded}`;
}

interface AddZipCodesRequest {
  zipCodes: string[];
  city: string; // e.g. 'knoxville', 'columbus', etc.
  includeAgentOutreach?: boolean; // Whether to run full agent outreach scraper
}

export async function POST(request: NextRequest) {
  console.log('ADD ZIP CODES: Plug-and-play new zip code scraper with automated cost analysis');
  
  try {
    const body: AddZipCodesRequest = await request.json();
    const { zipCodes, city, includeAgentOutreach = false } = body;
    
    if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'zipCodes array is required' 
      }, { status: 400 });
    }
    
    if (!city || !CITY_PATHS[city.toLowerCase()]) {
      return NextResponse.json({ 
        success: false, 
        error: `City '${city}' not supported. Available cities: ${Object.keys(CITY_PATHS).join(', ')}` 
      }, { status: 400 });
    }
    
    // AUTOMATED COST ANALYSIS - Check if city is financially viable
    const marketAnalysis = getMarketAnalysis(city.toLowerCase());
    const qualifiedMarkets = getQualifiedMarkets(50); // Minimum score of 50
    
    console.log(`Market Analysis for ${city}:`, marketAnalysis);
    
    if (marketAnalysis && marketAnalysis.score < 40) {
      console.warn(`⚠️  LOW SCORE CITY: ${city} scored ${marketAnalysis.score}/100`);
      console.warn('Warnings:', marketAnalysis.warnings);
      // Continue anyway but warn user
    }
    
    if (!qualifiedMarkets.includes(city.toLowerCase())) {
      console.warn(`⚠️  City ${city} not in top qualified markets. Proceeding with caution.`);
    }
    
    const cityPath = CITY_PATHS[city.toLowerCase()];
    
    // Generate URLs for all zip codes
    const urls = zipCodes.map(zip => generateZillowURL(zip, cityPath));
    
    console.log(`Scraping ${zipCodes.length} new zip codes in ${city}:`, zipCodes);
    console.log('Generated URLs:', urls);
    
    // Run scraper on new zip codes with FULL DETAILS + AGENT INFO for GoHighLevel
    const properties = await runAllInOneScraper(urls, {
      maxItems: 2000, // Get all properties per zip
      includeDetails: true, // Get property descriptions for owner finance detection
      timeoutSecs: 600 // 10 minutes for large batches
    });
    
    console.log(`Found ${properties.length} properties in new zip codes`);
    
    // Quick analysis
    let ownerFinance = 0;
    let cashDeals = 0;
    
    for (const prop of properties) {
      const desc = (prop.description || '').toLowerCase();
      if (desc.includes('owner financ') || desc.includes('seller financ')) {
        ownerFinance++;
      }
      
      const price = prop.price;
      const zestimate = prop.zestimate;
      if (price && zestimate && typeof price === 'number' && typeof zestimate === 'number') {
        if (price < zestimate * 0.8) {
          cashDeals++;
        }
      }
    }
    
    // Process properties through unified filter and save qualified ones
    const { db } = getFirebaseAdmin();
    const mainCollection = db.collection('properties');
    const agentOutreachQueue = db.collection('agent_outreach_queue');
    const batch = db.batch();
    
    let saved = 0;
    let skipped = 0;
    let qualifiedForAgentOutreach = 0;
    let qualifiedOwnerFinance = 0;
    let qualifiedCashDeals = 0;
    
    for (const prop of properties) {
      if (prop.zpid) {
        // Check if property already exists
        const existingDoc = await mainCollection.doc(`prop_${prop.zpid}`).get();
        if (existingDoc.exists) {
          skipped++;
          continue;
        }
        
        // Run unified filter to determine if property qualifies
        const filterResult = runUnifiedFilter(
          prop.description,
          typeof prop.price === 'string' ? parseFloat(prop.price) : prop.price,
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
          // Transform property data with unified filter results
          const transformedProperty = {
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
            scrapedAt: new Date().toISOString(),
            newZipCodeScrape: true,
            newZipCodes: zipCodes,
            processedThroughUnifiedFilter: true,
            isActive: true, // Make properties visible on website
            source: 'scraper-v2', // Standard source for new scrapes
          };
          
          // Count qualified properties
          if (filterResult.isOwnerfinance) qualifiedOwnerFinance++;
          if (filterResult.isCashDeal) qualifiedCashDeals++;
          
          // Add to agent outreach queue if property has agent contact info
          if (prop.agentPhone || prop.agentEmail) {
            const agentOutreachDoc = {
              zpid: prop.zpid,
              address: prop.address,
              city: prop.city,
              state: prop.state,
              price: prop.price,
              zestimate: prop.zestimate,
              agentPhone: prop.agentPhone,
              agentEmail: prop.agentEmail,
              agentName: prop.agentName,
              brokerName: prop.brokerName,
              brokerPhone: prop.brokerPhone,
              dealType: filterResult.isOwnerfinance ? 'owner_finance' : filterResult.isCashDeal ? 'cash_deal' : 'rental',
              isOwnerfinance: filterResult.isOwnerfinance,
              isCashDeal: filterResult.isCashDeal,
              addedAt: new Date(),
              status: 'pending',
              source: 'new_zip_scrape',
              newZipCodes: zipCodes,
              marketScore: marketAnalysis?.score || null
            };
            
            // Clean undefined values from agent outreach doc
            const cleanAgentDoc = Object.fromEntries(
              Object.entries(agentOutreachDoc).filter(([_, value]) => value !== undefined)
            );
            
            batch.set(agentOutreachQueue.doc(), cleanAgentDoc);
            qualifiedForAgentOutreach++;
          }
          
          // Clean undefined values from main property doc
          const cleanProp = Object.fromEntries(
            Object.entries(transformedProperty).filter(([_, value]) => value !== undefined)
          );
          
          batch.set(mainCollection.doc(`prop_${prop.zpid}`), cleanProp);
          saved++;
          
          // Commit every 400 to avoid batch size limits
          if (saved % 400 === 0) {
            await batch.commit();
          }
        }
      }
    }
    
    // Commit remaining
    if (saved % 400 !== 0) {
      await batch.commit();
    }
    
    console.log(`New zip codes complete: ${saved} qualified properties saved, ${qualifiedForAgentOutreach} added to agent outreach queue`);
    
    return NextResponse.json({
      success: true,
      zipCodes,
      city,
      totalProperties: properties.length,
      qualifiedProperties: saved,
      qualifiedOwnerFinance,
      qualifiedCashDeals,
      savedToAgentOutreach: qualifiedForAgentOutreach,
      skippedDuplicates: skipped,
      urls: urls.length,
      // AUTOMATED COST ANALYSIS RESULTS
      marketAnalysis: marketAnalysis ? {
        score: marketAnalysis.score,
        analysis: marketAnalysis.analysis,
        warnings: marketAnalysis.warnings,
        advantages: marketAnalysis.advantages
      } : null,
      qualifiedMarket: qualifiedMarkets.includes(city.toLowerCase()),
      message: `Successfully processed ${properties.length} properties from ${zipCodes.length} zip codes in ${city}. ${saved} qualified properties saved (${qualifiedOwnerFinance} owner finance, ${qualifiedCashDeals} cash deals). ${qualifiedForAgentOutreach} added to agent outreach queue${marketAnalysis ? ` (Market Score: ${marketAnalysis.score}/100)` : ''}`
    });
    
  } catch (error: any) {
    console.error('New zip codes error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}