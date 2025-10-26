import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';
import { autoCleanPropertyData } from '@/lib/property-auto-cleanup';

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

    // Update the property
    await updateDoc(doc(db, 'properties', resolvedParams.id), {
      ...updates,
      updatedAt: serverTimestamp()
    });

    // Get current property data to check eligibility
    const propertyDoc = await getDoc(doc(db, 'properties', resolvedParams.id));
    const propertyData = propertyDoc.data();

    // Remove from rotation queue if property becomes inactive or ineligible
    if (updates.isActive === false || updates.status !== 'active') {
      try {
        const queueDoc = await getDoc(doc(db, 'property_rotation_queue', resolvedParams.id));
        if (queueDoc.exists()) {
          await deleteDoc(doc(db, 'property_rotation_queue', resolvedParams.id));
          console.log(`✅ Removed inactive property from rotation queue: ${resolvedParams.id}`);
        }
      } catch (error) {
        console.warn('⚠️  Could not remove from queue:', error);
        // Don't fail the update if queue removal fails
      }
    }
    // Add to queue if property becomes active and has images
    else if (
      (updates.status === 'active' || propertyData?.status === 'active') &&
      (updates.isActive === true || propertyData?.isActive === true) &&
      ((updates.imageUrls && updates.imageUrls.length > 0) || (propertyData?.imageUrls && propertyData.imageUrls.length > 0))
    ) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const webhookSecret = process.env.WEBHOOK_SECRET || process.env.CRON_SECRET;

        // Call add-to-queue endpoint in background
        fetch(`${baseUrl}/api/property/add-to-queue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${webhookSecret}`
          },
          body: JSON.stringify({ propertyId: resolvedParams.id })
        }).catch(err => {
          console.error('Failed to auto-add property to queue:', err);
        });

        console.log(`🎥 Auto-adding updated property ${resolvedParams.id} to video queue`);
      } catch (error) {
        console.error('Error triggering auto-add to queue:', error);
      }
    }

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

    // Also remove from rotation queue
    try {
      const queueDoc = await getDoc(doc(db, 'property_rotation_queue', resolvedParams.id));
      if (queueDoc.exists()) {
        await deleteDoc(doc(db, 'property_rotation_queue', resolvedParams.id));
        console.log(`✅ Removed deleted property from rotation queue: ${resolvedParams.id}`);
      }
    } catch (error) {
      console.warn('⚠️  Could not remove from rotation queue:', error);
      // Don't fail the delete if queue removal fails
    }

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