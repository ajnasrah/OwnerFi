import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';
import { adminDb } from '@/lib/firebase-admin';

// Get all properties for admin management
export async function GET(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // Admin access control
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200');
    const status = searchParams.get('status') || 'all';
    
    // Build query
    let propertiesQuery = query(adminDb.collection('properties'));
    
    // Filter by status if specified
    if (status !== 'all') {
      propertiesQuery = query(
        adminDb.collection('properties'),
        where('status', '==', status)
      );
    }
    
    // Add limit
    propertiesQuery = query(propertiesQuery, firestoreLimit(limit));
    
    const propertiesSnapshot = await propertiesQuery.get();
    const properties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamps
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
    }));

    // Get actual total count (not limited)
    const totalQuery = query(adminDb.collection('properties'));
    const totalSnapshot = await totalQuery.get();
    const actualTotal = totalSnapshot.size;
    
    return NextResponse.json({ 
      properties,
      count: properties.length,
      total: actualTotal,
      showing: `${properties.length} of ${actualTotal} properties`
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
    const session = await getServerSession(authOptions);
    
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

    // Update property in Firebase
    await adminDb.collection('properties').doc(propertyId).update({
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
    const session = await getServerSession(authOptions);
    
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

    // Completely delete the property from Firebase
    await deleteDoc(adminDb.collection('properties').doc(propertyId));

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