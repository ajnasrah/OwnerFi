import { NextRequest, NextResponse } from 'next/server';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSessionWithRole } from '@/lib/auth-utils';
import { firestoreHelpers } from '@/lib/firestore';

/**
 * CLEAN BUYER PROFILE API
 * 
 * Purpose: ONLY handle buyer profile data (preferences)
 * Does NOT handle property matching (separate system)
 */

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithRole('buyer');
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    
    const {
      firstName,
      lastName, 
      phone,
      maxMonthlyPayment,
      maxDownPayment,
      preferredCity,
      preferredState,
      searchRadius,
      minBedrooms,
      minBathrooms,
      cities
    } = body;

    // Simple validation
    if (!maxMonthlyPayment || !maxDownPayment || !preferredCity || !preferredState) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user info from session
    const userName = session.user.name || '';
    const nameParts = userName.split(' ');

    // Clean profile data structure
    const profileData = {
      userId: session.user.id,
      firstName: firstName || nameParts[0] || '',
      lastName: lastName || nameParts.slice(1).join(' ') || '',
      email: session.user.email!,
      phone: phone || '',
      
      // Search criteria (clean structure)
      searchCriteria: {
        cities: cities || [preferredCity],
        state: preferredState,
        maxMonthlyPayment: Number(maxMonthlyPayment),
        maxDownPayment: Number(maxDownPayment),
        minBedrooms: minBedrooms ? Number(minBedrooms) : null,
        minBathrooms: minBathrooms ? Number(minBathrooms) : null,
        searchRadius: searchRadius || 25
      },
      
      profileComplete: true,
      updatedAt: serverTimestamp()
    };

    // Find existing profile
    const profilesQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const existingProfiles = await getDocs(profilesQuery);

    let buyerId;
    
    if (existingProfiles.empty) {
      // Create new profile
      buyerId = firestoreHelpers.generateId();
      await setDoc(doc(db, 'buyerProfiles', buyerId), {
        ...profileData,
        id: buyerId,
        createdAt: serverTimestamp()
      });
      console.log('✅ Created buyer profile');
    } else {
      // Update existing profile
      buyerId = existingProfiles.docs[0].id;
      await updateDoc(doc(db, 'buyerProfiles', buyerId), profileData);
      console.log('✅ Updated buyer profile');
    }

    // Trigger background property matching (non-blocking)
    try {
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/property-matching/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerId })
      });
      console.log('🔄 Triggered background property matching');
    } catch (error) {
      console.warn('Background matching failed (non-critical):', error);
    }

    return NextResponse.json({
      success: true,
      message: 'Profile saved successfully',
      buyerId
    });

  } catch (error) {
    console.error('Profile save error:', error);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionWithRole('buyer');
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const profilesQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const profileDocs = await getDocs(profilesQuery);

    if (profileDocs.empty) {
      return NextResponse.json({ profile: null });
    }

    const profile = {
      id: profileDocs.docs[0].id,
      ...profileDocs.docs[0].data()
    };

    return NextResponse.json({ profile });

  } catch (error) {
    console.error('Profile load error:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}