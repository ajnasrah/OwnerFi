import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  where,
  limit as firestoreLimit,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';
import { autoCleanPropertyData } from '@/lib/property-auto-cleanup';
import { getCitiesWithinRadiusComprehensive, getCityCoordinatesComprehensive } from '@/lib/comprehensive-cities';
import { getTypesenseSearchClient, TYPESENSE_COLLECTIONS } from '@/lib/typesense/client';

// Calculate distance between two points using Haversine formula (returns miles)
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Fast field mapper - only essential fields
function mapPropertyFields(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  const price = data.price || data.listPrice || 0;

  return {
    id: doc.id,
    // Core fields only
    fullAddress: data.fullAddress,
    streetAddress: data.streetAddress,
    city: data.city,
    state: data.state,
    zipCode: data.zipCode,
    price,
    squareFoot: data.squareFoot,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    lotSquareFoot: data.lotSquareFoot,
    homeType: data.homeType,
    ownerFinanceVerified: data.ownerFinanceVerified,
    status: data.status,
    // Images
    firstPropertyImage: data.firstPropertyImage,
    propertyImages: data.propertyImages,
    // Timestamps - simplified
    foundAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
    // Financial fields - CRITICAL for buyer-facing display
    monthlyPayment: data.monthlyPayment,
    downPaymentAmount: data.downPaymentAmount,
    downPaymentPercent: data.downPaymentPercent,
    interestRate: data.interestRate,
    termYears: data.termYears,
    balloonYears: data.balloonYears,
    // Admin panel compatibility - use streetAddress (just the street, not full address with city/state/zip)
    address: data.streetAddress || data.fullAddress || data.address,
    squareFeet: data.squareFoot || data.squareFeet,
    imageUrl: data.firstPropertyImage || data.imgSrc || data.imageUrl,
    imageUrls: data.propertyImages || data.imageUrls || [],
    zillowImageUrl: data.firstPropertyImage || data.zillowImageUrl,
    listPrice: price,
    // Description - important for owner finance details
    description: data.description || '',
    // Owner finance keywords
    primaryKeyword: data.primaryKeyword || null,
    matchedKeywords: data.matchedKeywords || [],
    // Agent/Contact info
    agentName: data.agentName || data.listingAgentName || null,
    agentPhone: data.agentPhoneNumber || data.agentPhone || data.brokerPhoneNumber || null,
    agentEmail: data.agentEmail || data.listingAgentEmail || null,
    // Source tracking - CRITICAL for GHL badge
    source: data.source || null,
    agentConfirmedOwnerFinance: data.agentConfirmedOwnerFinance || false,
    originalQueueId: data.originalQueueId || null,
    // Coordinates for radius search
    latitude: data.latitude || null,
    longitude: data.longitude || null,
  };
}

// ============================================
// TYPESENSE SEARCH (Fast Path)
// ============================================
interface TypesenseSearchParams {
  city?: string;
  state?: string;
  radius?: number;
  page?: number;
  limit?: number;
}

