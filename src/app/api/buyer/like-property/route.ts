import { NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
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

    const session = await getServerSession(authOptions) as ExtendedSession | null;
    
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

    // Update liked properties array
    if (action === 'like') {
      await updateDoc(profileDoc.ref, {
        likedProperties: arrayUnion(propertyId),
        updatedAt: serverTimestamp()
      });
    } else if (action === 'unlike') {
      await updateDoc(profileDoc.ref, {
        likedProperties: arrayRemove(propertyId),
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