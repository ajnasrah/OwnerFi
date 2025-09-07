import { NextRequest, NextResponse } from 'next/server';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  arrayUnion,
  arrayRemove,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSessionWithRole } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    // Enforce buyer role only
    const session = await getSessionWithRole('buyer');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, propertyId } = body; // action: 'like', 'pass', 'unlike', 'unpass'

    if (!action || !propertyId) {
      return NextResponse.json(
        { error: 'Missing action or propertyId' },
        { status: 400 }
      );
    }

    // Get buyer profile
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id!)
    );
    const buyerDocs = await getDocs(buyersQuery);

    if (buyerDocs.empty) {
      return NextResponse.json(
        { error: 'Buyer profile not found' },
        { status: 404 }
      );
    }

    const buyerDoc = buyerDocs.docs[0];
    const buyerRef = doc(db, 'buyerProfiles', buyerDoc.id);

    // Update property status in propertyMatches array
    const buyerData = buyerDoc.data();
    const propertyMatches = buyerData.propertyMatches || [];
    
    // Find and update the property status
    const updatedMatches = propertyMatches.map((match: any) => {
      if (match.propertyId === propertyId) {
        switch (action) {
          case 'like':
            return { ...match, status: 'liked', updatedAt: new Date().toISOString() };
          case 'pass':
            return { ...match, status: 'disliked', updatedAt: new Date().toISOString() };
          case 'unlike':
            return { ...match, status: 'pending', updatedAt: new Date().toISOString() };
          case 'unpass':
            return { ...match, status: 'pending', updatedAt: new Date().toISOString() };
          default:
            return match;
        }
      }
      return match;
    });

    await updateDoc(buyerRef, {
      propertyMatches: updatedMatches,
      updatedAt: serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: `Property ${action}ed successfully`
    });

  } catch (error) {
    console.error('Property action error:', error);
    return NextResponse.json(
      { error: 'Failed to update property action' },
      { status: 500 }
    );
  }
}

// GET endpoint to update matched properties for a buyer
export async function PUT(request: NextRequest) {
  try {
    // Enforce buyer role only
    const session = await getSessionWithRole('buyer');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { matchedPropertyIds } = body;

    if (!Array.isArray(matchedPropertyIds)) {
      return NextResponse.json(
        { error: 'matchedPropertyIds must be an array' },
        { status: 400 }
      );
    }

    // Get buyer profile
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id!)
    );
    const buyerDocs = await getDocs(buyersQuery);

    if (buyerDocs.empty) {
      return NextResponse.json(
        { error: 'Buyer profile not found' },
        { status: 404 }
      );
    }

    const buyerDoc = buyerDocs.docs[0];
    const buyerRef = doc(db, 'buyerProfiles', buyerDoc.id);

    // Update matched properties and timestamp
    await updateDoc(buyerRef, {
      matchedPropertyIds: matchedPropertyIds,
      lastMatchUpdate: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: 'Matched properties updated',
      count: matchedPropertyIds.length
    });

  } catch (error) {
    console.error('Update matches error:', error);
    return NextResponse.json(
      { error: 'Failed to update matched properties' },
      { status: 500 }
    );
  }
}