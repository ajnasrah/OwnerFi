import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { getSafeDb } from '@/lib/firebase-safe';

export async function POST(request: NextRequest) {
  try {
    // Admin access control
    const session = await getServerSession(authOptions) as ExtendedSession;
    
    if (!session?.user || session.user?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { realtorEmail, credits } = await request.json();
    
    if (!realtorEmail || !credits) {
      return NextResponse.json(
        { error: 'Realtor email and credits amount required' },
        { status: 400 }
      );
    }

    // Find realtor by email
    const db = getSafeDb();
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', realtorEmail),
      where('role', '==', 'realtor')
    );
    const userDocs = await getDocs(usersQuery);
    
    if (userDocs.empty) {
      return NextResponse.json(
        { error: 'Realtor not found' },
        { status: 404 }
      );
    }

    const user = userDocs.docs[0];
    
    // Find realtor profile
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', user.id)
    );
    const realtorDocs = await getDocs(realtorsQuery);
    
    if (realtorDocs.empty) {
      return NextResponse.json(
        { error: 'Realtor profile not found' },
        { status: 404 }
      );
    }

    const realtorDoc = realtorDocs.docs[0];
    const currentCredits = realtorDoc.data().credits || 0;
    const newCredits = currentCredits + parseInt(credits);
    
    // Update credits
    await updateDoc(doc(db, 'realtors', realtorDoc.id), {
      credits: newCredits,
      updatedAt: serverTimestamp()
    });
    
    return NextResponse.json({
      success: true,
      message: `Added ${credits} credits to ${realtorEmail}`,
      previousCredits: currentCredits,
      newCredits: newCredits,
      realtorId: realtorDoc.id
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to add credits', details: (error as Error).message },
      { status: 500 }
    );
  }
}