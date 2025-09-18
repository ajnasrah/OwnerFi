import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';

// GET single property
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const resolvedParams = await params;
    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;
    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const propertyDoc = await getDoc(doc(db, 'properties', resolvedParams.id));
    
    if (!propertyDoc.exists()) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: propertyDoc.id,
      ...propertyDoc.data()
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch property' },
      { status: 500 }
    );
  }
}

// UPDATE property
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const resolvedParams = await params;
    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;
    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const updates = await request.json();

    // Remove id from updates if present
    delete updates.id;

    // Handle image URL updates - sync imageUrl with imageUrls array
    if (updates.imageUrl !== undefined) {
      // If imageUrl is provided, update imageUrls array as well
      if (updates.imageUrl) {
        updates.imageUrls = [updates.imageUrl];
      } else {
        // If imageUrl is empty, clear imageUrls
        updates.imageUrls = [];
      }
    }

    // Update the property
    await updateDoc(doc(db, 'properties', resolvedParams.id), {
      ...updates,
      updatedAt: serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: 'Property updated successfully'
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update property' },
      { status: 500 }
    );
  }
}

// DELETE property
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const resolvedParams = await params;
    const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Check if property exists
    const propertyDoc = await getDoc(doc(db, 'properties', resolvedParams.id));

    if (!propertyDoc.exists()) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    // Delete the property
    await deleteDoc(doc(db, 'properties', resolvedParams.id));

    await logInfo('Property deleted by admin', {
      action: 'admin_property_delete',
      metadata: { propertyId: resolvedParams.id }
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