async function searchWithTypesense(params: TypesenseSearchParams): Promise<{
  properties: Record<string, unknown>[];
  total: number;
  states: string[];
  engine: 'typesense';
} | null> {
  const client = getTypesenseSearchClient();
  if (!client) return null;

  try {
    const filters: string[] = ['isActive:=true'];
    const limit = params.limit || 200;
    const page = params.page || 1;

    // State filter
    if (params.state) {
      filters.push(`state:=${params.state}`);
    }

    // Geo search if city + radius provided
    let searchQuery = '*';
    if (params.city) {
      const centerCoords = getCityCoordinatesComprehensive(params.city, params.state || '');
      if (centerCoords && params.radius && params.radius > 0) {
        // Use geo radius filter
        filters.push(`location:(${centerCoords.lat}, ${centerCoords.lng}, ${params.radius} mi)`);
      } else {
        // Text search by city name
        searchQuery = params.city;
      }
    }

    const result = await client.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
      .documents()
      .search({
        q: searchQuery,
        query_by: 'city,address,nearbyCities',
        filter_by: filters.join(' && '),
        sort_by: 'createdAt:desc',
        page,
        per_page: limit,
        facet_by: 'state',
      });

    // Extract unique states from facets
    const states: string[] = [];
    if (result.facet_counts) {
      const stateFacet = result.facet_counts.find(f => f.field_name === 'state');
      if (stateFacet) {
        states.push(...stateFacet.counts.map(c => c.value).sort());
      }
    }

    // Transform results to match expected format
    const properties = (result.hits || []).map((hit: Record<string, unknown>) => {
      const doc = hit.document;
      return {
        id: doc.id,
        fullAddress: `${doc.address}, ${doc.city}, ${doc.state} ${doc.zipCode}`,
        streetAddress: doc.address,
        city: doc.city,
        state: doc.state,
        zipCode: doc.zipCode,
        price: doc.listPrice,
        squareFoot: doc.squareFeet,
        bedrooms: doc.bedrooms,
        bathrooms: doc.bathrooms,
        lotSquareFoot: doc.lotSquareFeet,
        homeType: doc.propertyType,
        ownerFinanceVerified: doc.ownerFinanceVerified,
        status: doc.homeStatus,
        firstPropertyImage: doc.primaryImage,
        propertyImages: doc.galleryImages || [],
        foundAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        monthlyPayment: doc.monthlyPayment || null,
        downPaymentAmount: doc.downPaymentAmount || null,
        downPaymentPercent: doc.downPaymentPercent || null,
        interestRate: doc.interestRate || null,
        termYears: doc.termYears || null,
        balloonYears: doc.balloonYears || null,
        address: doc.address,
        squareFeet: doc.squareFeet,
        imageUrl: doc.primaryImage,
        imageUrls: doc.galleryImages || [],
        zillowImageUrl: doc.primaryImage,
        listPrice: doc.listPrice,
        description: doc.description || '',
        primaryKeyword: doc.ownerFinanceKeywords?.[0] || null,
        matchedKeywords: doc.ownerFinanceKeywords || [],
        agentName: doc.agentName || null,
        agentPhone: doc.agentPhone || null,
        agentEmail: doc.agentEmail || null,
        source: doc.sourceType || null,
        agentConfirmedOwnerFinance: doc.manuallyVerified || false,
        latitude: doc.location?.[0] || null,
        longitude: doc.location?.[1] || null,
        estimatedValue: doc.zestimate || null,
      };
    });

    console.log(`[admin/properties] Typesense: ${properties.length} results in ${result.search_time_ms}ms`);

    return {
      properties,
      total: result.found || 0,
      states,
      engine: 'typesense',
    };
  } catch (error) {
    console.warn('[admin/properties] Typesense search failed:', error);
    return null;
  }
}

