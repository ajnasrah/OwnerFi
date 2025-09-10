import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
export async function GET(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // Get all realtors with abdullah@prosway.com
    const realtorDocs = await adminDb.collection('realtors').where('email', '==', 'abdullah@prosway.com').get();
    
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