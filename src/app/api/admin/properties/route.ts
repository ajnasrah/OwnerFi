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

// Simple in-memory cache for total count (5 min TTL)
let cachedCount: { value: number; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fast field mapper - only essential fields
function mapPropertyFields(doc: any) {
  const data = doc.data();
  return {
    id: doc.id,
    // Core fields only
    fullAddress: data.fullAddress,
    streetAddress: data.streetAddress,
    city: data.city,
    state: data.state,
    zipCode: data.zipCode,
    price: data.price,
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
    // Admin panel compatibility
    address: data.fullAddress || data.address,
    squareFeet: data.squareFoot || data.squareFeet,
    imageUrl: data.firstPropertyImage || data.imageUrl,
    imageUrls: data.propertyImages || data.imageUrls || [],
    zillowImageUrl: data.firstPropertyImage || data.zillowImageUrl,
    listPrice: data.price || data.listPrice,
  };
}

// Get all properties for admin management
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
    const pageSize = parseInt(searchParams.get('limit') || '100'); // Default 100 per page
    const status = searchParams.get('status') || 'all';
    const lastDocId = searchParams.get('lastDocId'); // For pagination cursor
    const searchQuery = searchParams.get('search')?.toLowerCase().trim(); // Search query

    // Build base query
    const baseCollection = collection(db, 'zillow_imports');

    // SEARCH MODE: If search query provided, search entire database (ignore pagination)
    if (searchQuery) {
      // Fetch ALL properties and search in-memory (Firestore doesn't support full-text search)
      let searchConstraints: any[] = [
        where('ownerFinanceVerified', '==', true)
      ];

      // Filter by status if specified
      if (status !== 'all') {
        if (status === 'null') {
          searchConstraints.push(where('status', '==', null));
        } else {
          searchConstraints.push(where('status', '==', status));
        }
      }

      const searchQueryRef = query(baseCollection, ...searchConstraints);
      const allPropertiesSnapshot = await getDocs(searchQueryRef);

      // Filter in-memory by search query
      const properties = allPropertiesSnapshot.docs
        .map(mapPropertyFields)
        .filter(property => {
          const searchFields = [
            property.fullAddress,
            property.streetAddress,
            property.city,
            property.state,
            property.zipCode,
            property.id
          ].filter(Boolean).map(f => f.toString().toLowerCase());

          return searchFields.some(field => field.includes(searchQuery));
        });

      return NextResponse.json({
        properties,
        count: properties.length,
        total: properties.length,
        hasMore: false,
        nextCursor: null,
        showing: `Found ${properties.length} properties matching "${searchQuery}"`,
        searchMode: true
      });
    }

    // NORMAL MODE: Pagination
    let constraints: any[] = [
      where('ownerFinanceVerified', '==', true),
      orderBy('foundAt', 'desc')
    ];

    // Filter by status if specified
    if (status !== 'all') {
      if (status === 'null') {
        constraints.push(where('status', '==', null));
      } else {
        constraints.push(where('status', '==', status));
      }
    }

    // Add pagination cursor if provided
    if (lastDocId) {
      const lastDocRef = doc(db, 'zillow_imports', lastDocId);
      const lastDocSnap = await getDocs(query(collection(db, 'zillow_imports'), where('__name__', '==', lastDocId)));
      if (!lastDocSnap.empty) {
        constraints.push(startAfter(lastDocSnap.docs[0]));
      }
    }

    // Add limit
    constraints.push(firestoreLimit(pageSize));

    // Execute main query
    const propertiesQuery = query(baseCollection, ...constraints);
    const propertiesSnapshot = await getDocs(propertiesQuery);

    // Fast field mapping
    const properties = propertiesSnapshot.docs.map(mapPropertyFields);

    // Get total count with caching
    let totalCount = 0;
    const now = Date.now();

    if (cachedCount && (now - cachedCount.timestamp) < CACHE_TTL) {
      // Use cached count
      totalCount = cachedCount.value;
    } else {
      // Fetch count using aggregation (no document reads!)
      try {
        const countQuery = query(
          baseCollection,
          where('ownerFinanceVerified', '==', true)
        );
        const countSnapshot = await getCountFromServer(countQuery);
        totalCount = countSnapshot.data().count;

        // Cache the result
        cachedCount = { value: totalCount, timestamp: now };
      } catch (error) {
        // Fallback to estimated count
        console.warn('Count aggregation failed, using estimate:', error);
        totalCount = properties.length >= pageSize ? pageSize * 20 : properties.length;
      }
    }

    const hasMore = properties.length === pageSize;
    const lastDoc = properties.length > 0 ? properties[properties.length - 1].id : null;

    return NextResponse.json({
      properties,
      count: properties.length,
      total: totalCount,
      hasMore,
      nextCursor: hasMore ? lastDoc : null,
      showing: `${properties.length} of ${totalCount} properties`,
      cached: cachedCount ? (now - cachedCount.timestamp < CACHE_TTL) : false
    });

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