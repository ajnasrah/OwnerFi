import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unifiedDb } from '@/lib/unified-db';

/**
 * SIMPLIFIED BUYER PROFILE API
 * 
 * Stores ONLY essential buyer data:
 * - Contact info (from user record)
 * - Search preferences (city, budgets)
 * 
 * NO realtor matching, NO complex algorithms, NO dependencies.
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== 'buyer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get buyer profile
    const profilesQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const snapshot = await getDocs(profilesQuery);

    if (snapshot.empty) {
      return NextResponse.json({ profile: null });
    }

    const profile = {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };

    return NextResponse.json({ profile });

  } catch (error) {
    console.error('🚨 Get buyer profile error:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== 'buyer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      phone,
      city,
      state,
      maxMonthlyPayment,
      maxDownPayment
    } = body;

    // Validate required fields
    if (!city || !state || !maxMonthlyPayment || !maxDownPayment) {
      return NextResponse.json({ 
        error: 'Missing required: city, state, maxMonthlyPayment, maxDownPayment' 
      }, { status: 400 });
    }

    // Get user contact info from database if not provided
    const userRecord = await unifiedDb.users.findById(session.user.id);
    
    // Simple profile structure - ONLY what buyers need
    const profileData = {
      userId: session.user.id,
      
      // Contact info (try request first, fallback to user record)
      firstName: firstName || userRecord?.name?.split(' ')[0] || '',
      lastName: lastName || userRecord?.name?.split(' ').slice(1).join(' ') || '',
      email: session.user.email!,
      phone: phone || userRecord?.phone || '',
      
      // Search criteria - the ONLY thing that matters for matching
      city: city,
      state: state,
      maxMonthlyPayment: Number(maxMonthlyPayment),
      maxDownPayment: Number(maxDownPayment),
      
      // Metadata
      profileComplete: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    console.log(`💾 SAVING BUYER PROFILE: ${profileData.firstName} ${profileData.lastName} in ${city}`);
    console.log(`💰 Budget: $${profileData.maxMonthlyPayment}/mo, $${profileData.maxDownPayment} down`);

    // Find existing profile or create new one
    const existingQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const existing = await getDocs(existingQuery);

    let buyerId: string;

    if (existing.empty) {
      // Create new profile
      buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'buyerProfiles', buyerId), {
        ...profileData,
        id: buyerId
      });
      console.log('✅ CREATED new buyer profile');
    } else {
      // Update existing profile
      buyerId = existing.docs[0].id;
      await updateDoc(doc(db, 'buyerProfiles', buyerId), profileData);
      console.log('✅ UPDATED buyer profile');
    }

    return NextResponse.json({ 
      success: true,
      buyerId,
      message: 'Profile saved successfully'
    });

  } catch (error) {
    console.error('🚨 Save buyer profile error:', error);
    return NextResponse.json({ 
      error: 'Failed to save profile' 
    }, { status: 500 });
  }
}