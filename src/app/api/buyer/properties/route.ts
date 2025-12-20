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
import { getTypesenseSearchClient, TYPESENSE_COLLECTIONS } from '@/lib/typesense/client';

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
 *
 * Uses Typesense for fast search with Firestore fallback.
 */

// Search properties using Typesense (fast path)
async function searchWithTypesense(params: {
  city: string;
  state: string;
  buyerFilters: {
    minBedrooms?: number;
    maxBedrooms?: number;
    minBathrooms?: number;
    maxBathrooms?: number;
    minPrice?: number;
    maxPrice?: number;
  };
  limit: number;
}): Promise<Array<PropertyListing & { id: string; source: string }> | null> {
  const client = getTypesenseSearchClient();
  if (!client) return null;

  try {
    console.log('[buyer/properties] Starting Typesense search:', { city: params.city, state: params.state });

    const filters: string[] = [
      'isActive:=true',
      `state:=${params.state}`,
      'dealType:=[owner_finance, both]', // Buyers see owner finance deals
    ];

    // Apply buyer preference filters
    if (params.buyerFilters.minBedrooms !== undefined) {
      filters.push(`bedrooms:>=${params.buyerFilters.minBedrooms}`);
    }
    if (params.buyerFilters.maxBedrooms !== undefined) {
      filters.push(`bedrooms:<=${params.buyerFilters.maxBedrooms}`);
    }
    if (params.buyerFilters.minBathrooms !== undefined) {
      filters.push(`bathrooms:>=${params.buyerFilters.minBathrooms}`);
    }
    if (params.buyerFilters.maxBathrooms !== undefined) {
      filters.push(`bathrooms:<=${params.buyerFilters.maxBathrooms}`);
    }
    if (params.buyerFilters.minPrice !== undefined) {
      filters.push(`listPrice:>=${params.buyerFilters.minPrice}`);
    }
    if (params.buyerFilters.maxPrice !== undefined) {
      filters.push(`listPrice:<=${params.buyerFilters.maxPrice}`);
    }

    const result = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
      .documents()
      .search({
        q: params.city,
        query_by: 'city,nearbyCities,address',
        filter_by: filters.join(' && '),
        sort_by: 'monthlyPayment:asc,listPrice:asc',
        per_page: Math.min(params.limit, 250),
        include_fields: 'id,address,city,state,zipCode,bedrooms,bathrooms,squareFeet,yearBuilt,listPrice,monthlyPayment,downPaymentAmount,propertyType,primaryImage,nearbyCities,ownerFinanceKeywords,financingType,description,sourceType,manuallyVerified,zestimate,rentEstimate',
      });

    // Debug: log first result to see what fields are returned
    if (result.hits && result.hits.length > 0) {
      const firstDoc = (result.hits[0] as any).document;
      console.log('[buyer/properties] First doc fields:', Object.keys(firstDoc));
      console.log('[buyer/properties] First doc primaryImage:', firstDoc.primaryImage);
    }

    // Transform Typesense results to PropertyListing format
    const properties = (result.hits || []).map((hit: Record<string, unknown>) => {
      const doc = hit.document;
      // Get image from multiple possible fields
      const imageUrl = doc.primaryImage || doc.imgSrc || doc.firstPropertyImage || doc.imageUrl || '';
      return {
        id: doc.id,
        address: doc.address || '',
        streetAddress: doc.address || '',
        city: doc.city || '',
        state: doc.state || '',
        zipCode: doc.zipCode || '',
        bedrooms: doc.bedrooms || 0,
        bathrooms: doc.bathrooms || 0,
        squareFeet: doc.squareFeet,
        yearBuilt: doc.yearBuilt,
        listPrice: doc.listPrice || 0,
        monthlyPayment: doc.monthlyPayment,
        downPaymentAmount: doc.downPaymentAmount,
        propertyType: doc.propertyType || 'other',
        // Include ALL image fields for PropertyCard compatibility
        imageUrl,
        imgSrc: imageUrl,
        firstPropertyImage: imageUrl,
        description: doc.description || '',
        isActive: true,
        source: doc.sourceType || 'typesense',
        manuallyVerified: doc.manuallyVerified || false,
        nearbyCities: doc.nearbyCities || [],
        ownerFinanceKeyword: doc.ownerFinanceKeywords?.[0] || 'Owner Financing',
        matchedKeywords: doc.ownerFinanceKeywords || [],
        financingType: doc.financingType || 'Owner Finance',
        // Third-party estimates (from Zillow)
        zestimate: doc.zestimate || null,
        rentEstimate: doc.rentEstimate || null,
      } as PropertyListing & { id: string; source: string; manuallyVerified?: boolean; zestimate?: number; rentEstimate?: number };
    });

    console.log(`[buyer/properties] Typesense returned ${properties.length} properties`);
    return properties;

  } catch (error) {
    console.warn('[buyer/properties] Typesense search failed:', error);
    return null;
  }
}

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

    // Get user's liked/passed properties AND pre-computed filter
    // Check buyerProfiles first, then realtorProfiles for realtors viewing the buyer dashboard
    let likedPropertyIds: string[] = [];
    let passedPropertyIds: string[] = [];
    let nearbyCityNames = new Set<string>();
    let profile: any = null;

    const buyerProfileQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const buyerSnapshot = await getDocs(buyerProfileQuery);

    if (!buyerSnapshot.empty) {
      profile = buyerSnapshot.docs[0].data();
      console.log(`📋 [buyer-search] Using buyerProfile for user ${session.user.id}`);
    } else {
      // Fallback to realtor profile if no buyer profile exists
      const realtorProfileQuery = query(
        collection(db, 'realtorProfiles'),
        where('userId', '==', session.user.id)
      );
      const realtorSnapshot = await getDocs(realtorProfileQuery);
      if (!realtorSnapshot.empty) {
        profile = realtorSnapshot.docs[0].data();
        console.log(`📋 [buyer-search] Using realtorProfile for user ${session.user.id}`);
      }
    }

    // Property filter preferences from profile
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

    if (profile) {
      likedPropertyIds = profile.likedProperties || profile.likedPropertyIds || [];
      passedPropertyIds = profile.passedPropertyIds || [];

      console.log(`📋 [buyer-search] User has ${passedPropertyIds.length} passed properties, ${likedPropertyIds.length} liked properties`);
      if (passedPropertyIds.length > 0 && passedPropertyIds.length < 10) {
        console.log(`📋 [buyer-search] Passed IDs: ${passedPropertyIds.join(', ')}`);
      } else if (passedPropertyIds.length >= 10) {
        console.log(`📋 [buyer-search] First 5 passed IDs: ${passedPropertyIds.slice(0, 5).join(', ')}...`);
      }

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

    // ===== TRY TYPESENSE FIRST (FAST PATH) =====
    const typesenseResults = await searchWithTypesense({
      city: searchCity,
      state: searchState,
      buyerFilters,
      limit: pageSize * 3, // Fetch extra for filtering
    });

    // If Typesense returns results, use them
    if (typesenseResults && typesenseResults.length > 0) {
      // Filter out passed properties (unless includePassed is true)
      const filteredResults = includePassed
        ? typesenseResults
        : typesenseResults.filter(p => !passedPropertyIds.includes(p.id));

      console.log(`📊 [buyer-search] Typesense: ${typesenseResults.length} total, ${filteredResults.length} after filtering passed, ${passedPropertyIds.length} passed IDs`);

      // Mark liked properties
      const processedResults = filteredResults.map(property => {
        const isLiked = likedPropertyIds.includes(property.id);
        const propCityLower = property.city?.toLowerCase() || '';
        const isInSearchCity = propCityLower === searchCity.toLowerCase();

        return {
          ...property,
          resultType: isLiked ? 'liked' : isInSearchCity ? 'direct' : 'nearby',
          displayTag: isLiked ? '❤️ Liked' : isInSearchCity ? `In ${searchCity}` : 'Nearby',
          sortOrder: isLiked ? 0 : isInSearchCity ? 1 : 2,
          matchReason: isLiked
            ? `Previously liked`
            : isInSearchCity
            ? `Located in ${searchCity}`
            : `Near ${searchCity} (in ${property.city})`,
          isLiked,
        };
      });

      // Sort: liked first, then direct, then nearby
      processedResults.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        const aPayment = a.monthlyPayment || 999999;
        const bPayment = b.monthlyPayment || 999999;
        return aPayment - bPayment;
      });

      // Apply pagination
      const totalResults = processedResults.length;
      const startIndex = (page - 1) * pageSize;
      const paginatedResults = processedResults.slice(startIndex, startIndex + pageSize);
      const hasMore = startIndex + pageSize < totalResults;

      console.log(`✅ [buyer-search] Typesense fast path: ${paginatedResults.length} results (page ${page})`);

      return NextResponse.json({
        properties: paginatedResults,
        total: totalResults,
        page,
        pageSize,
        hasMore,
        totalPages: Math.ceil(totalResults / pageSize),
        breakdown: {
          liked: processedResults.filter(p => p.resultType === 'liked').length,
          direct: processedResults.filter(p => p.resultType === 'direct').length,
          nearby: processedResults.filter(p => p.resultType === 'nearby').length,
          totalLikedIncluded: processedResults.filter(p => p.isLiked).length,
          totalPropertiesInDB: typesenseResults.length,
        },
        searchCriteria: { city: searchCity, state: searchState },
        engine: 'typesense',
      });
    }

    // ===== FALLBACK TO FIRESTORE (UNIFIED COLLECTION) =====
    console.log(`⚠️  [buyer-search] Typesense returned no results, falling back to Firestore`);

    // ===== QUERY FROM UNIFIED PROPERTIES COLLECTION =====
    // Use simpler query without composite index requirement

    // PAGINATION: Limit initial queries to reduce bandwidth and improve performance
    const fetchLimit = Math.min(pageSize * 3, 300); // Fetch 3x pageSize, max 300

    let propertiesDirectSnapshot;
    let propertiesNearbySnapshot;

    try {
      // 1. DIRECT matches - owner finance properties in search state
      const propertiesDirectQuery = query(
        collection(db, 'properties'),
        where('isActive', '==', true),
        where('isOwnerFinance', '==', true),
        where('state', '==', searchState),
        limit(fetchLimit)
      );

      // 2. NEARBY matches - owner finance properties where buyer's city is in property's nearbyCities
      const propertiesNearbyQuery = query(
        collection(db, 'properties'),
        where('isActive', '==', true),
        where('isOwnerFinance', '==', true),
        where('nearbyCities', 'array-contains', searchCity),
        limit(fetchLimit)
      );

      // Execute queries in parallel
      [propertiesDirectSnapshot, propertiesNearbySnapshot] = await Promise.all([
        getDocs(propertiesDirectQuery),
        getDocs(propertiesNearbyQuery)
      ]);
    } catch (firestoreError) {
      console.error('[buyer-search] Firestore query failed:', firestoreError);
      return NextResponse.json({
        properties: [],
        total: 0,
        error: 'Database query failed'
      });
    }

    // Merge and dedupe by ID
    const propertiesMap = new Map();
    propertiesDirectSnapshot.docs.forEach(doc => propertiesMap.set(doc.id, doc));
    propertiesNearbySnapshot.docs.forEach(doc => propertiesMap.set(doc.id, doc));

    console.log(`📊 [buyer-search] Query results: ${propertiesMap.size} properties (direct: ${propertiesDirectSnapshot.size}, nearby: ${propertiesNearbySnapshot.size})`);

    // Transform to PropertyListing format
    const allFetchedProperties = Array.from(propertiesMap.values()).map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        source: 'unified',
        // Field mapping for UI compatibility
        address: data.streetAddress || data.address?.split(',')[0]?.trim() || data.fullAddress?.split(',')[0]?.trim(),
        streetAddress: data.streetAddress || data.address?.split(',')[0]?.trim() || data.fullAddress?.split(',')[0]?.trim(),
        fullAddress: data.fullAddress || `${data.streetAddress || data.address}, ${data.city}, ${data.state} ${data.zipCode || data.zipcode}`,
        squareFeet: data.squareFoot || data.squareFeet,
        lotSize: data.lotSquareFoot || data.lotSize,
        listPrice: data.price || data.listPrice,
        termYears: data.loanTermYears || data.termYears,
        propertyType: data.homeType || data.buildingType || data.propertyType,
        imageUrl: data.primaryImage || data.firstPropertyImage || data.imgSrc || data.imageUrl,
        imageUrls: data.propertyImages || data.imageUrls || [],
        description: data.description || '',
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
        agentPhone: data.agentPhoneNumber || data.brokerPhoneNumber || null,
        agentName: data.agentName || data.brokerName || null,
        agentEmail: data.agentEmail || null,
        estimatedValue: data.estimate || data.zestimate || null,
        rentZestimate: data.rentEstimate || data.rentZestimate || null,
        pricePerSqFt: data.price && data.squareFoot ? Math.round(data.price / data.squareFoot) : null,
        hoa: data.hoa ? { hasHOA: true, monthlyFee: data.hoa } : null,
        taxes: data.annualTaxAmount ? { annualAmount: data.annualTaxAmount } : null,
        downPaymentPercent: data.downPaymentPercent || (data.downPaymentAmount && data.price ?
          Math.round((data.downPaymentAmount / data.price) * 100) : null),
        ownerFinanceKeyword: data.primaryKeyword || data.matchedKeywords?.[0] || 'Owner Financing',
        matchedKeywords: data.matchedKeywords || [],
        monthlyPayment: data.monthlyPayment || null,
        downPaymentAmount: data.downPaymentAmount || null,
        isActive: data.isActive !== false && data.status !== 'sold' && data.status !== 'pending',
      } as PropertyListing & {
        id: string;
        source: string;
        ownerFinanceKeyword: string;
        matchedKeywords: string[];
      };
    });

    // Filter out passed properties (unless includePassed=true)
    const allPropertiesBeforeFilter = allFetchedProperties;
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
      const sortOrder = 0; // Highest priority for liked

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