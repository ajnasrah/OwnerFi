import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter,
  getCountFromServer,
  getAggregateFromServer,
  count
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';
import { autoCleanPropertyData } from '@/lib/property-auto-cleanup';
import { getCitiesWithinRadiusComprehensive, getCityCoordinatesComprehensive } from '@/lib/comprehensive-cities';

// Simple in-memory cache for properties (5 min TTL)
let propertiesCache: { data: any[]; timestamp: number; key: string } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
function mapPropertyFields(doc: any) {
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
    imageUrl: data.firstPropertyImage || data.imageUrl,
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
    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;

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

    // Fetch from BOTH collections - zillow_imports AND properties
    const zillowCollection = collection(db, 'zillow_imports');
    const propertiesCollection = collection(db, 'properties');

    // FAST PATH: Count-only mode for stats
    if (countOnly) {
      const [zillowCount, propertiesCount] = await Promise.all([
        getCountFromServer(query(zillowCollection, where('ownerFinanceVerified', '==', true))),
        getCountFromServer(query(propertiesCollection, where('isActive', '==', true)))
      ]);
      const total = zillowCount.data().count + propertiesCount.data().count;
      return NextResponse.json({
        properties: [],
        count: 0,
        total: total,
        hasMore: false
      });
    }

    let zillowConstraints: any[] = [
      where('ownerFinanceVerified', '==', true),
      orderBy('foundAt', 'desc')
    ];

    // Note: Removed orderBy to avoid requiring composite index (only 5-10 properties typically)
    let propertiesConstraints: any[] = [
      where('isActive', '==', true)
    ];

    // Filter by status if specified (only for zillow_imports)
    if (status !== 'all') {
      if (status === 'null') {
        zillowConstraints = [
          where('ownerFinanceVerified', '==', true),
          where('status', '==', null),
          orderBy('foundAt', 'desc')
        ];
      } else {
        zillowConstraints = [
          where('ownerFinanceVerified', '==', true),
          where('status', '==', status),
          orderBy('foundAt', 'desc')
        ];
      }
    }

    // Execute BOTH queries in parallel
    const [zillowSnapshot, propertiesSnapshot] = await Promise.all([
      getDocs(query(zillowCollection, ...zillowConstraints)),
      getDocs(query(propertiesCollection, ...propertiesConstraints))
    ]);

    // Map both collections
    const zillowProperties = zillowSnapshot.docs.map(mapPropertyFields);
    const ghlProperties = propertiesSnapshot.docs.map(mapPropertyFields);

    // Combine and deduplicate (in case same property exists in both)
    let allProperties = [...zillowProperties, ...ghlProperties];
    let uniqueProperties = Array.from(
      new Map(allProperties.map(p => [p.id, p])).values()
    );

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

        uniqueProperties = uniqueProperties.filter((prop: any) => {
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
        uniqueProperties = uniqueProperties.filter((prop: any) => {
          const cityMatch = prop.city?.toLowerCase().includes(city);
          const stateMatch = state ? prop.state === state : true;
          return cityMatch && stateMatch;
        });
      }
    } else if (state) {
      // No city search, just state filter
      uniqueProperties = uniqueProperties.filter((prop: any) => prop.state === state);
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
      nextCursor: null,
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

    // Update property in Firebase (zillow_imports collection)
    await updateDoc(doc(db, 'zillow_imports', propertyId), {
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

    // Completely delete the property from Firebase (zillow_imports collection)
    await deleteDoc(doc(db, 'zillow_imports', propertyId));

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