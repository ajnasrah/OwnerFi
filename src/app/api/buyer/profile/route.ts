import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Query,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { unifiedDb } from '@/lib/unified-db';
import { ExtendedSession } from '@/types/session';
import { syncBuyerToGHL } from '@/lib/gohighlevel-api';
import { logInfo, logWarn, logError } from '@/lib/logger';
import { generateBuyerFilter, shouldUpdateFilter } from '@/lib/buyer-filter-service';

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

    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;

    // Allow both buyers and realtors to access (realtors can use buyer dashboard to search)
    if (!session?.user || (session.user.role !== 'buyer' && session.user.role !== 'realtor')) {
      console.log('❌ [BUYER PROFILE GET] Unauthorized:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        role: session?.user?.role
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // DEBUG: Log what we're searching for
    console.log('🔍 [BUYER PROFILE GET] Searching for profile:', {
      userId: session.user.id,
      email: session.user.email,
      phone: session.user.phone,
      role: session.user.role,
      sessionKeys: Object.keys(session.user)
    });

    // Get buyer profile - try PHONE FIRST (primary for phone-auth users), then userId, then email
    let profilesQuery: Query<DocumentData> | undefined;
    let snapshot: QuerySnapshot<DocumentData> | undefined;
    let foundBy = '';

    // 1. Try by PHONE (most reliable for phone-auth users)
    if (session.user.phone) {
      // Normalize phone number - strip all non-digits and get last 10
      const cleaned = session.user.phone.replace(/\D/g, '');
      const last10Digits = cleaned.slice(-10);

      // Try multiple phone formats
      const phoneFormats = [
        session.user.phone,                                                    // Original format
        last10Digits,                                                          // Just digits
        `+1${last10Digits}`,                                                  // E.164 format
        `(${last10Digits.slice(0,3)}) ${last10Digits.slice(3,6)}-${last10Digits.slice(6)}`, // Formatted
      ];

      console.log('🔍 [BUYER PROFILE GET] Trying phone formats:', phoneFormats);

      for (const phoneFormat of phoneFormats) {
        profilesQuery = query(
          collection(db, 'buyerProfiles'),
          where('phone', '==', phoneFormat)
        );
        snapshot = await getDocs(profilesQuery);

        if (!snapshot.empty) {
          foundBy = `phone:${phoneFormat}`;
          console.log('✅ [BUYER PROFILE GET] Found by phone:', phoneFormat);
          break;
        }
      }
    }

    // 2. Fallback to userId if phone lookup failed
    if (!snapshot || snapshot.empty) {
      console.log('🔍 [BUYER PROFILE GET] Phone lookup failed, trying userId');
      profilesQuery = query(
        collection(db, 'buyerProfiles'),
        where('userId', '==', session.user.id)
      );
      snapshot = await getDocs(profilesQuery);

      if (!snapshot.empty) {
        foundBy = 'userId';
        console.log('✅ [BUYER PROFILE GET] Found by userId');
      }
    }

    // 3. Final fallback to email
    if (snapshot.empty && session.user.email) {
      console.log('🔍 [BUYER PROFILE GET] userId lookup failed, trying email');
      logInfo('Profile not found by phone or userId, trying email', {
        action: 'buyer_profile_fallback',
        metadata: { userId: session.user.id, email: session.user.email, phone: session.user.phone }
      });

      profilesQuery = query(
        collection(db, 'buyerProfiles'),
        where('email', '==', session.user.email)
      );
      snapshot = await getDocs(profilesQuery);

      if (!snapshot.empty) {
        foundBy = 'email';
        console.log('✅ [BUYER PROFILE GET] Found by email');
      }
    }

    // If found by email or phone (not userId), update the userId field for future queries
    if (!snapshot.empty && foundBy !== 'userId') {
      const profileId = snapshot.docs[0].id;
      const profileData = snapshot.docs[0].data();

      console.log(`✅ [BUYER PROFILE GET] Found by ${foundBy}, updating userId:`, {
        profileId,
        oldUserId: profileData.userId,
        newUserId: session.user.id
      });

      await updateDoc(doc(db, 'buyerProfiles', profileId), {
        userId: session.user.id,
        updatedAt: serverTimestamp()
      });
      logInfo('Updated profile with correct userId', {
        action: 'buyer_profile_userId_fix',
        metadata: { profileId, userId: session.user.id, foundBy }
      });
    }

    if (snapshot.empty) {
      console.log('❌ [BUYER PROFILE GET] No profile found at all');
      logInfo('No buyer profile found', {
        action: 'buyer_profile_not_found',
        metadata: { userId: session.user.id, email: session.user.email }
      });
      return NextResponse.json({ profile: null });
    }

    const profileData = snapshot.docs[0].data();
    const profile = {
      id: snapshot.docs[0].id,
      ...profileData
    };

    console.log('✅ [BUYER PROFILE GET] Profile found:', {
      profileId: profile.id,
      hasCity: !!profileData.city || !!profileData.preferredCity,
      hasMaxMonthlyPayment: !!profileData.maxMonthlyPayment,
      hasMaxDownPayment: !!profileData.maxDownPayment,
      profileComplete: profileData.profileComplete
    });

    return NextResponse.json({ profile });

  } catch (error) {
    console.error('❌ [BUYER PROFILE GET] Error:', error);
    await logError('GET /api/buyer/profile error', { action: 'buyer_profile_get_error' }, error as Error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

// Buyer profile update interface (for documentation)
// interface BuyerProfileUpdate {
//   firstName?: string;
//   lastName?: string;
//   phone?: string;
//   city: string;
//   state: string;
//   maxMonthlyPayment?: number;
//   maxDownPayment?: number;
//   // Optional property filters
//   minBedrooms?: number;
//   maxBedrooms?: number;
//   minBathrooms?: number;
//   maxBathrooms?: number;
//   minSquareFeet?: number;
//   maxSquareFeet?: number;
//   minPrice?: number;
//   maxPrice?: number;
// }

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;

    // Allow both buyers and realtors to access (realtors can use buyer dashboard to search)
    if (!session?.user || (session.user.role !== 'buyer' && session.user.role !== 'realtor')) {
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
      maxDownPayment,
      // Optional property filters
      minBedrooms,
      maxBedrooms,
      minBathrooms,
      maxBathrooms,
      minSquareFeet,
      maxSquareFeet,
      minPrice,
      maxPrice
    } = body;

    // Validate required fields
    if (!city || !state) {
      return NextResponse.json({
        error: 'Missing required: city, state'
      }, { status: 400 });
    }

    // Get user contact info from database if not provided
    const userRecord = await unifiedDb.users.findById(session.user.id);

    // 🆕 Check if we need to update existing profile or create new one
    const existingQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const existing = await getDocs(existingQuery);
    const existingProfile = existing.empty ? null : existing.docs[0].data();

    // 🆕 Generate or update pre-computed filter (only if needed)
    let filter: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (shouldUpdateFilter(city, state, existingProfile?.filter)) {
      console.log(`🔧 [PROFILE] Generating new filter for ${city}, ${state}`);
      filter = await generateBuyerFilter(city, state, 30);
      console.log(`✅ [PROFILE] Filter generated: ${filter.nearbyCitiesCount} nearby cities`);
    } else {
      console.log('✅ [PROFILE] Using existing valid filter');
      filter = existingProfile?.filter;
    }

    // Consolidated profile structure - includes lead selling fields
    const profileData = {
      userId: session.user.id,

      // Contact info (try request first, fallback to user record)
      firstName: firstName || userRecord?.name?.split(' ')[0] || '',
      lastName: lastName || userRecord?.name?.split(' ').slice(1).join(' ') || '',
      email: session.user.email!,
      phone: phone || userRecord?.phone || '',

      // Location (both formats for compatibility)
      preferredCity: city,
      preferredState: state,
      city: city,                    // API compatibility
      state: state,                  // API compatibility
      searchRadius: 25,

      // Budget constraints (optional - kept for backward compatibility)
      ...(maxMonthlyPayment !== undefined && { maxMonthlyPayment: Number(maxMonthlyPayment) }),
      ...(maxDownPayment !== undefined && { maxDownPayment: Number(maxDownPayment) }),

      // Property requirements (optional filters)
      ...(minBedrooms !== undefined && { minBedrooms: Number(minBedrooms) }),
      ...(maxBedrooms !== undefined && { maxBedrooms: Number(maxBedrooms) }),
      ...(minBathrooms !== undefined && { minBathrooms: Number(minBathrooms) }),
      ...(maxBathrooms !== undefined && { maxBathrooms: Number(maxBathrooms) }),
      ...(minSquareFeet !== undefined && { minSquareFeet: Number(minSquareFeet) }),
      ...(maxSquareFeet !== undefined && { maxSquareFeet: Number(maxSquareFeet) }),
      ...(minPrice !== undefined && { minPrice: Number(minPrice) }),
      ...(maxPrice !== undefined && { maxPrice: Number(maxPrice) }),

      // Communication preferences
      languages: ['English'],
      emailNotifications: true,
      smsNotifications: true,

      // System fields
      profileComplete: true,
      isActive: true,

      // Property interaction arrays
      matchedPropertyIds: [],
      likedPropertyIds: existingProfile?.likedPropertyIds || [],
      passedPropertyIds: existingProfile?.passedPropertyIds || [],
      viewedPropertyIds: existingProfile?.viewedPropertyIds || [],

      // 🆕 Pre-computed filter (for 100K user scale)
      filter,

      // Lead selling fields
      isAvailableForPurchase: true,
      leadPrice: 1,

      // Activity tracking
      lastActiveAt: serverTimestamp(),

      // Metadata
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };


    // Save profile (already queried above for filter check)
    let buyerId: string;

    if (existing.empty) {
      // Create new profile
      buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'buyerProfiles', buyerId), {
        ...profileData,
        id: buyerId
      });
      console.log(`✅ [PROFILE] Created new buyer profile: ${buyerId}`);
    } else {
      // Update existing profile
      buyerId = existing.docs[0].id;
      await updateDoc(doc(db, 'buyerProfiles', buyerId), profileData);
      console.log(`✅ [PROFILE] Updated existing buyer profile: ${buyerId}`);
    }

    // Lead selling fields are now part of the main profile - no separate buyerLinks needed

    // Sync buyer to GoHighLevel (async, don't block response)
    const isNewProfile = existing.empty;
    if (isNewProfile) {
      // Only sync new buyers to avoid overwhelming GoHighLevel with updates
      syncBuyerToGHL({
        id: buyerId,
        userId: session.user.id,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        phone: profileData.phone,
        city: profileData.city,
        state: profileData.state,
        maxMonthlyPayment: profileData.maxMonthlyPayment,
        maxDownPayment: profileData.maxDownPayment,
        searchRadius: profileData.searchRadius,
        languages: profileData.languages
      }).then(result => {
        if (result.success) {
          logInfo('Buyer synced to GoHighLevel', {
            action: 'buyer_ghl_sync',
            metadata: { buyerId, contactId: result.contactId }
          });
        } else {
          logWarn('Failed to sync buyer to GoHighLevel', {
            action: 'buyer_ghl_sync_failed',
            metadata: { buyerId, error: result.error }
          });
        }
      }).catch(error => {
        logWarn('Error syncing buyer to GoHighLevel', {
          action: 'buyer_ghl_sync_error',
          metadata: { buyerId, error: error.message }
        });
      });
    }

    return NextResponse.json({
      buyerId,
      message: 'Profile saved successfully'
    });

  } catch (error) {
    console.error('❌ [BUYER PROFILE POST] Error:', error);
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