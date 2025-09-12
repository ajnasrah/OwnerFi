import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { 
  collection, 
  query, 
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ExtendedSession } from '@/types/session';

export async function GET() {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    
    if (!session) {
      return NextResponse.json({ 
        authenticated: false,
        error: 'No session found' 
      });
    }
    
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Find realtor profile for this user
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id)
    );
    const realtorDocs = await getDocs(realtorsQuery);
    
    let realtorProfile = null;
    if (!realtorDocs.empty) {
      const doc = realtorDocs.docs[0];
      realtorProfile = {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      };
    }
    
    return NextResponse.json({
      authenticated: true,
      session: {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role
        }
      },
      realtorProfile,
      multipleProfiles: realtorDocs.docs.length > 1,
      profileCount: realtorDocs.docs.length
    });
    
  } catch {
    return NextResponse.json(
      { error: 'Failed to check session' },
      { status: 500 }
    );
  }
}