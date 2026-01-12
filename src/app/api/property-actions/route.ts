import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import {
  doc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { getSafeDb } from '@/lib/firebase-safe';
import { firestoreHelpers } from '@/lib/firestore';

/**
 * CLEAN PROPERTY ACTIONS API
 *
 * Handles: like, pass, undo_like, undo_pass
 * Updates both propertyMatches status and creates action history
 */

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify user is authenticated
    const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]) as ExtendedSession | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getSafeDb();
    const { propertyId, action } = await request.json();

    // SECURITY: Use buyerId from session, NOT from request body
    // This prevents IDOR where users could act on behalf of other buyers
    const buyerId = session.user.id;

    if (!propertyId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }


    // Find the property match record
    const matchQuery = query(
      collection(db, 'propertyMatches'),
      where('buyerId', '==', buyerId),
      where('propertyId', '==', propertyId)
    );
    const matchDocs = await getDocs(matchQuery);

    if (matchDocs.empty) {
      return NextResponse.json({ error: 'Property match not found' }, { status: 404 });
    }

    const matchDoc = matchDocs.docs[0];
    
    // Update property match status
    let newStatus;
    switch (action) {
      case 'like':
        newStatus = 'liked';
        break;
      case 'pass': 
        newStatus = 'disliked';
        break;
      case 'undo_like':
        newStatus = 'pending';
        break;
      case 'undo_pass':
        newStatus = 'pending';
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update the match status
    await updateDoc(matchDoc.ref, {
      status: newStatus,
      lastActionAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    // Create action history record (immutable event log)
    const actionId = firestoreHelpers.generateId();
    await setDoc(doc(collection(db, 'propertyActions'), actionId), {
      id: actionId,
      buyerId: buyerId,
      propertyId: propertyId,
      action: action,
      timestamp: new Date().toISOString(),
      source: 'dashboard',
      createdAt: serverTimestamp()
    });


    return NextResponse.json({
      success: true,
      newStatus: newStatus,
      message: `Property ${action}ed successfully`
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
  }
}