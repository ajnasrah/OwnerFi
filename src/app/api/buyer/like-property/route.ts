import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    
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
    const snapshot = await adminDb.collection('buyerProfiles').where('userId', '==', session.user.id).get();

    if (snapshot.empty) {
      return NextResponse.json({ 
        error: 'Buyer profile not found' 
      }, { status: 404 });
    }

    const profileDoc = snapshot.docs[0];

    // Update liked properties array
    if (action === 'like') {
      await profileDoc.ref.update({
        likedProperties: FieldValue.arrayUnion(propertyId),
        updatedAt: new Date()
      });
      console.log(`❤️ LIKED property ${propertyId} for buyer ${session.user.id}`);
    } else if (action === 'unlike') {
      await profileDoc.ref.update({
        likedProperties: FieldValue.arrayRemove(propertyId),
        updatedAt: new Date()
      });
      console.log(`💔 UNLIKED property ${propertyId} for buyer ${session.user.id}`);
    }

    return NextResponse.json({ 
      success: true,
      action,
      propertyId 
    });

  } catch (error) {
    console.error('🚨 Like property error:', error);
    return NextResponse.json({ 
      error: 'Failed to update property preference' 
    }, { status: 500 });
  }
}