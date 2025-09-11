import { NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  documentId
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';

export async function GET() {
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

    // Get buyer profile with liked properties
    const profilesQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const snapshot = await getDocs(profilesQuery);

    if (snapshot.empty) {
      return NextResponse.json({ 
        likedProperties: [],
        profile: null 
      });
    }

    const profile = snapshot.docs[0].data();
    const likedPropertyIds = profile.likedProperties || [];

    if (likedPropertyIds.length === 0) {
      return NextResponse.json({ 
        likedProperties: [],
        profile 
      });
    }

    // Get property details for liked properties
    const allProperties = [];
    
    // Batch fetch in groups of 10 (Firestore limit)
    for (let i = 0; i < likedPropertyIds.length; i += 10) {
      const batch = likedPropertyIds.slice(i, i + 10);
      
      const batchQuery = query(
        collection(db, 'properties'),
        where(documentId(), 'in', batch)
      );
      
      const batchSnapshot = await getDocs(batchQuery);
      const batchProperties = batchSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isLiked: true
      }));
      
      allProperties.push(...batchProperties);
    }


    return NextResponse.json({
      likedProperties: allProperties,
      profile,
      total: allProperties.length
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to load liked properties',
      likedProperties: []
    }, { status: 500 });
  }
}