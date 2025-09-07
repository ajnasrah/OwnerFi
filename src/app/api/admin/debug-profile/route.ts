import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    // Get all realtors with abdullah@prosway.com
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('email', '==', 'abdullah@prosway.com')
    );
    const realtorDocs = await getDocs(realtorsQuery);
    
    const profiles = realtorDocs.docs.map(doc => ({
      id: doc.id,
      email: doc.data().email,
      userId: doc.data().userId,
      credits: doc.data().credits,
      firstName: doc.data().firstName,
      lastName: doc.data().lastName,
      isOnTrial: doc.data().isOnTrial,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
    }));
    
    return NextResponse.json({
      profileCount: profiles.length,
      profiles,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to debug profile:', error);
    return NextResponse.json(
      { error: 'Failed to debug profile' },
      { status: 500 }
    );
  }
}