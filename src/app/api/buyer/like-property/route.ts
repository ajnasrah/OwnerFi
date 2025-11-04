import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;
    
    if (!session?.user || session.user.role !== 'buyer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { propertyId, action } = await request.json(); // action: 'like' or 'unlike'
    
    if (!propertyId || !action) {
      return NextResponse.json({ 
        error: 'Missing propertyId or action' 
      }, { status: 400 });
    }

    // Get buyer profile
    const profilesQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const snapshot = await getDocs(profilesQuery);

    if (snapshot.empty) {
      return NextResponse.json({ 
        error: 'Buyer profile not found' 
      }, { status: 404 });
    }

    const profileDoc = snapshot.docs[0];

    // Update liked properties array (using likedPropertyIds to match the schema)
    if (action === 'like') {
      await updateDoc(profileDoc.ref, {
        likedPropertyIds: arrayUnion(propertyId),
        likedProperties: arrayUnion(propertyId), // Keep legacy field for backward compat
        updatedAt: serverTimestamp()
      });
    } else if (action === 'unlike') {
      await updateDoc(profileDoc.ref, {
        likedPropertyIds: arrayRemove(propertyId),
        likedProperties: arrayRemove(propertyId), // Keep legacy field for backward compat
        updatedAt: serverTimestamp()
      });
    }

    return NextResponse.json({ 
      success: true,
      action,
      propertyId 
    });

  } catch {
    return NextResponse.json({ 
      error: 'Failed to update property preference' 
    }, { status: 500 });
  }
}