// Get all properties for admin management with optional filtering
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Admin access control
    const session = await getServerSession(authOptions as typeof authOptions) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const countOnly = searchParams.get('countOnly') === 'true';
    const city = searchParams.get('city')?.toLowerCase();
    const state = searchParams.get('state')?.toUpperCase();
    const radius = parseInt(searchParams.get('radius') || '0');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

    // Fetch from unified properties collection only
    const propertiesCollection = collection(db, 'properties');

    // FAST PATH: Count-only mode for stats
    if (countOnly) {
      const propertiesCount = await getCountFromServer(query(propertiesCollection, where('isActive', '==', true)));
      return NextResponse.json({
        properties: [],
        count: 0,
        total: propertiesCount.data().count,
        hasMore: false
      });
    }

    // ===== TRY TYPESENSE FIRST (FAST PATH) =====
    const typesenseResult = await searchWithTypesense({
      city,
      state,
      radius,
      page,
      limit,
    });

    // If Typesense is available (result not null), use it even if 0 results
    // Only fall back to Firestore if Typesense FAILS (returns null)
    if (typesenseResult !== null) {
      const response = NextResponse.json({
        properties: typesenseResult.properties,
        count: typesenseResult.properties.length,
        total: typesenseResult.total,
        states: typesenseResult.states.length > 0 ? typesenseResult.states : undefined,
        hasMore: typesenseResult.total > page * limit,
        page,
        limit,
        engine: 'typesense',
        showing: typesenseResult.properties.length > 0
          ? `Showing ${typesenseResult.properties.length} of ${typesenseResult.total} properties${city ? ` near ${city}` : ''}${state ? ` in ${state}` : ''}`
          : `No properties found${city ? ` near ${city}` : ''}${state ? ` in ${state}` : ''}`
      });
      response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=300');
      return response;
    }

    // ===== FIRESTORE FALLBACK (only when Typesense is unavailable) =====
    console.log('[admin/properties] Typesense unavailable, falling back to Firestore');

    let propertiesConstraints: unknown[] = [
      where('isActive', '==', true),
      firestoreLimit(limit)
    ];

    // Filter by status if specified
    if (status !== 'all') {
      if (status === 'null') {
        propertiesConstraints = [
          where('isActive', '==', true),
          where('status', '==', null),
          firestoreLimit(limit)
        ];
      } else {
        propertiesConstraints = [
          where('isActive', '==', true),
          where('status', '==', status),
          firestoreLimit(limit)
        ];
      }
    }

    // Execute query on unified properties collection
    const propertiesSnapshot = await getDocs(query(propertiesCollection, ...propertiesConstraints));

    // Map properties
    let uniqueProperties = propertiesSnapshot.docs.map(mapPropertyFields);

    // Apply location filtering (city/state/radius)
    if (city) {
      const searchState = state || '';

      // Get center city coordinates for radius search
      const centerCoords = getCityCoordinatesComprehensive(city, searchState);

      if (centerCoords && radius > 0) {
        // RADIUS SEARCH: Search across ALL states within radius
        const nearbyCities = getCitiesWithinRadiusComprehensive(city, searchState, radius);
        const cityNames = new Set(nearbyCities.map(c => c.name.toLowerCase()));
        cityNames.add(city.toLowerCase());

        const statesInRadius = new Set(nearbyCities.map(c => c.state));
        if (searchState) statesInRadius.add(searchState);
        console.log(`[properties] Radius search: ${city} + ${radius}mi includes states: ${[...statesInRadius].join(', ')}`);

        uniqueProperties = uniqueProperties.filter((prop: Record<string, unknown>) => {
          // If property has coordinates, use actual distance calculation
          if (prop.latitude && prop.longitude) {
            const dist = haversineDistance(centerCoords.lat, centerCoords.lng, prop.latitude, prop.longitude);
            return dist <= radius;
          }
          // Fallback: Check if city name matches any city in radius
          return cityNames.has(prop.city?.toLowerCase());
        });
      } else {
        // No radius - filter by exact city match AND state if provided
        uniqueProperties = uniqueProperties.filter((prop: Record<string, unknown>) => {
          const cityMatch = prop.city?.toLowerCase().includes(city);
          const stateMatch = state ? prop.state === state : true;
          return cityMatch && stateMatch;
        });
      }
    } else if (state) {
      // No city search, just state filter
      uniqueProperties = uniqueProperties.filter((prop: Record<string, unknown>) => prop.state === state);
    }

    // Collect unique states for dropdown
    const allStates = new Set<string>();
    uniqueProperties.forEach(p => p.state && allStates.add(p.state));
    const states = [...allStates].sort();

    // Return all properties with caching headers
    const response = NextResponse.json({
      properties: uniqueProperties,
      count: uniqueProperties.length,
      total: uniqueProperties.length,
      states,
      hasMore: false,
      page,
      limit,
      engine: 'firestore',
      showing: `Showing ${uniqueProperties.length} properties${city ? ` near ${city}` : ''}${state ? ` in ${state}` : ''}`
    });
    // PERF: Cache for 30s client-side, 2 min CDN, allows stale for 5 min while revalidating
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=300');
    return response;

  } catch (error) {
    await logError('Failed to fetch admin properties', {
      action: 'admin_properties_fetch'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}

// Update property
export async function PUT(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;
    
    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { propertyId, updates } = await request.json();

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Auto-cleanup: Clean address and upgrade image URLs if they're being updated
    if (updates.address || updates.imageUrl || updates.imageUrls || updates.zillowImageUrl) {
      const cleanedData = autoCleanPropertyData({
        address: updates.address,
        city: updates.city,
        state: updates.state,
        zipCode: updates.zipCode,
        imageUrl: updates.imageUrl,
        imageUrls: updates.imageUrls,
        zillowImageUrl: updates.zillowImageUrl
      });

      // Apply cleaned data
      if (cleanedData.address) updates.address = cleanedData.address;
      if (cleanedData.imageUrl) updates.imageUrl = cleanedData.imageUrl;
      if (cleanedData.imageUrls) updates.imageUrls = cleanedData.imageUrls;
      if (cleanedData.zillowImageUrl) updates.zillowImageUrl = cleanedData.zillowImageUrl;
    }

    // Update property in Firebase (unified properties collection)
    await updateDoc(doc(db, 'properties', propertyId), {
      ...updates,
      updatedAt: new Date()
    });

    await logInfo('Property updated by admin', {
      action: 'admin_property_update',
      metadata: { 
        propertyId,
        updatedFields: Object.keys(updates)
      }
    });

    return NextResponse.json({ 
      success: true,
      message: 'Property updated successfully' 
    });

  } catch (error) {
    await logError('Failed to update property', {
      action: 'admin_property_update_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to update property' },
      { status: 500 }
    );
  }
}

// Delete property
export async function DELETE(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;
    
    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    
    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Mark property as inactive in Firebase (unified properties collection)
    // We don't actually delete to preserve history - just mark inactive
    await updateDoc(doc(db, 'properties', propertyId), {
      isActive: false,
      deletedAt: new Date(),
      deletedBy: 'admin'
    });

    await logInfo('Property deleted by admin', {
      action: 'admin_property_delete',
      metadata: { propertyId }
    });

    return NextResponse.json({ 
      success: true,
      message: 'Property deleted successfully' 
    });

  } catch (error) {
    await logError('Failed to delete property', {
      action: 'admin_property_delete_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to delete property' },
      { status: 500 }
    );
  }
}