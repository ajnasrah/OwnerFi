import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  collection,
  query,
  getDocs,
  where,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';
import { BuyerAdminView, firestoreToBuyerProfile, toBuyerAdminView } from '@/lib/view-models';
import { convertTimestampToDate } from '@/lib/firebase-models';
import { getCitiesWithinRadiusComprehensive } from '@/lib/comprehensive-cities';

// Property filter interface matching buyer profile fields
interface BuyerFilters {
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  minPrice?: number;
  maxPrice?: number;
}

// Helper function to check if property matches buyer's filters
// Matches the logic in /api/buyer/properties/route.ts
function matchesPropertyFilters(property: any, filters: BuyerFilters): boolean {
  // Bedrooms filter
  if (filters.minBedrooms !== undefined && property.bedrooms < filters.minBedrooms) {
    return false;
  }
  if (filters.maxBedrooms !== undefined && property.bedrooms > filters.maxBedrooms) {
    return false;
  }

  // Bathrooms filter
  if (filters.minBathrooms !== undefined && property.bathrooms < filters.minBathrooms) {
    return false;
  }
  if (filters.maxBathrooms !== undefined && property.bathrooms > filters.maxBathrooms) {
    return false;
  }

  // Square feet filter
  if (filters.minSquareFeet !== undefined && property.squareFeet && property.squareFeet < filters.minSquareFeet) {
    return false;
  }
  if (filters.maxSquareFeet !== undefined && property.squareFeet && property.squareFeet > filters.maxSquareFeet) {
    return false;
  }

  // Asking price filter
  const askingPrice = property.listPrice || property.price;
  if (filters.minPrice !== undefined && askingPrice && askingPrice < filters.minPrice) {
    return false;
  }
  if (filters.maxPrice !== undefined && askingPrice && askingPrice > filters.maxPrice) {
    return false;
  }

  return true;
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to geocode a city using Google Maps API
async function geocodeCity(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleApiKey) return null;

    const address = `${city}, ${state}, USA`;
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`,
      { cache: 'force-cache' } // Cache geocoding results
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
      return {
        lat: data.results[0].geometry.location.lat,
        lng: data.results[0].geometry.location.lng
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// GET - Fetch all buyers
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Add pagination support and radius filtering
    const { searchParams } = new URL(request.url);
    const searchLat = searchParams.get('lat');
    const searchLng = searchParams.get('lng');
    const searchRadius = searchParams.get('radius');

    // Get all users with role 'buyer' with pagination
    const usersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'buyer')
    );

    const usersSnapshot = await getDocs(usersQuery);

    // Get all buyer profiles
    const buyerProfilesSnapshot = await getDocs(collection(db, 'buyerProfiles'));

    // Create a map of buyer profiles by user ID
    const buyerProfilesMap = new Map();
    buyerProfilesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        buyerProfilesMap.set(data.userId, firestoreToBuyerProfile(doc.id, data));
      }
    });

    // 🆕 EFFICIENT MATCHING LOGIC: Use pre-computed filters + optimized queries
    // Instead of loading ALL properties, we query by state and use pre-computed nearby cities
    const matchedCountsMap = new Map<string, number>();
    const likedCountsMap = new Map<string, number>();

    // Group buyers by state to batch property queries
    // No budget requirement - count properties based on whatever filters buyer has set
    const buyersByState = new Map<string, any[]>();
    buyerProfilesMap.forEach((buyerProfile, userId) => {
      const state = buyerProfile.preferredState || buyerProfile.state;
      if (!state) {
        matchedCountsMap.set(userId, 0);
        return;
      }

      if (!buyersByState.has(state)) {
        buyersByState.set(state, []);
      }
      buyersByState.get(state)!.push({ userId, profile: buyerProfile });
    });

    // Query properties by state (much more efficient than querying all)
    const statePropertyQueries = Array.from(buyersByState.keys()).map(async (state) => {
      const stateQuery = query(
        collection(db, 'properties'),
        where('state', '==', state),
        where('isActive', '==', true)
      );

      const zillowQuery = query(
        collection(db, 'zillow_imports'),
        where('state', '==', state),
        where('ownerFinanceVerified', '==', true)
      );

      const [propertiesSnapshot, zillowSnapshot] = await Promise.all([
        getDocs(stateQuery),
        getDocs(zillowQuery)
      ]);

      const stateProperties = [
        ...propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...zillowSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      ];

      return { state, properties: stateProperties };
    });

    const statePropertiesResults = await Promise.all(statePropertyQueries);
    const propertiesByState = new Map(
      statePropertiesResults.map(r => [r.state, r.properties])
    );

    // Cache for city radius calculations (avoid recalculating for buyers in same city)
    const cityRadiusCache = new Map<string, Set<string>>();

    // Calculate matches for each buyer using their filters
    // Matches the logic in /api/buyer/properties/route.ts
    buyerProfilesMap.forEach((buyerProfile, userId) => {
      const state = buyerProfile.preferredState || buyerProfile.state;
      if (!state) {
        matchedCountsMap.set(userId, 0);
        return;
      }

      const stateProperties = propertiesByState.get(state) || [];
      if (stateProperties.length === 0) {
        matchedCountsMap.set(userId, 0);
        return;
      }

      // Get nearby cities - use pre-computed filter or calculate on-the-fly as fallback
      let nearbyCityNames: Set<string>;
      if (buyerProfile.filter?.nearbyCities && buyerProfile.filter.nearbyCities.length > 0) {
        // Use pre-computed nearby cities (fast path)
        nearbyCityNames = new Set(
          buyerProfile.filter.nearbyCities.map((c: string) => c.toLowerCase())
        );
      } else {
        // Fallback: Calculate on-the-fly if no filter exists (with caching)
        const searchCity = buyerProfile.preferredCity || buyerProfile.city;
        if (searchCity) {
          const cacheKey = `${searchCity.toLowerCase()}_${state}`;
          if (cityRadiusCache.has(cacheKey)) {
            // Use cached result
            nearbyCityNames = cityRadiusCache.get(cacheKey)!;
          } else {
            // Calculate and cache
            const nearbyCitiesList = getCitiesWithinRadiusComprehensive(searchCity, state, 30);
            nearbyCityNames = new Set(
              nearbyCitiesList.map(city => city.name.toLowerCase())
            );
            cityRadiusCache.set(cacheKey, nearbyCityNames);
          }
        } else {
          // No city specified - show all properties in state
          nearbyCityNames = new Set();
        }
      }

      // Extract buyer's property filters (whatever they've set)
      const buyerFilters: BuyerFilters = {
        minBedrooms: buyerProfile.minBedrooms,
        maxBedrooms: buyerProfile.maxBedrooms,
        minBathrooms: buyerProfile.minBathrooms,
        maxBathrooms: buyerProfile.maxBathrooms,
        minSquareFeet: buyerProfile.minSquareFeet,
        maxSquareFeet: buyerProfile.maxSquareFeet,
        minPrice: buyerProfile.minPrice,
        maxPrice: buyerProfile.maxPrice,
      };

      // Count matching properties (same logic as buyer properties API)
      const matchCount = stateProperties.filter((property: any) => {
        const propCity = property.city?.split(',')[0].trim().toLowerCase();

        // Location filter: Must be in buyer's search area
        if (nearbyCityNames.size > 0 && propCity) {
          // Check for exact match OR partial match (e.g., "Iowa" matches "Iowa Park")
          const hasMatch = nearbyCityNames.has(propCity) ||
            Array.from(nearbyCityNames).some(buyerCity =>
              propCity.startsWith(buyerCity + ' ') || // "iowa park" starts with "iowa "
              propCity.includes(' ' + buyerCity) ||   // contains " iowa"
              buyerCity.startsWith(propCity + ' ') || // buyer's "iowa park" matches property "iowa"
              buyerCity.includes(' ' + propCity)
            );
          if (!hasMatch) {
            return false; // Property not in buyer's radius
          }
        }

        // Apply property filters (beds, baths, sqft, price)
        if (!matchesPropertyFilters(property, buyerFilters)) {
          return false;
        }

        return true;
      }).length;

      matchedCountsMap.set(userId, matchCount);
    });

    // Get liked counts from BOTH sources:
    // 1. likedPropertyIds array in buyerProfiles (current system)
    // 2. likedProperties collection (legacy system - some buyers may have data here)
    const allUserIds = Array.from(buyerProfilesMap.keys());

    // Query legacy likedProperties collection for all buyers in parallel
    const likedPropertiesPromises = allUserIds.map(async (userId) => {
      const likedQuery = query(
        collection(db, 'likedProperties'),
        where('buyerId', '==', userId)
      );
      const snapshot = await getDocs(likedQuery);
      return { userId, count: snapshot.size };
    });

    const legacyLikedResults = await Promise.all(likedPropertiesPromises);
    const legacyLikedMap = new Map(legacyLikedResults.map(r => [r.userId, r.count]));

    // Calculate liked counts combining both sources (deduplicated by taking max)
    buyerProfilesMap.forEach((buyerProfile, userId) => {
      const arrayCount = buyerProfile.likedPropertyIds?.length || 0;
      const legacyCount = legacyLikedMap.get(userId) || 0;
      // Use the higher count since they may have different data
      likedCountsMap.set(userId, Math.max(arrayCount, legacyCount));
    });

    const buyers: BuyerAdminView[] = [];
    const buyersWithDistance: Array<BuyerAdminView & { distance?: number }> = [];

    // Parse filter parameters
    const hasLocationFilter = searchLat && searchLng && searchRadius;
    const centerLat = searchLat ? parseFloat(searchLat) : null;
    const centerLng = searchLng ? parseFloat(searchLng) : null;
    const radiusMiles = searchRadius ? parseFloat(searchRadius) : null;
    const stateFilter = searchParams.get('state')?.toUpperCase();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const buyerProfile = buyerProfilesMap.get(userDoc.id);

      if (!buyerProfile) continue; // Skip users without buyer profiles

      // Get matched properties count from pre-computed map (no query here!)
      const matchedPropertiesCount = matchedCountsMap.get(userDoc.id) || 0;

      // Get liked properties count from pre-computed map (combines both collections)
      const likedPropertiesCount = likedCountsMap.get(userDoc.id) || 0;

      const buyer = toBuyerAdminView(buyerProfile, {
        matchedPropertiesCount,
        likedPropertiesCount,
        loginCount: userData.loginCount || 0,
        lastSignIn: convertTimestampToDate(userData.lastSignIn),
      });

      // Apply state filter first (fast filter)
      if (stateFilter) {
        const buyerState = (buyer.preferredState || buyer.state || '').toUpperCase();
        if (buyerState !== stateFilter) {
          continue; // Skip buyers not in the selected state
        }
      }

      buyers.push(buyer);
    }

    // Apply location-based filtering if coordinates provided
    let filteredBuyers = buyers;

    if (hasLocationFilter && centerLat !== null && centerLng !== null && radiusMiles !== null) {
      // Geocode each buyer's city and calculate distance
      for (const buyer of buyers) {
        const buyerCity = buyer.preferredCity || buyer.city;
        const buyerState = buyer.preferredState || buyer.state;

        if (buyerCity && buyerState) {
          const coords = await geocodeCity(buyerCity, buyerState);

          if (coords) {
            const distance = calculateDistance(centerLat, centerLng, coords.lat, coords.lng);

            if (distance <= radiusMiles) {
              buyersWithDistance.push({ ...buyer, distance });
            }
          }
        }
      }

      // Sort by distance (closest first)
      buyersWithDistance.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      filteredBuyers = buyersWithDistance;
    } else {
      // Sort by creation date (newest first)
      filteredBuyers.sort((a, b) => {
        const dateA = a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt
          ? (a.createdAt as any).toDate().getTime()
          : new Date(a.createdAt as any).getTime();
        const dateB = b.createdAt && typeof b.createdAt === 'object' && 'toDate' in b.createdAt
          ? (b.createdAt as any).toDate().getTime()
          : new Date(b.createdAt as any).getTime();
        return dateB - dateA;
      });
    }

    // Implement pagination
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = 100; // Increased from 50 to show more buyers per page
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedBuyers = filteredBuyers.slice(startIndex, endIndex);

    return NextResponse.json({
      buyers: paginatedBuyers,
      total: filteredBuyers.length,
      totalPages: Math.ceil(filteredBuyers.length / pageSize),
      currentPage: page,
      pageSize: pageSize
    });

  } catch (error) {
    await logError('Failed to fetch buyers', {
      action: 'admin_buyers_fetch'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to fetch buyers' },
      { status: 500 }
    );
  }
}

// DELETE - Delete selected buyers
export async function DELETE(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { buyerIds } = await request.json();

    if (!buyerIds || !Array.isArray(buyerIds) || buyerIds.length === 0) {
      return NextResponse.json(
        { error: 'No buyer IDs provided' },
        { status: 400 }
      );
    }

    // Delete buyers from users collection and their profiles
    let deletedCount = 0;
    const errors: string[] = [];

    // PERFORMANCE FIX: Replace N+1 sequential queries with parallel batch operations
    // OLD: 100 buyers = 300 sequential queries = 30+ seconds
    // NEW: Parallel queries + batch delete = 2-3 seconds

    // Step 1: Query all related data in parallel (not sequential!)
    const allProfilesPromises = buyerIds.map(buyerId =>
      getDocs(query(collection(db, 'buyerProfiles'), where('userId', '==', buyerId)))
    );
    const allLikedPromises = buyerIds.map(buyerId =>
      getDocs(query(collection(db, 'likedProperties'), where('buyerId', '==', buyerId)))
    );
    const allMatchedPromises = buyerIds.map(buyerId =>
      getDocs(query(collection(db, 'propertyBuyerMatches'), where('buyerId', '==', buyerId)))
    );

    // Execute all queries in parallel (3 concurrent batches)
    const [allProfiles, allLiked, allMatched] = await Promise.all([
      Promise.all(allProfilesPromises),
      Promise.all(allLikedPromises),
      Promise.all(allMatchedPromises)
    ]);

    // Step 2: Collect all documents to delete
    const docsToDelete: { ref: any; buyerId: string }[] = [];

    buyerIds.forEach((buyerId, index) => {
      // User document
      docsToDelete.push({
        ref: doc(db, 'users', buyerId),
        buyerId
      });

      // Profile documents
      allProfiles[index].docs.forEach(profileDoc => {
        docsToDelete.push({
          ref: doc(db, 'buyerProfiles', profileDoc.id),
          buyerId
        });
      });

      // Liked properties documents
      allLiked[index].docs.forEach(likedDoc => {
        docsToDelete.push({
          ref: doc(db, 'likedProperties', likedDoc.id),
          buyerId
        });
      });

      // Matched properties documents
      allMatched[index].docs.forEach(matchedDoc => {
        docsToDelete.push({
          ref: doc(db, 'propertyBuyerMatches', matchedDoc.id),
          buyerId
        });
      });
    });

    // Step 3: Delete in batches (max 500 operations per batch)
    const { writeBatch } = await import('firebase/firestore');
    const BATCH_SIZE = 500;
    const batches = [];

    console.log(`🗑️  DELETING ${buyerIds.length} buyers with ${docsToDelete.length} total documents`);
    console.log(`📋 Buyer IDs to delete:`, buyerIds);
    console.log(`📋 Documents breakdown:`, {
      users: buyerIds.length,
      profiles: allProfiles.reduce((sum, docs) => sum + docs.size, 0),
      liked: allLiked.reduce((sum, docs) => sum + docs.size, 0),
      matched: allMatched.reduce((sum, docs) => sum + docs.size, 0)
    });

    for (let i = 0; i < docsToDelete.length; i += BATCH_SIZE) {
      const chunk = docsToDelete.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      chunk.forEach(({ ref }) => {
        batch.delete(ref);
      });

      batches.push(batch.commit());
    }

    try {
      await Promise.all(batches);
      deletedCount = buyerIds.length;
      console.log(`✅ PERMANENT DELETION COMPLETE: Deleted ${deletedCount} buyers and ${docsToDelete.length} related documents in ${batches.length} batch(es)`);
      console.log(`✅ Collections cleaned: users, buyerProfiles, likedProperties, propertyBuyerMatches`);
    } catch (error) {
      console.error('❌ Failed to delete buyers:', error);
      errors.push(...buyerIds); // Mark all as failed if batch deletion fails
    }

    if (errors.length > 0) {
      await logError('Failed to delete some buyers', {
        action: 'admin_buyers_delete'
      }, new Error('Partial deletion failure'));

      return NextResponse.json({
        deletedCount,
        failedCount: errors.length,
        message: `Deleted ${deletedCount} buyers, ${errors.length} failed`
      });
    }

    return NextResponse.json({
      deletedCount,
      message: `Successfully deleted ${deletedCount} buyer(s)`
    });

  } catch (error) {
    await logError('Failed to delete buyers', {
      action: 'admin_buyers_delete'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to delete buyers' },
      { status: 500 }
    );
  }
}