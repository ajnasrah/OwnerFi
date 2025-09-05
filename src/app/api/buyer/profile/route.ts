import { NextRequest, NextResponse } from 'next/server';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { getSessionWithRole } from '@/lib/auth-utils';
import { firestoreHelpers } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    // Enforce buyer role only
    const session = await getSessionWithRole('buyer');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
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
      minPrice,
      maxPrice
    } = body;

    // Validation - only require essential search criteria
    if (!maxMonthlyPayment || !maxDownPayment || !preferredCity || !preferredState) {
      return NextResponse.json(
        { error: 'Missing required fields: budget and location are required' },
        { status: 400 }
      );
    }

    // Check if profile already exists
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id!)
    );
    const existingProfiles = await getDocs(buyersQuery);

    // Extract name from session if firstName/lastName not provided
    const userName = session.user.name || '';
    const nameParts = userName.split(' ');
    const defaultFirstName = firstName || nameParts[0] || '';
    const defaultLastName = lastName || nameParts.slice(1).join(' ') || '';

    const buyerData = {
      userId: session.user.id!,
      firstName: defaultFirstName,
      lastName: defaultLastName,
      email: session.user.email!,
      phone: phone || null,
      maxMonthlyPayment: Number(maxMonthlyPayment),
      maxDownPayment: Number(maxDownPayment),
      preferredCity,
      preferredState,
      searchRadius: searchRadius || 25,
      minBedrooms: minBedrooms || null,
      minBathrooms: minBathrooms || null,
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      profileComplete: true,
      updatedAt: serverTimestamp()
    };

    let buyerId;
    
    if (existingProfiles.empty) {
      // Create new buyer profile
      buyerId = firestoreHelpers.generateId();
      await setDoc(doc(db, 'buyerProfiles', buyerId), {
        ...buyerData,
        id: buyerId,
        createdAt: serverTimestamp()
      });

      await logInfo('Created new buyer profile', {
        action: 'buyer_profile_create',
        userId: session.user.id,
        userType: 'buyer',
        metadata: {
          buyerId,
          preferredCity,
          preferredState,
          maxMonthlyPayment
        }
      });
    } else {
      // Update existing profile
      const existingDoc = existingProfiles.docs[0];
      buyerId = existingDoc.id;
      await updateDoc(doc(db, 'buyerProfiles', buyerId), buyerData);
      
      await logInfo('Updated buyer profile', {
        action: 'buyer_profile_update',
        userId: session.user.id,
        userType: 'buyer',
        metadata: { buyerId }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Buyer profile saved successfully',
      buyerId
    });

  } catch (error) {
    // Handle role validation errors
    if ((error as Error).message.includes('Access denied') || (error as Error).message.includes('Not authenticated')) {
      return NextResponse.json(
        { error: 'Access denied. Buyer access required.' },
        { status: 403 }
      );
    }

    await logError('Failed to save buyer profile', error, {
      action: 'buyer_profile_error'
    });

    return NextResponse.json(
      { error: 'Failed to save profile. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Enforce buyer role only
    const session = await getSessionWithRole('buyer');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get buyer profile
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id!)
    );
    const buyerDocs = await getDocs(buyersQuery);

    if (buyerDocs.empty) {
      return NextResponse.json({ profile: null });
    }

    const buyerDoc = buyerDocs.docs[0];
    const profile = {
      id: buyerDoc.id,
      ...buyerDoc.data(),
      // Convert Firestore timestamps
      createdAt: buyerDoc.data().createdAt?.toDate?.()?.toISOString() || buyerDoc.data().createdAt,
      updatedAt: buyerDoc.data().updatedAt?.toDate?.()?.toISOString() || buyerDoc.data().updatedAt
    };

    return NextResponse.json({ profile });

  } catch (error) {
    // Handle role validation errors
    if ((error as Error).message.includes('Access denied') || (error as Error).message.includes('Not authenticated')) {
      return NextResponse.json(
        { error: 'Access denied. Buyer access required.' },
        { status: 403 }
      );
    }

    await logError('Failed to fetch buyer profile', error, {
      action: 'buyer_profile_fetch_error'
    });

    return NextResponse.json(
      { error: 'Failed to load profile. Please try again.' },
      { status: 500 }
    );
  }
}