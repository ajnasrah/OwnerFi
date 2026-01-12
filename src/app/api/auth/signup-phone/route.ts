import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { unifiedDb } from '@/lib/unified-db';
import { logInfo, logError } from '@/lib/logger';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';
import { generateBuyerFilter } from '@/lib/buyer-filter-service';

// Simple in-memory rate limiter with cleanup
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 signup attempts per minute per IP (stricter than check-phone)
let lastCleanup = Date.now();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Cleanup old entries periodically
  if (now - lastCleanup > RATE_LIMIT_WINDOW * 2) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
    lastCleanup = now;
  }

  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    if (!checkRateLimit(ip)) {
      console.warn(`🚫 [SIGNUP-PHONE] Rate limit exceeded for IP: ${ip}`);
      await logError('Signup rate limit exceeded', {
        action: 'signup_phone_rate_limit',
        metadata: { ip }
      });
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      );
    }
    const body = await request.json();
    const {
      phone,
      firstName,
      lastName,
      email,
      role,
      isInvestor = false,
      // Buyer specific
      city,
      state,
      // Realtor specific
      company,
      licenseNumber,
      primaryCity
    } = body;

    console.log('📝 [SIGNUP-PHONE] Received isInvestor:', isInvestor);

    // Validation
    if (!phone || !firstName || !lastName || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (role !== 'buyer' && role !== 'realtor') {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Validate phone format
    if (!isValidPhone(phone)) {
      console.log(`❌ [SIGNUP-PHONE] Invalid phone format: ${phone}`);
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // 🔧 Normalize phone to E.164 format (+1XXXXXXXXXX)
    const normalizedPhone = normalizePhone(phone);
    console.log(`📱 [SIGNUP-PHONE] Phone normalized: ${phone} → ${normalizedPhone}`);

    // 🔄 CHECK FOR EXISTING USER: Don't create duplicates!
    console.log('🔍 [SIGNUP-PHONE] Step 1: Checking for existing user...');
    let existingEmailUser, existingPhoneUser;
    try {
      existingEmailUser = await unifiedDb.users.findByEmail(email.toLowerCase());
      existingPhoneUser = await unifiedDb.users.findByPhone(normalizedPhone);
    } catch (findError: any) {
      console.error('❌ [SIGNUP-PHONE] Error finding existing user:', findError.message);
      throw findError;
    }

    console.log(`🔍 [SIGNUP-PHONE] Checking for existing user:`, {
      email: email.toLowerCase(),
      phone: normalizedPhone,
      foundByEmail: !!existingEmailUser,
      foundByPhone: !!existingPhoneUser
    });

    let newUser: { id: string };

    // SECURITY: If user already exists, don't allow modification via signup
    // Users should use the login flow instead
    if (existingPhoneUser) {
      console.log(`⚠️ [SIGNUP-PHONE] User already exists with this phone - should login instead:`, {
        userId: existingPhoneUser.id,
        phone: existingPhoneUser.phone
      });

      // Return the existing user ID so they can log in
      return NextResponse.json({
        success: true,
        message: 'Account already exists - logged in',
        userId: existingPhoneUser.id,
        role: existingPhoneUser.role,
        existingAccount: true
      });
    }

    if (existingEmailUser) {
      // Email exists but phone doesn't match - security issue
      // Don't allow attacker to hijack account via different phone
      if (existingEmailUser.phone && existingEmailUser.phone !== normalizedPhone) {
        console.log(`🚫 [SIGNUP-PHONE] Email exists with different phone - blocking:`, {
          userId: existingEmailUser.id,
          existingPhone: existingEmailUser.phone?.substring(0, 5) + '****',
          attemptedPhone: normalizedPhone.substring(0, 5) + '****'
        });

        await logError('Signup attempt with existing email but different phone', {
          action: 'signup_phone_email_hijack_attempt',
          metadata: { email: email.toLowerCase() }
        });

        return NextResponse.json(
          { error: 'An account with this email already exists. Please use your original phone number or contact support.' },
          { status: 409 }
        );
      }

      // Email exists, no phone set yet - allow linking (migration from password auth)
      console.log(`🔄 [SIGNUP-PHONE] Linking phone to existing email account:`, {
        userId: existingEmailUser.id,
        email: existingEmailUser.email
      });

      const { FirebaseDB } = await import('@/lib/firebase-db');
      await FirebaseDB.updateDocument('users', existingEmailUser.id, {
        phone: normalizedPhone,
        updatedAt: Timestamp.now(),
        migratedToPhoneAuth: true,
        migratedAt: Timestamp.now()
      });

      newUser = { id: existingEmailUser.id };
      console.log('✅ [SIGNUP-PHONE] Linked phone to existing account');
    } else {
      // No existing user - create new one
      console.log('✅ [SIGNUP-PHONE] Step 2: No existing user - creating new account');

      try {
        newUser = await unifiedDb.users.create({
          name: `${firstName} ${lastName}`.trim(),
          email: email.toLowerCase().trim(),
          phone: normalizedPhone,
          role,
          password: '' // Empty password for phone-auth users
        });
        console.log('✅ [SIGNUP-PHONE] Created new user account:', newUser.id);
      } catch (createError: any) {
        console.error('❌ [SIGNUP-PHONE] Failed to create user:', createError.message);
        throw createError;
      }
    }

    // Create role-specific profile
    console.log('📝 [SIGNUP-PHONE] Step 3: Creating role-specific profile for:', role);

    if (role === 'buyer') {
      if (!db) {
        console.error('❌ [SIGNUP-PHONE] Firebase client db is null!');
        return NextResponse.json(
          { error: 'Database not initialized' },
          { status: 500 }
        );
      }

      // Check for existing buyerProfile by phone or userId
      const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
      let existingBuyerProfile: { id: string; ref: ReturnType<typeof doc> } | null = null;

      // Try to find existing profile by phone
      const phoneQuery = query(
        collection(db, 'buyerProfiles'),
        where('phone', '==', normalizedPhone)
      );
      const phoneSnapshot = await getDocs(phoneQuery);

      if (!phoneSnapshot.empty) {
        existingBuyerProfile = {
          id: phoneSnapshot.docs[0].id,
          ref: phoneSnapshot.docs[0].ref
        };
        console.log(`🔍 [SIGNUP-PHONE] Found existing buyerProfile by phone: ${existingBuyerProfile.id}`);
      } else {
        // Try by userId
        const userQuery = query(
          collection(db, 'buyerProfiles'),
          where('userId', '==', newUser.id)
        );
        const userSnapshot = await getDocs(userQuery);

        if (!userSnapshot.empty) {
          existingBuyerProfile = {
            id: userSnapshot.docs[0].id,
            ref: userSnapshot.docs[0].ref
          };
          console.log(`🔍 [SIGNUP-PHONE] Found existing buyerProfile by userId: ${existingBuyerProfile.id}`);
        }
      }

      let buyerId: string;

      if (existingBuyerProfile) {
        // UPDATE existing profile with new data (including isInvestor)
        buyerId = existingBuyerProfile.id;
        console.log(`🔄 [SIGNUP-PHONE] Updating existing buyerProfile: ${buyerId}, isInvestor: ${isInvestor}`);

        await updateDoc(existingBuyerProfile.ref, {
          userId: newUser.id,
          firstName,
          lastName,
          email: email.toLowerCase().trim(),
          phone: normalizedPhone,
          preferredCity: city || '',
          preferredState: state || '',
          city: city || '',
          state: state || '',
          isInvestor: isInvestor === true,
          profileComplete: !!(city && state),
          updatedAt: serverTimestamp()
        });

        console.log(`✅ [SIGNUP-PHONE] Updated buyerProfile with isInvestor: ${isInvestor}`);
      } else {
        // CREATE new profile
        buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        console.log(`✨ [SIGNUP-PHONE] Creating new buyerProfile: ${buyerId}, isInvestor: ${isInvestor}`);

        // Generate filter BEFORE creating profile (not in background)
        let filter = undefined;
        if (city && state) {
          try {
            filter = await generateBuyerFilter(city, state, 30);
            console.log(`✅ [SIGNUP-PHONE] Generated filter with ${filter.nearbyCitiesCount} nearby cities for ${city}, ${state}`);
          } catch (filterError) {
            console.error('⚠️ [SIGNUP-PHONE] Failed to generate filter, continuing without:', filterError);
          }
        }

        const buyerData = {
          id: buyerId,
          userId: newUser.id,
          firstName,
          lastName,
          email: email.toLowerCase().trim(),
          phone: normalizedPhone,

          // Location - filled from signup form
          preferredCity: city || '',
          preferredState: state || '',
          city: city || '',
          state: state || '',
          searchRadius: 25,

          // Pre-computed nearby cities filter
          ...(filter && { filter }),

          // User type flags
          isInvestor: isInvestor === true,

          // Communication preferences
          languages: ['English'],
          emailNotifications: true,
          smsNotifications: true,

          // System fields - mark complete if city/state provided
          profileComplete: !!(city && state),
          isActive: true,

          // Property interaction arrays
          matchedPropertyIds: [],
          likedPropertyIds: [],
          passedPropertyIds: [],

          // Lead selling fields - make buyers available for realtors immediately
          isAvailableForPurchase: true,
          leadPrice: 1,

          // Activity tracking
          lastActiveAt: serverTimestamp(),

          // Metadata
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        try {
          await setDoc(doc(db, 'buyerProfiles', buyerId), buyerData);
          console.log(`✅ [SIGNUP-PHONE] Created new buyerProfile: ${buyerId}`);
        } catch (profileError: any) {
          console.error('❌ [SIGNUP-PHONE] Failed to create buyerProfile:', profileError.message);
          throw profileError;
        }
      }

      // Sync to GHL in background (non-blocking)
      const { syncBuyerToGHL } = await import('@/lib/gohighlevel-api');
      const buyerEmail = email.toLowerCase().trim();
      syncBuyerToGHL({
        id: buyerId,
        userId: newUser.id,
        firstName,
        lastName,
        email: buyerEmail,
        phone: normalizedPhone,
        city: city || '',
        state: state || '',
        searchRadius: 25,
        languages: ['English']
      }).then(result => {
        if (result.success) {
          logInfo('New buyer synced to GoHighLevel on phone signup', {
            action: 'buyer_phone_signup_ghl_sync',
            metadata: { buyerId, email: buyerEmail }
          });
        } else {
          logError('Failed to sync new buyer to GoHighLevel', {
            action: 'buyer_phone_signup_ghl_sync_failed',
            metadata: { buyerId, error: result.error }
          });
        }
      }).catch(error => {
        logError('Error syncing new buyer to GoHighLevel', {
          action: 'buyer_phone_signup_ghl_sync_error',
          metadata: { buyerId }
        }, error);
      });

      await logInfo('Created new buyer account via phone auth', {
        action: 'buyer_phone_signup',
        userId: newUser.id,
        metadata: { phone: normalizedPhone }
      });

      return NextResponse.json({
        success: true,
        message: 'Buyer account created successfully',
        userId: newUser.id,
        role: 'buyer'
      });

    } else if (role === 'realtor') {
      // Realtor signup - Create BOTH realtor data AND buyer profile
      if (!db) {
        return NextResponse.json(
          { error: 'Database not initialized' },
          { status: 500 }
        );
      }

      const { FirebaseDB } = await import('@/lib/firebase-db');
      const { RealtorDataHelper, formatPhone } = await import('@/lib/realtor-models');

      // Create service area using the city from the form
      const serviceArea = {
        primaryCity: {
          name: city || 'Not set',
          state: state || 'Not set',
          stateCode: state || 'XX',
          placeId: 'setup-required',
          coordinates: { lat: 0, lng: 0 },
          formattedAddress: city && state ? `${city}, ${state}` : 'Not set'
        },
        nearbyCities: [],
        radiusMiles: 30,
        totalCitiesServed: 0,
        lastUpdated: Timestamp.now()
      };

      // Create realtor data structure
      const realtorData = RealtorDataHelper.createRealtorData(
        firstName,
        lastName,
        normalizedPhone, // ✅ Use E.164 format for consistency
        email,
        serviceArea,
        company || '',
        licenseNumber || ''
      );

      // Update user document with realtor data
      await FirebaseDB.updateDocument('users', newUser.id, {
        phone: normalizedPhone, // ✅ Use E.164 format for consistency
        realtorData,
        updatedAt: Timestamp.now()
      });

      // 🆕 ALSO CREATE BUYER PROFILE - Realtors use buyer dashboard
      const buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Generate filter BEFORE creating profile (not in background)
      let realtorFilter = undefined;
      if (city && state) {
        try {
          realtorFilter = await generateBuyerFilter(city, state, 30);
          console.log(`✅ [SIGNUP-PHONE] Generated filter with ${realtorFilter.nearbyCitiesCount} nearby cities for realtor in ${city}, ${state}`);
        } catch (filterError) {
          console.error('⚠️ [SIGNUP-PHONE] Failed to generate filter for realtor, continuing without:', filterError);
        }
      }

      const buyerData = {
        id: buyerId,
        userId: newUser.id,
        firstName,
        lastName,
        email: email.toLowerCase().trim(),
        phone: normalizedPhone,

        // Location - filled from signup form (realtor's service area)
        preferredCity: city || '',
        preferredState: state || '',
        city: city || '',
        state: state || '',
        searchRadius: 25,

        // Pre-computed nearby cities filter
        ...(realtorFilter && { filter: realtorFilter }),

        // User type flags
        isInvestor: isInvestor === true,
        isRealtor: true,

        // Communication preferences
        languages: ['English'],
        emailNotifications: true,
        smsNotifications: true,

        // System fields - mark complete if city/state provided
        profileComplete: !!(city && state),
        isActive: true,

        // Property interaction arrays
        matchedPropertyIds: [],
        likedPropertyIds: [],
        passedPropertyIds: [],

        // Lead selling fields - REALTORS should NEVER be available for purchase
        isAvailableForPurchase: false,
        leadPrice: 0,

        // Activity tracking
        lastActiveAt: serverTimestamp(),

        // Metadata
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'buyerProfiles', buyerId), buyerData);

      await logInfo('Created new realtor account via phone auth (with buyer profile)', {
        action: 'realtor_phone_signup',
        userId: newUser.id,
        metadata: { phone: normalizedPhone, licenseNumber: licenseNumber || 'not provided', buyerId }
      });

      return NextResponse.json({
        success: true,
        message: 'Realtor account created successfully',
        userId: newUser.id,
        role: 'realtor'
      });
    }

    return NextResponse.json(
      { error: 'Invalid role specified' },
      { status: 400 }
    );

  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const errorStack = error?.stack || '';

    // Log full error details server-side for debugging
    console.error('❌ [SIGNUP-PHONE] Error:', errorMessage);
    console.error('❌ [SIGNUP-PHONE] Stack:', errorStack);

    await logError('Failed to create account via phone auth', {
      action: 'phone_signup_error',
      metadata: { errorMessage, errorStack: errorStack.substring(0, 500) }
    }, error as Error);

    // SECURITY: Don't expose internal error details to clients
    // Return generic error message to prevent information disclosure
    return NextResponse.json(
      { error: 'Failed to create account. Please try again or contact support.' },
      { status: 500 }
    );
  }
}
