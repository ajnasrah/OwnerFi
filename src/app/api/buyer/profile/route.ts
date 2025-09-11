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
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { unifiedDb } from '@/lib/unified-db';
import { ExtendedSession } from '@/types/session';

/**
 * SIMPLIFIED BUYER PROFILE API
 * 
 * Stores ONLY essential buyer data:
 * - Contact info (from user record)
 * - Search preferences (city, budgets)
 * 
 * NO realtor matching, NO complex algorithms, NO dependencies.
 */

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

  } catch {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    
    // Consolidated profile structure - includes lead selling fields
    const profileData = {
      userId: session.user.id,
      
      // Contact info (try request first, fallback to user record)
      firstName: firstName || userRecord?.name?.split(' ')[0] || '',
      lastName: lastName || userRecord?.name?.split(' ').slice(1).join(' ') || '',
      email: session.user.email!,
      phone: phone || '',
      
      // Location (both formats for compatibility)
      preferredCity: city,
      preferredState: state,
      city: city,                    // API compatibility
      state: state,                  // API compatibility
      searchRadius: 25,
      
      // Budget constraints
      maxMonthlyPayment: Number(maxMonthlyPayment),
      maxDownPayment: Number(maxDownPayment),
      
      // Communication preferences
      languages: ['English'],
      emailNotifications: true,
      smsNotifications: true,
      
      // System fields
      profileComplete: true,
      isActive: true,
      
      // Property interaction arrays
      matchedPropertyIds: [],
      likedPropertyIds: [],
      passedPropertyIds: [],
      
      // Lead selling fields
      isAvailableForPurchase: true,
      leadPrice: 1,
      
      // Activity tracking
      lastActiveAt: serverTimestamp(),
      
      // Metadata
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };


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
    } else {
      // Update existing profile
      buyerId = existing.docs[0].id;
      await updateDoc(doc(db, 'buyerProfiles', buyerId), profileData);
    }

    // Lead selling fields are now part of the main profile - no separate buyerLinks needed

    return NextResponse.json({ 
      success: true,
      buyerId,
      message: 'Profile saved successfully'
    });

  } catch {
    return NextResponse.json({ 
      error: 'Failed to save profile' 
    }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    },
  });
}