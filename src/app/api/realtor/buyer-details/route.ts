import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSessionWithRole } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    // Enforce realtor role only
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const buyerId = searchParams.get('buyerId');
    
    if (!buyerId) {
      return NextResponse.json(
        { error: 'Buyer ID is required' },
        { status: 400 }
      );
    }

    // Get buyer profile
    const buyerDoc = await getDoc(doc(db, 'buyerProfiles', buyerId));
    
    if (!buyerDoc.exists()) {
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      );
    }

    const buyer = {
      id: buyerDoc.id,
      ...buyerDoc.data(),
      // Convert Firestore timestamps
      createdAt: buyerDoc.data()?.createdAt?.toDate?.()?.toISOString() || buyerDoc.data()?.createdAt,
      updatedAt: buyerDoc.data()?.updatedAt?.toDate?.()?.toISOString() || buyerDoc.data()?.updatedAt
    };

    return NextResponse.json({
      buyer
    });

  } catch (error) {
    console.error('Failed to fetch buyer details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch buyer details' },
      { status: 500 }
    );
  }
}