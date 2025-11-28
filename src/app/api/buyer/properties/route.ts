import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  documentId,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PropertyListing } from "@/lib/property-schema";
import { getCitiesWithinRadiusWithExpansion } from '@/lib/comprehensive-cities';
import { checkDatabaseAvailable, applyRateLimit, getClientIp } from '@/lib/api-guards';
import { requireAuth } from '@/lib/auth-helpers';
import { ErrorResponses, createSuccessResponse, logError } from '@/lib/api-error-handler';

/**
 * BUYER PROPERTY API WITH NEARBY CITIES
 *
 * Shows properties that match buyer's simple criteria:
 * 1. DIRECT: Properties in the exact search city
 * 2. NEARBY: Properties IN nearby cities (within 30 miles of buyer's search city)
 *
 * LOGIC: When buyer searches "Houston", we:
 * - Get list of cities within 30 miles of Houston (Pearland, Sugarland, etc.)
 * - Show properties located IN those nearby cities
 */

export async function GET(request: NextRequest) {
  // Standardized authentication
  const authResult = await requireAuth(request);
  if ('error' in authResult) return authResult.error;
  const { session } = authResult;

  // Check database availability
  const dbError = checkDatabaseAvailable(db);
  if (dbError) return dbError;

  // Apply rate limiting (60 requests per minute per user)
  const ip = getClientIp(request.headers);
  const rateLimitError = await applyRateLimit(`buyer-properties:${ip}`, 60, 60);
  if (rateLimitError) return rateLimitError;

  try {
    // Get buyer's search criteria from URL params
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const pageSize = parseInt(searchParams.get('limit') || '50'); // Default 50 properties per page
    const page = parseInt(searchParams.get('page') || '1'); // Default page 1
    const includePassed = searchParams.get('includePassed') === 'true'; // Show passed properties

    if (!city || !state) {
      return ErrorResponses.validationError(
        'Missing required parameters: city, state'
      );
    }

    const searchCity = city.split(',')[0].trim();
    const searchState = state;

    if (!searchCity || searchCity.length < 2) {
      return NextResponse.json({
        error: 'Invalid city: must be at least 2 characters'
      }, { status: 400 });
    }

    if (!searchState || searchState.length !== 2) {
      return NextResponse.json({
        error: 'Invalid state: must be 2-letter state code'
      }, { status: 400 });
    }

    // Get buyer's liked properties AND pre-computed filter
    const buyerProfileQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const buyerSnapshot = await getDocs(buyerProfileQuery);
    let likedPropertyIds: string[] = [];
    let passedPropertyIds: string[] = [];
    let nearbyCityNames = new Set<string>();

    // Property filter preferences from buyer profile
    let buyerFilters = {
      minBedrooms: undefined as number | undefined,
      maxBedrooms: undefined as number | undefined,
      minBathrooms: undefined as number | undefined,
      maxBathrooms: undefined as number | undefined,
      minSquareFeet: undefined as number | undefined,
      maxSquareFeet: undefined as number | undefined,
      minPrice: undefined as number | undefined,
      maxPrice: undefined as number | undefined,
    };

    if (!buyerSnapshot.empty) {
      const profile = buyerSnapshot.docs[0].data();
      likedPropertyIds = profile.likedProperties || profile.likedPropertyIds || [];
      passedPropertyIds = profile.passedPropertyIds || [];

      // Extract property filter preferences
      buyerFilters = {
        minBedrooms: profile.minBedrooms,
        maxBedrooms: profile.maxBedrooms,
        minBathrooms: profile.minBathrooms,
        maxBathrooms: profile.maxBathrooms,
        minSquareFeet: profile.minSquareFeet,
        maxSquareFeet: profile.maxSquareFeet,
        minPrice: profile.minPrice,
        maxPrice: profile.maxPrice,
      };

      // 🆕 USE PRE-COMPUTED FILTER (stored at signup/settings update)
      // This ensures consistent city names and prevents recalculation overhead
      if (profile.filter?.nearbyCities && profile.filter.nearbyCities.length > 0) {
        // Use the pre-computed nearby cities from the stored filter
        nearbyCityNames = new Set(
          profile.filter.nearbyCities.map((city: string) => city.toLowerCase())
        );
        console.log(`✅ [buyer-search] Using stored filter: ${nearbyCityNames.size} nearby cities`);
      } else {
        // Fallback: Calculate on-the-fly if no filter exists (shouldn't happen after settings)
        // Uses automatic radius expansion: 30mi → 60mi → 120mi if needed
        console.log(`⚠️  [buyer-search] No stored filter found, calculating on-the-fly`);
        const { cities: nearbyCitiesList, radiusUsed } = getCitiesWithinRadiusWithExpansion(searchCity, searchState, 30, 5);
        nearbyCityNames = new Set(
          nearbyCitiesList.map(city => city.name.toLowerCase())
        );
        console.log(`✅ [buyer-search] Calculated ${nearbyCityNames.size} nearby cities as fallback (radius: ${radiusUsed}mi)`);
      }

      console.log(`✅ [buyer-search] Buyer filters:`, buyerFilters);
    }

    console.log(`\n🔍 [BUYER SEARCH] ===== Search Request =====`);
    console.log(`   Search city: ${searchCity}, ${searchState}`);
    console.log(`   Nearby cities in filter: ${nearbyCityNames.size}`);
    console.log(`   First 10 cities: ${Array.from(nearbyCityNames).slice(0, 10).join(', ')}`);
    if (nearbyCityNames.size === 0) {
      console.error(`❌ [BUYER SEARCH] WARNING: No nearby cities found! Properties will only show from exact city match.`);
    }

    // ===== QUERY PROPERTIES FROM TWO SOURCES =====
    // OPTIMIZATION: Use array-contains on nearbyCities for fast geo filtering
    // This avoids fetching all properties and filtering in memory

    // PAGINATION: Limit initial queries to reduce bandwidth and improve performance
    const fetchLimit = Math.min(pageSize * 3, 300); // Fetch 3x pageSize, max 300

    // Build queries - use array-contains if buyer's city is in property's nearbyCities
    // This means: "Find properties whose nearbyCities array contains the buyer's search city"
    // Which finds properties that are NEAR the buyer's search city

    // 1. Curated properties - DIRECT matches (property IS in search city)
    const propertiesDirectQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('state', '==', searchState),
      orderBy('monthlyPayment', 'asc'),
      limit(fetchLimit)
    );

    // 2. Curated properties - NEARBY matches (buyer's city is in property's nearbyCities)
    const propertiesNearbyQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('nearbyCities', 'array-contains', searchCity),
      limit(fetchLimit)
    );

    // 3. Zillow scraped properties - DIRECT matches
    const zillowDirectQuery = query(
      collection(db, 'zillow_imports'),
      where('state', '==', searchState),
      where('ownerFinanceVerified', '==', true),
      limit(fetchLimit)
    );

    // 4. Zillow scraped properties - NEARBY matches
    const zillowNearbyQuery = query(
      collection(db, 'zillow_imports'),
      where('ownerFinanceVerified', '==', true),
      where('nearbyCities', 'array-contains', searchCity),
      limit(fetchLimit)
    );

    // Execute ALL queries in parallel for maximum performance
    const [propertiesDirectSnapshot, propertiesNearbySnapshot, zillowDirectSnapshot, zillowNearbySnapshot] = await Promise.all([
      getDocs(propertiesDirectQuery),
      getDocs(propertiesNearbyQuery),
      getDocs(zillowDirectQuery),
      getDocs(zillowNearbyQuery)
    ]);

    // Merge snapshots (dedupe by ID)
    const propertiesMap = new Map();
    propertiesDirectSnapshot.docs.forEach(doc => propertiesMap.set(doc.id, doc));
    propertiesNearbySnapshot.docs.forEach(doc => propertiesMap.set(doc.id, doc));
    const propertiesSnapshot = { docs: Array.from(propertiesMap.values()) };

    const zillowMap = new Map();
    zillowDirectSnapshot.docs.forEach(doc => zillowMap.set(doc.id, doc));
    zillowNearbySnapshot.docs.forEach(doc => zillowMap.set(doc.id, doc));
    const zillowSnapshot = { docs: Array.from(zillowMap.values()) };

    console.log(`📊 [buyer-search] Query results: ${propertiesSnapshot.docs.length} curated, ${zillowSnapshot.docs.length} zillow`);

    // Combine results from both sources
    const curatedProperties = propertiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        description: data.description || '', // Explicitly include description
        source: 'curated' // Tag for UI
      } as PropertyListing & { id: string; source: string };
    });

    const zillowProperties = zillowSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        source: 'zillow',
        // Field mapping for UI compatibility (Zillow fields -> PropertyListing schema)
        // Use streetAddress for display, fullAddress only for complete address
        address: data.streetAddress || data.address?.split(',')[0]?.trim() || data.fullAddress?.split(',')[0]?.trim(),
        streetAddress: data.streetAddress || data.address?.split(',')[0]?.trim() || data.fullAddress?.split(',')[0]?.trim(),
        fullAddress: data.fullAddress || `${data.streetAddress || data.address}, ${data.city}, ${data.state} ${data.zipCode || data.zipcode}`,
        squareFeet: data.squareFoot || data.squareFeet,
        lotSize: data.lotSquareFoot || data.lotSize,
        listPrice: data.price || data.listPrice,
        termYears: data.loanTermYears || data.termYears,
        propertyType: data.homeType || data.buildingType || data.propertyType,
        imageUrl: data.firstPropertyImage || data.imageUrl,
        imageUrls: data.propertyImages || data.imageUrls || [],
        description: data.description || '', // Explicitly include description
        // Property details mapping
        bedrooms: data.bedrooms || 0,
        bathrooms: data.bathrooms || 0,
        yearBuilt: data.yearBuilt || null,
        stories: data.stories || null,
        garage: data.garage || null,
        parking: data.parking || null,
        heating: data.heating || null,
        cooling: data.cooling || null,
        features: data.features || [],
        appliances: data.appliances || [],
        neighborhood: data.neighborhood || data.subdivision || null,
        daysOnMarket: data.daysOnZillow || null,
        // Contact info mapping
        agentPhone: data.agentPhoneNumber || data.brokerPhoneNumber || null,
        agentName: data.agentName || data.brokerName || null,
        agentEmail: data.agentEmail || null,
        // Market estimates mapping (zillow field names -> PropertyListing schema)
        estimatedValue: data.estimate || data.zestimate || null,
        rentZestimate: data.rentEstimate || data.rentZestimate || null,
        pricePerSqFt: data.price && data.squareFoot ? Math.round(data.price / data.squareFoot) : null,
        // HOA mapping (convert number to object structure)
        hoa: data.hoa ? { hasHOA: true, monthlyFee: data.hoa } : null,
        // Taxes mapping (convert number to object structure)
        taxes: data.annualTaxAmount ? { annualAmount: data.annualTaxAmount } : null,
        // Calculate down payment percentage if not provided
        downPaymentPercent: data.downPaymentPercent || (data.downPaymentAmount && data.price ?
          Math.round((data.downPaymentAmount / data.price) * 100) : null),
        // Owner finance keywords for display
        ownerFinanceKeyword: data.primaryKeyword || data.matchedKeywords?.[0] || 'Owner Financing',
        matchedKeywords: data.matchedKeywords || [],
        // NO CALCULATIONS OR ASSUMPTIONS - Only use data from GHL/agent
        monthlyPayment: data.monthlyPayment || null, // TBD if not provided
        downPaymentAmount: data.downPaymentAmount || null, // TBD if not provided
        isActive: data.status !== 'sold' && data.status !== 'pending',
      } as PropertyListing & {
        id: string;
        source: string;
        ownerFinanceKeyword: string;
        matchedKeywords: string[];
      };
    });

    // 🆕 Combine and filter out passed properties FIRST (before any processing)
    // UNLESS includePassed=true is specified
    const allPropertiesBeforeFilter = [...curatedProperties, ...zillowProperties];
    const allProperties = includePassed
      ? allPropertiesBeforeFilter // Show all properties including passed ones
      : allPropertiesBeforeFilter.filter(p => !passedPropertyIds.includes(p.id)); // Filter out passed

    const passedCount = allPropertiesBeforeFilter.length - allProperties.length;
    if (includePassed) {
      console.log(`ℹ️  [buyer-search] includePassed=true - showing all ${allPropertiesBeforeFilter.length} properties (including ${passedPropertyIds.length} passed)`);
    } else if (passedCount > 0) {
      console.log(`✅ [buyer-search] Filtered out ${passedCount} passed properties`);
    }

    // Helper function to check if property matches buyer's filters
    const matchesPropertyFilters = (property: PropertyListing & { id: string }) => {
      // Bedrooms filter
      if (buyerFilters.minBedrooms !== undefined && property.bedrooms < buyerFilters.minBedrooms) {
        return false;
      }
      if (buyerFilters.maxBedrooms !== undefined && property.bedrooms > buyerFilters.maxBedrooms) {
        return false;
      }

      // Bathrooms filter
      if (buyerFilters.minBathrooms !== undefined && property.bathrooms < buyerFilters.minBathrooms) {
        return false;
      }
      if (buyerFilters.maxBathrooms !== undefined && property.bathrooms > buyerFilters.maxBathrooms) {
        return false;
      }

      // Square feet filter
      if (buyerFilters.minSquareFeet !== undefined && property.squareFeet && property.squareFeet < buyerFilters.minSquareFeet) {
        return false;
      }
      if (buyerFilters.maxSquareFeet !== undefined && property.squareFeet && property.squareFeet > buyerFilters.maxSquareFeet) {
        return false;
      }

      // Asking price filter
      const askingPrice = property.listPrice || (property.price as number | undefined);
      if (buyerFilters.minPrice !== undefined && askingPrice && askingPrice < buyerFilters.minPrice) {
        return false;
      }
      if (buyerFilters.maxPrice !== undefined && askingPrice && askingPrice > buyerFilters.maxPrice) {
        return false;
      }

      return true;
    };

    // 1. DIRECT MATCHES: Properties IN the search city AND state
    // Location + property filters (bedrooms, bathrooms, sqft, asking price)
    const directProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();
      const locationMatch = propertyCity?.toLowerCase() === searchCity.toLowerCase();
      return locationMatch && matchesPropertyFilters(property);
    });

    // 2. NEARBY MATCHES: Properties located IN cities that are within 30 miles
    // Location + property filters (bedrooms, bathrooms, sqft, asking price)
    // PERF: Pre-compute partial match patterns once instead of O(n*m) per property
    const searchCityLower = searchCity.toLowerCase();
    const nearbyCityArray = Array.from(nearbyCityNames);

    const nearbyProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();
      const propCityLower = propertyCity?.toLowerCase();

      // Must be different city (state already filtered in query)
      if (propCityLower === searchCityLower) return false;

      // PERF: O(1) exact match first, then O(m) partial match only if needed
      if (!propCityLower) return false;

      // Fast path: exact match
      if (nearbyCityNames.has(propCityLower)) {
        return matchesPropertyFilters(property);
      }

      // Slow path: partial match (only for edge cases like "Iowa" vs "Iowa Park")
      const partialMatch = nearbyCityArray.some(buyerCity =>
        propCityLower.startsWith(buyerCity + ' ') ||
        propCityLower.includes(' ' + buyerCity) ||
        buyerCity.startsWith(propCityLower + ' ') ||
        buyerCity.includes(' ' + propCityLower)
      );
      return partialMatch && matchesPropertyFilters(property);
    });

    // 3. LIKED PROPERTIES: Always include liked properties regardless of search criteria
    // Need separate query since liked properties might not be in buyer's state
    let likedProperties: Array<PropertyListing & { id: string }> = [];

    console.log(`\n📊 [BUYER SEARCH] ===== Match Results =====`);
    console.log(`   Direct matches (in ${searchCity}): ${directProperties.length}`);
    console.log(`   Nearby matches: ${nearbyProperties.length}`);

    // Show which nearby cities had matches
    if (nearbyProperties.length > 0) {
      const nearbyCitiesWithMatches = [...new Set(nearbyProperties.map(p => p.city?.split(',')[0].trim()))];
      console.log(`   ✅ Nearby cities with properties: ${nearbyCitiesWithMatches.slice(0, 5).join(', ')}${nearbyCitiesWithMatches.length > 5 ? ` (+${nearbyCitiesWithMatches.length - 5} more)` : ''}`);
    } else {
      console.warn(`   ⚠️  No nearby city matches found. Check if properties exist in nearby cities.`);
    }
    if (likedPropertyIds.length > 0) {
      // First check if any liked properties are in our already-fetched results
      const likedInResults = allProperties.filter(property =>
        likedPropertyIds.includes(property.id)
      );

      // For any liked properties not in results, fetch them separately in batches of 10
      const missingLikedIds = likedPropertyIds.filter(id =>
        !allProperties.some(p => p.id === id)
      );

      if (missingLikedIds.length > 0) {
        // Firestore 'in' operator supports max 10 values
        for (let i = 0; i < missingLikedIds.length; i += 10) {
          const batchIds = missingLikedIds.slice(i, i + 10);
          // PERF: documentId imported at top level instead of dynamic import in loop

          const likedQuery = query(
            collection(db, 'properties'),
            where(documentId(), 'in', batchIds),
            where('isActive', '==', true)
          );

          const likedSnapshot = await getDocs(likedQuery);
          const likedBatch = likedSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              description: data.description || '' // Explicitly include description
            } as PropertyListing & { id: string };
          });

          likedInResults.push(...likedBatch);
        }
      }

      likedProperties = likedInResults;
    }

    // Log liked properties count and total results
    console.log(`   Liked properties: ${likedProperties.length}`);
    console.log(`   Total unique results: ${new Set([...directProperties, ...nearbyProperties, ...likedProperties].map(p => p.id)).size}`);

    // 4. COMBINE AND FORMAT FOR BUYER DASHBOARD (NO BUDGET TAGS)
    const processedResults = new Map();

    // First add liked properties (highest priority)
    likedProperties.forEach(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      const isInSearchCity = propertyCity?.toLowerCase() === searchCity.toLowerCase() && property.state === searchState;

      let displayTag = '❤️ Liked';
      let matchReason = 'Previously liked';
      let sortOrder = 0; // Highest priority for liked

      if (isInSearchCity) {
        displayTag = '❤️ Liked';
        matchReason = `Previously liked - located in ${searchCity}`;
      } else if (property.state !== searchState) {
        displayTag = `❤️ Liked from ${property.city}`;
        matchReason = `Previously liked from ${property.city}, ${property.state}`;
      }

      processedResults.set(property.id, {
        ...property,
        resultType: 'liked',
        displayTag,
        sortOrder,
        matchReason,
        isLiked: true
      });
    });

    // Then add direct properties (if not already added as liked)
    directProperties.forEach(property => {
      if (!processedResults.has(property.id)) {
        processedResults.set(property.id, {
          ...property,
          resultType: 'direct',
          displayTag: `In ${searchCity}`,
          sortOrder: 1,
          matchReason: `Located in ${searchCity}`,
          isLiked: false
        });
      } else {
        // If it's already added as liked, update the match reason
        const existing = processedResults.get(property.id);
        existing.matchReason = `❤️ Liked - located in ${searchCity}`;
        existing.displayTag = '❤️ Liked';
      }
    });

    // Finally add nearby properties (if not already added)
    nearbyProperties.forEach(property => {
      if (!processedResults.has(property.id)) {
        const propertyCity = property.city?.split(',')[0].trim();
        processedResults.set(property.id, {
          ...property,
          resultType: 'nearby',
          displayTag: 'Nearby',
          sortOrder: 2,
          matchReason: `Near ${searchCity} (in ${propertyCity})`,
          isLiked: false
        });
      } else {
        // If it's already added as liked, update to show it's also nearby
        const existing = processedResults.get(property.id);
        if (existing.resultType === 'liked') {
          const propertyCity = property.city?.split(',')[0].trim();
          existing.matchReason = `❤️ Liked - near ${searchCity} (in ${propertyCity})`;
          existing.displayTag = '❤️ Liked • Nearby';
        }
      }
    });

    // Sort all results
    const sortedResults = Array.from(processedResults.values())
      .sort((a, b) => {
        // First sort by sortOrder (liked -> direct -> nearby)
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        // Then by monthly payment (lowest first)
        const aPayment = a.monthlyPayment || 999999;
        const bPayment = b.monthlyPayment || 999999;
        return aPayment - bPayment;
      });

    // PAGINATION: Apply page offset and limit
    const totalResults = sortedResults.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const allResults = sortedResults.slice(startIndex, endIndex);
    const hasMore = endIndex < totalResults;

    // Debug logging
    console.log(`Properties API Debug:
      Total properties in DB: ${allProperties.length}
      Search city: ${searchCity}, state: ${searchState}
      Direct matches: ${directProperties.length}
      Nearby matches: ${nearbyProperties.length}
      Liked matches: ${likedProperties.length}
      Total results: ${allResults.length}
      Page: ${page}/${Math.ceil(totalResults / pageSize)}
    `);

    // PERF: Add cache headers - client can cache for 60s, CDN can cache for 5 min
    const response = NextResponse.json({
      properties: allResults,
      total: totalResults, // Total matching properties (not just this page)
      page,
      pageSize,
      hasMore,
      totalPages: Math.ceil(totalResults / pageSize),
      breakdown: {
        liked: likedProperties.length,
        direct: directProperties.length,
        nearby: nearbyProperties.length,
        totalLikedIncluded: sortedResults.filter(p => p.resultType === 'liked').length,
        totalPropertiesInDB: allProperties.length
      },
      searchCriteria: {
        city: searchCity,
        state: searchState
      }
    });
    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
    return response;

  } catch (error) {
    logError('GET /api/buyer/properties', error, {
      userId: session.user.id
    });
    return ErrorResponses.databaseError('Failed to load buyer properties', error);
  }
}