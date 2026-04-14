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
import { getAllPhoneFormats, normalizePhone } from '@/lib/phone-utils';

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

    // Allow buyers, realtors, and admins to access
    if (!session?.user || (session.user.role !== 'buyer' && session.user.role !== 'realtor' && session.user.role !== 'admin')) {
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
      // Use unified phone utils to get all possible formats
      const phoneFormats = getAllPhoneFormats(session.user.phone);

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
      profileComplete: profileData.profileComplete,
      isInvestor: profileData.isInvestor,
      isRealtor: profileData.isRealtor
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

    // Allow buyers, realtors, and admins to access
    if (!session?.user || (session.user.role !== 'buyer' && session.user.role !== 'realtor' && session.user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const {
      firstName,
      lastName,
      phone,
      city,
      state,
      // User type flags
      isRealtor,
      isInvestor,
      dealTypePreference,
      // Optional property filters
      minBedrooms,
      maxBedrooms,
      minBathrooms,
      maxBathrooms,
      minSquareFeet,
      maxSquareFeet,
      minPrice,
      maxPrice,
      // Deal alert preferences
      arvThreshold,
      // Search radius
      searchRadius: rawSearchRadius
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

    // Compute search radius (use provided value, fallback to existing, default 30)
    const searchRadius = rawSearchRadius !== undefined
      ? Math.min(100, Math.max(10, Number(rawSearchRadius) || 30))
      : existingProfile?.searchRadius || 30;

    // 🆕 Generate or update pre-computed filter (only if needed)
    let filter: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (shouldUpdateFilter(city, state, existingProfile?.filter, searchRadius)) {
      console.log(`🔧 [PROFILE] Generating new filter for ${city}, ${state} (${searchRadius}mi radius)`);
      filter = await generateBuyerFilter(city, state, searchRadius);
      console.log(`✅ [PROFILE] Filter generated: ${filter.nearbyCitiesCount} nearby cities`);
    } else {
      console.log('✅ [PROFILE] Using existing valid filter');
      filter = existingProfile?.filter;
    }

    // Normalize phone (normalizePhone throws on empty string, so guard it)
    const rawPhone = phone || userRecord?.phone || '';
    let profilePhone = rawPhone;
    if (rawPhone) {
      try { profilePhone = normalizePhone(rawPhone); } catch { /* keep raw */ }
    }

    // Consolidated profile structure - includes lead selling fields
    const profileData = {
      userId: session.user.id,

      // Contact info (try request first, fallback to user record)
      firstName: firstName || userRecord?.name?.split(' ')[0] || '',
      lastName: lastName || userRecord?.name?.split(' ').slice(1).join(' ') || '',
      email: session.user.email!,
      phone: profilePhone,

      // Location (both formats for compatibility)
      preferredCity: city,
      preferredState: state,
      city: city,                    // API compatibility
      state: state,                  // API compatibility
      searchRadius,

      // User type flags
      ...(isRealtor !== undefined && { isRealtor: isRealtor === true }),
      ...(isInvestor !== undefined && { isInvestor: isInvestor === true }),
      ...(dealTypePreference !== undefined && ['all', 'owner_finance', 'cash_deal'].includes(dealTypePreference) && { dealTypePreference }),
      ...(arvThreshold !== undefined && !isNaN(Number(arvThreshold)) && { arvThreshold: Math.min(90, Math.max(60, Number(arvThreshold))) }),

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
      matchedPropertyIds: existingProfile?.matchedPropertyIds || [],
      likedPropertyIds: existingProfile?.likedPropertyIds || [],
      passedPropertyIds: existingProfile?.passedPropertyIds || [],
      viewedPropertyIds: existingProfile?.viewedPropertyIds || [],

      // 🆕 Pre-computed filter (for 100K user scale)
      filter,

      // Lead selling fields (preserve existing values on update)
      isAvailableForPurchase: existingProfile?.isAvailableForPurchase ?? true,
      leadPrice: existingProfile?.leadPrice ?? 1,

      // Activity tracking
      lastActiveAt: serverTimestamp(),

      // Metadata
      updatedAt: serverTimestamp()
    };


    // Save profile (already queried above for filter check)
    let buyerId: string;

    if (existing.empty) {
      // Create new profile
      buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await setDoc(doc(db, 'buyerProfiles', buyerId), {
        ...profileData,
        id: buyerId,
        createdAt: serverTimestamp(),
      });
      console.log(`✅ [PROFILE] Created new buyer profile: ${buyerId}`);
    } else {
      // Update existing profile.
      // CRITICAL: do NOT re-enable smsNotifications/marketingOptOut on a
      // buyer who has previously revoked TCPA consent. The existing profile
      // already carries the revocation flags; preserve them by stripping any
      // attempt (intentional or default) to flip them back.
      buyerId = existing.docs[0].id;
      const existingData = existing.docs[0].data() as Record<string, unknown>;
      const wasRevoked = existingData.tcpaRevokedAt != null;
      const safeProfileData = wasRevoked
        ? (() => {
            // Remove any field that would re-enroll a TCPA-revoked buyer.
            const { smsNotifications, marketingOptOut, ...rest } = profileData as Record<string, unknown>;
            // Reference the unused destructured vars so eslint stays quiet
            // (and so a future reviewer sees what was stripped).
            void smsNotifications;
            void marketingOptOut;
            return rest;
          })()
        : profileData;
      await updateDoc(doc(db, 'buyerProfiles', buyerId), safeProfileData);
      console.log(`✅ [PROFILE] Updated existing buyer profile: ${buyerId}${wasRevoked ? ' (TCPA flags preserved)' : ''}`);
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