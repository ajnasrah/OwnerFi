import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PropertyListing } from "@/lib/property-schema";
import { getCitiesWithinRadiusComprehensive } from '@/lib/comprehensive-cities';
import { checkDatabaseAvailable, applyRateLimit, getClientIp } from '@/lib/api-guards';
import { requireAuth } from '@/lib/auth-helpers';
import { ErrorResponses, createSuccessResponse, logError } from '@/lib/api-error-handler';

/**
 * BUYER PROPERTY API WITH NEARBY CITIES
 *
 * Shows properties that match buyer's simple criteria:
 * 1. DIRECT: Properties in the exact search city
 * 2. NEARBY: Properties IN nearby cities (within 30 miles of buyer's search city)
 * 3. Budget filters: Monthly payment <= budget, Down payment <= budget
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
    const maxMonthlyPayment = searchParams.get('maxMonthlyPayment');
    const maxDownPayment = searchParams.get('maxDownPayment');
    const pageSize = parseInt(searchParams.get('limit') || '50'); // Default 50 properties per page
    const page = parseInt(searchParams.get('page') || '1'); // Default page 1
    const includePassed = searchParams.get('includePassed') === 'true'; // Show passed properties

    if (!city || !state || !maxMonthlyPayment || !maxDownPayment) {
      return ErrorResponses.validationError(
        'Missing required parameters: city, state, maxMonthlyPayment, maxDownPayment'
      );
    }

    // Validate and parse numeric inputs
    const maxMonthly = Number(maxMonthlyPayment);
    const maxDown = Number(maxDownPayment);

    if (isNaN(maxMonthly) || maxMonthly < 0) {
      return ErrorResponses.validationError(
        'Invalid maxMonthlyPayment: must be a positive number'
      );
    }

    if (isNaN(maxDown) || maxDown < 0) {
      return ErrorResponses.validationError(
        'Invalid maxDownPayment: must be a positive number'
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

    if (!buyerSnapshot.empty) {
      const profile = buyerSnapshot.docs[0].data();
      likedPropertyIds = profile.likedProperties || profile.likedPropertyIds || [];
      passedPropertyIds = profile.passedPropertyIds || []; // 🆕 Get passed properties

      // ALWAYS calculate nearby cities on-the-fly for accuracy
      // This ensures Memphis buyers always see Collierville (bordering city)
      const nearbyCitiesList = getCitiesWithinRadiusComprehensive(searchCity, searchState, 30);
      nearbyCityNames = new Set(
        nearbyCitiesList.map(city => city.name.toLowerCase())
      );
      console.log(`✅ [buyer-search] Calculated nearby cities: ${nearbyCityNames.size} cities`);
    }

    console.log(`[buyer-search] Buyer searching for ${searchCity}, ${searchState}`);
    console.log(`[buyer-search] Using filter with ${nearbyCityNames.size} nearby cities:`,
      Array.from(nearbyCityNames).slice(0, 10).join(', ') + (nearbyCityNames.size > 10 ? '...' : '')
    );

    // ===== QUERY PROPERTIES FROM TWO SOURCES =====

    // 1. Curated properties (existing system)
    // PAGINATION: Limit initial queries to reduce bandwidth and improve performance
    // We'll fetch more than needed to account for filtering
    const fetchLimit = Math.min(pageSize * 3, 300); // Fetch 3x pageSize, max 300

    const propertiesQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('state', '==', searchState),
      orderBy('monthlyPayment', 'asc'),
      limit(fetchLimit)
    );

    // 2. Zillow scraped properties (ALL passed strict filter - 100% verified owner finance)
    // Show ALL properties regardless of status (status only changes when terms are filled)
    const zillowQuery = query(
      collection(db, 'zillow_imports'),
      where('state', '==', searchState),
      where('ownerFinanceVerified', '==', true), // All with owner finance keywords
      limit(fetchLimit)
    );

    // Execute queries in parallel for performance
    const [propertiesSnapshot, zillowSnapshot] = await Promise.all([
      getDocs(propertiesQuery),
      getDocs(zillowQuery)
    ]);

    // Combine results from both sources
    const curatedProperties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      source: 'curated' // Tag for UI
    } as PropertyListing & { id: string; source: string }));

    const zillowProperties = zillowSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        source: 'zillow',
        // Field mapping for UI compatibility (Zillow fields -> PropertyListing schema)
        address: data.fullAddress || data.address,
        squareFeet: data.squareFoot || data.squareFeet,
        lotSize: data.lotSquareFoot || data.lotSize,
        listPrice: data.price || data.listPrice,
        termYears: data.loanTermYears || data.termYears,
        propertyType: data.homeType || data.buildingType || data.propertyType,
        imageUrl: data.firstPropertyImage || data.imageUrl,
        imageUrls: data.propertyImages || data.imageUrls || [],
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

    // Helper function to determine budget match type
    // NOTE: Budget filtering DISABLED - all properties shown regardless of budget
    const getBudgetMatchType = (property: PropertyListing & { id: string }) => {
      const monthlyMatch = property.monthlyPayment <= maxMonthly;
      const downMatch = !property.downPaymentAmount || property.downPaymentAmount <= maxDown;

      if (monthlyMatch && downMatch) return 'both';
      if (monthlyMatch) return 'monthly_only';
      if (downMatch) return 'down_only';
      return 'neither';
    };

    // 1. DIRECT MATCHES: Properties IN the search city AND state
    // BUDGET FILTERING DISABLED: Show ALL properties regardless of budget
    const directProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();
      // const budgetMatchType = getBudgetMatchType(property); // DISABLED

      // Show if city matches (no budget filtering)
      return propertyCity?.toLowerCase() === searchCity.toLowerCase();
      // OLD: return propertyCity?.toLowerCase() === searchCity.toLowerCase() && budgetMatchType !== 'neither';
    });

    // 2. NEARBY MATCHES: Properties located IN cities that are within 30 miles
    // BUDGET FILTERING DISABLED: Show ALL properties regardless of budget
    const nearbyProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();

      // Must be different city (state already filtered in query)
      if (propertyCity?.toLowerCase() === searchCity.toLowerCase()) return false;

      // Check if property's city is in the list of nearby cities
      const isInNearbyCity = propertyCity && nearbyCityNames.has(propertyCity.toLowerCase());

      // DISABLED: Budget filtering
      // const budgetMatchType = getBudgetMatchType(property);
      // return isInNearbyCity && budgetMatchType !== 'neither';

      return isInNearbyCity; // Show all nearby properties
    });

    console.log(`[buyer-search] Found ${directProperties.length} direct matches, ${nearbyProperties.length} nearby matches`);

    // 3. LIKED PROPERTIES: Always include liked properties regardless of search criteria
    // Need separate query since liked properties might not be in buyer's state
    let likedProperties: Array<PropertyListing & { id: string }> = [];
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
          const { documentId } = await import('firebase/firestore');

          const likedQuery = query(
            collection(db, 'properties'),
            where(documentId(), 'in', batchIds),
            where('isActive', '==', true)
          );

          const likedSnapshot = await getDocs(likedQuery);
          const likedBatch = likedSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as PropertyListing & { id: string }));

          likedInResults.push(...likedBatch);
        }
      }

      likedProperties = likedInResults;
    }

    // 4. COMBINE AND FORMAT FOR BUYER DASHBOARD WITH SMART DE-DUPLICATION AND 3-TIER BUDGET TAGS
    const processedResults = new Map();

    // Helper to generate budget tag and description
    const getBudgetTagInfo = (property: PropertyListing & { id: string }) => {
      const budgetMatchType = getBudgetMatchType(property);
      const monthlyOver = property.monthlyPayment > maxMonthly ? property.monthlyPayment - maxMonthly : 0;
      const downOver = property.downPaymentAmount > maxDown ? property.downPaymentAmount - maxDown : 0;

      switch (budgetMatchType) {
        case 'both':
          return { tag: '✅ Within Budget', tier: 0, description: 'Fits both monthly and down payment budget' };
        case 'monthly_only':
          return {
            tag: '🟡 Low Monthly Payment',
            tier: 1,
            description: `Monthly payment fits, down payment $${downOver.toLocaleString()} over budget`
          };
        case 'down_only':
          return {
            tag: '🟡 Low Down Payment',
            tier: 1,
            description: `Down payment fits, monthly payment $${monthlyOver.toFixed(0)}/mo over budget`
          };
        case 'neither':
          return {
            tag: '🔴 Over Budget',
            tier: 2,
            description: 'Exceeds both budget criteria'
          };
      }
    };

    // First add liked properties (highest priority)
    likedProperties.forEach(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      const isInSearchCity = propertyCity?.toLowerCase() === searchCity.toLowerCase() && property.state === searchState;
      const budgetInfo = getBudgetTagInfo(property);

      let displayTag = '❤️ Liked';
      let matchReason = 'Previously liked';
      let sortOrder = 0; // Highest priority for liked

      // Add budget tier info to liked properties
      if (budgetInfo.tier > 0) {
        displayTag = `❤️ Liked • ${budgetInfo.tag}`;
        matchReason = `Previously liked - ${budgetInfo.description}`;
      } else if (isInSearchCity) {
        displayTag = '❤️ Liked • ✅ Perfect Match';
        matchReason = `Previously liked - located in ${searchCity}, within budget`;
      } else if (property.state !== searchState) {
        displayTag = `❤️ Liked from ${property.city}`;
        matchReason = `Previously liked from ${property.city}, ${property.state}`;
      } else {
        displayTag = '❤️ Liked';
        matchReason = `Previously liked - ${budgetInfo.description}`;
      }

      processedResults.set(property.id, {
        ...property,
        resultType: 'liked',
        displayTag,
        sortOrder,
        budgetTier: budgetInfo.tier,
        budgetMatchType: getBudgetMatchType(property),
        matchReason,
        isLiked: true
      });
    });

    // Then add direct properties (if not already added as liked)
    directProperties.forEach(property => {
      if (!processedResults.has(property.id)) {
        const budgetInfo = getBudgetTagInfo(property);
        const budgetMatchType = getBudgetMatchType(property);

        // Sort order: Perfect matches (tier 0) get sortOrder 1, partial matches get sortOrder 2-3
        const sortOrder = budgetMatchType === 'both' ? 1 : (budgetMatchType === 'monthly_only' ? 2 : 3);

        processedResults.set(property.id, {
          ...property,
          resultType: 'direct',
          displayTag: budgetInfo.tag,
          sortOrder,
          budgetTier: budgetInfo.tier,
          budgetMatchType,
          matchReason: `Located in ${searchCity} - ${budgetInfo.description}`,
          isLiked: false
        });
      } else {
        // If it's already added as liked, update the match reason to show both
        const existing = processedResults.get(property.id);
        const budgetInfo = getBudgetTagInfo(property);
        existing.matchReason = `❤️ Liked - located in ${searchCity}, ${budgetInfo.description.toLowerCase()}`;
        existing.displayTag = budgetInfo.tier === 0 ? '❤️ Liked • ✅ Perfect Match' : `❤️ Liked • ${budgetInfo.tag}`;
      }
    });

    // Finally add nearby properties (if not already added)
    nearbyProperties.forEach(property => {
      if (!processedResults.has(property.id)) {
        const budgetInfo = getBudgetTagInfo(property);
        const budgetMatchType = getBudgetMatchType(property);

        // Sort order: Perfect matches get 4, partial matches get 5-6
        const sortOrder = budgetMatchType === 'both' ? 4 : (budgetMatchType === 'monthly_only' ? 5 : 6);

        processedResults.set(property.id, {
          ...property,
          resultType: 'nearby',
          displayTag: `Nearby • ${budgetInfo.tag}`,
          sortOrder,
          budgetTier: budgetInfo.tier,
          budgetMatchType,
          matchReason: `Near ${searchCity} (in ${property.city?.split(',')[0].trim()}) - ${budgetInfo.description}`,
          isLiked: false
        });
      } else {
        // If it's already added as liked, update to show it's also nearby
        const existing = processedResults.get(property.id);
        if (existing.resultType === 'liked') {
          const budgetInfo = getBudgetTagInfo(property);
          existing.matchReason = `❤️ Liked - near ${searchCity} (in ${property.city?.split(',')[0].trim()}), ${budgetInfo.description.toLowerCase()}`;
          existing.displayTag = `❤️ Liked • Nearby • ${budgetInfo.tag}`;
        }
      }
    });

    // Sort all results
    const sortedResults = Array.from(processedResults.values())
      .sort((a, b) => {
        // First sort by sortOrder (liked -> direct perfect -> direct partial -> nearby perfect -> nearby partial)
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        // Then by budget tier (perfect -> monthly_only -> down_only)
        if (a.budgetTier !== b.budgetTier) return a.budgetTier - b.budgetTier;
        // Finally by monthly payment (lowest first)
        const aPayment = a.monthlyPayment || 0;
        const bPayment = b.monthlyPayment || 0;
        return aPayment - bPayment;
      });

    // PAGINATION: Apply page offset and limit
    const totalResults = sortedResults.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const allResults = sortedResults.slice(startIndex, endIndex);
    const hasMore = endIndex < totalResults;

    // Debug logging - Enhanced for debugging low results
    console.log(`Properties API Debug:
      Total properties in DB: ${allProperties.length}
      Search city: ${searchCity}, state: ${searchState}
      Budget: $${maxMonthly}/mo, $${maxDown} down
      Direct matches: ${directProperties.length}
      Nearby matches: ${nearbyProperties.length}
      Liked matches: ${likedProperties.length}
      Total results: ${allResults.length}

      Sample property monthly payments: ${allProperties.slice(0, 5).map(p => p.monthlyPayment).join(', ')}
      Sample property down payments: ${allProperties.slice(0, 5).map(p => p.downPaymentAmount).join(', ')}
      Properties filtered out by down payment: ${allProperties.filter(p => p.downPaymentAmount > maxDown).length}
    `);

    return NextResponse.json({
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
        state: searchState,
        maxMonthlyPayment: maxMonthly,
        maxDownPayment: maxDown
      }
    });

  } catch (error) {
    logError('GET /api/buyer/properties', error, {
      userId: session.user.id
    });
    return ErrorResponses.databaseError('Failed to load buyer properties', error);
  }
}