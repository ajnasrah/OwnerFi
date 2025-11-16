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
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';
import { autoCleanPropertyData } from '@/lib/property-auto-cleanup';

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
    const limit = parseInt(searchParams.get('limit') || '1000'); // Show up to 1000 properties
    const status = searchParams.get('status') || 'all';
    
    // Build query to show zillow_imports (owner-financed properties)
    // Changed from 'properties' collection to 'zillow_imports'
    let propertiesQuery = query(
      collection(db, 'zillow_imports'),
      where('ownerFinanceVerified', '==', true),
      orderBy('foundAt', 'desc') // Show newest first
    );

    // Filter by status if specified
    if (status !== 'all') {
      if (status === 'null') {
        // Filter for properties awaiting financing terms
        propertiesQuery = query(
          collection(db, 'zillow_imports'),
          where('ownerFinanceVerified', '==', true),
          where('status', '==', null),
          orderBy('foundAt', 'desc')
        );
      } else {
        // Filter for specific status
        propertiesQuery = query(
          collection(db, 'zillow_imports'),
          where('ownerFinanceVerified', '==', true),
          where('status', '==', status),
          orderBy('foundAt', 'desc')
        );
      }
    }

    // Add limit
    propertiesQuery = query(propertiesQuery, firestoreLimit(limit));
    
    const propertiesSnapshot = await getDocs(propertiesQuery);
    const properties = propertiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Map Zillow field names to admin panel expected names
        address: data.fullAddress || data.address,
        squareFeet: data.squareFoot || data.squareFeet, // Map squareFoot → squareFeet
        imageUrl: data.firstPropertyImage || data.imageUrl, // Map firstPropertyImage → imageUrl
        imageUrls: data.propertyImages || data.imageUrls || [], // Map propertyImages → imageUrls
        zillowImageUrl: data.firstPropertyImage || data.zillowImageUrl,
        listPrice: data.price || data.listPrice,
        // Convert Firestore timestamps
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        foundAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
        importedAt: data.importedAt?.toDate?.()?.toISOString() || data.importedAt,
        scrapedAt: data.scrapedAt?.toDate?.()?.toISOString() || data.scrapedAt,
      };
    });

    // Get total count efficiently without fetching all docs
    const totalQuery = query(
      collection(db, 'zillow_imports'),
      where('ownerFinanceVerified', '==', true)
    );
    const totalSnapshot = await getDocs(query(totalQuery, firestoreLimit(1000))); // Cap at 1000 for count
    const estimatedTotal = totalSnapshot.size >= 1000 ? '1000+' : totalSnapshot.size;
    
    return NextResponse.json({ 
      properties,
      count: properties.length,
      total: estimatedTotal,
      showing: `${properties.length} of ${estimatedTotal} properties`
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