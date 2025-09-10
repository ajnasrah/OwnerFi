import { NextRequest, NextResponse } from 'next/server';
import { firestoreHelpers } from '@/lib/firestore';
import { adminDb } from '@/lib/firebase-admin';

/**
 * CLEAN PROPERTY ACTIONS API
 * 
 * Handles: like, pass, undo_like, undo_pass
 * Updates both propertyMatches status and creates action history
 */

export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    const { buyerId, propertyId, action } = await request.json();
    
    if (!buyerId || !propertyId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`🎯 ${action} action for property ${propertyId} by buyer ${buyerId}`);

    // Find the property match record
    const matchQuery = query(
      adminDb.collection('propertyMatches'),
      where('buyerId', '==', buyerId),
      where('propertyId', '==', propertyId)
    );
    const matchDocs = await matchQuery.get();

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
      updatedAt: new Date()
    });

    // Create action history record (immutable event log)
    const actionId = firestoreHelpers.generateId();
    await setDoc(doc(adminDb.collection('propertyActions'), actionId), {
      id: actionId,
      buyerId: buyerId,
      propertyId: propertyId,
      action: action,
      timestamp: new Date().toISOString(),
      source: 'dashboard',
      createdAt: new Date()
    });

    console.log(`✅ Updated property status to: ${newStatus}`);

    return NextResponse.json({
      success: true,
      newStatus: newStatus,
      message: `Property ${action}ed successfully`
    });

  } catch (error) {
    console.error('Property action error:', error);
    return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
  }
}