import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
    const session = await getServerSession(authOptions) as ExtendedSession | null;
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
  } catch (error) {
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
    const session = await getServerSession(authOptions) as ExtendedSession | null;
    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const updates = await request.json();
    
    // Remove id from updates if present
    delete updates.id;
    
    // Update the property
    await updateDoc(doc(db, 'properties', resolvedParams.id), {
      ...updates,
      updatedAt: serverTimestamp()
    });

    return NextResponse.json({ 
      success: true,
      message: 'Property updated successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update property' },
      { status: 500 }
    );
  }
}