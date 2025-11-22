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
    const status = searchParams.get('status') || 'all';

    // Fetch from BOTH collections - zillow_imports AND properties
    const zillowCollection = collection(db, 'zillow_imports');
    const propertiesCollection = collection(db, 'properties');

    let zillowConstraints: any[] = [
      where('ownerFinanceVerified', '==', true),
      orderBy('foundAt', 'desc')
    ];

    let propertiesConstraints: any[] = [
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    ];

    // Filter by status if specified (only for zillow_imports)
    if (status !== 'all') {
      if (status === 'null') {
        zillowConstraints.push(where('status', '==', null));
      } else {
        zillowConstraints.push(where('status', '==', status));
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
    const allProperties = [...zillowProperties, ...ghlProperties];
    const uniqueProperties = Array.from(
      new Map(allProperties.map(p => [p.id, p])).values()
    );

    // Return all properties
    return NextResponse.json({
      properties: uniqueProperties,
      count: uniqueProperties.length,
      total: uniqueProperties.length,
      hasMore: false,
      nextCursor: null,
      showing: `Showing all ${uniqueProperties.length} properties (${zillowProperties.length} from Zillow, ${ghlProperties.length} from GHL)`
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