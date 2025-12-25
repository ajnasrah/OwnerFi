import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { unifiedDb } from '@/lib/unified-db';
import { logInfo, logError } from '@/lib/logger';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';

export async function POST(request: NextRequest) {
  try {
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

    // If user exists by email OR phone, UPDATE them instead of creating new account
    if (existingEmailUser || existingPhoneUser) {
      // Use whichever account we found (prefer email match)
      const existingUser = existingEmailUser || existingPhoneUser!;

      console.log(`🔄 [SIGNUP-PHONE] User already exists - UPDATING existing account:`, {
        userId: existingUser.id,
        email: existingUser.email,
        phone: existingUser.phone,
        hasPassword: !!existingUser.password
      });

      // Update existing user to add phone and migrate to phone-auth
      const { FirebaseDB } = await import('@/lib/firebase-db');
      await FirebaseDB.updateDocument('users', existingUser.id, {
        name: `${firstName} ${lastName}`.trim(),
        email: email.toLowerCase().trim(),
        phone: normalizedPhone,
        role, // Update role if needed
        // Keep password if they have one (allows dual auth)
        updatedAt: Timestamp.now(),
        migratedToPhoneAuth: true,
        migratedAt: Timestamp.now()
      });

      newUser = { id: existingUser.id };
      console.log('✅ [SIGNUP-PHONE] Updated existing user account');
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

      // 🚀 Generate nearby cities filter and sync to GHL in background (non-blocking)
      if (city && state) {
        // Don't await - run in background
        (async () => {
          try {
            const { generateBuyerFilter } = await import('@/lib/buyer-filter-service');
            const filter = await generateBuyerFilter(city, state, 30);

            // Update buyer profile with nearby cities filter
            const { FirebaseDB } = await import('@/lib/firebase-db');
            await FirebaseDB.updateDocument('buyerProfiles', buyerId, {
              filter: filter
            });

            console.log(`✅ [SIGNUP-PHONE] Generated filter with ${filter.nearbyCitiesCount} nearby cities for ${city}, ${state}`);
          } catch (error) {
            console.error('⚠️ [SIGNUP-PHONE] Failed to generate nearby cities filter:', error);
          }
        })();
      }

      // Sync to GHL in background (non-blocking)
      const { syncBuyerToGHL } = await import('@/lib/gohighlevel-api');
      syncBuyerToGHL({
        id: buyerId,
        userId: newUser.id,
        firstName,
        lastName,
        email: buyerData.email,
        phone: buyerData.phone,
        city: buyerData.city,
        state: buyerData.state,
        searchRadius: buyerData.searchRadius,
        languages: buyerData.languages
      }).then(result => {
        if (result.success) {
          logInfo('New buyer synced to GoHighLevel on phone signup', {
            action: 'buyer_phone_signup_ghl_sync',
            metadata: { buyerId, email: buyerData.email }
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

      // 🚀 Generate nearby cities filter in background (non-blocking)
      if (city && state) {
        // Don't await - run in background
        (async () => {
          try {
            const { generateBuyerFilter } = await import('@/lib/buyer-filter-service');
            const filter = await generateBuyerFilter(city, state, 30);

            // Update buyer profile with nearby cities filter
            await FirebaseDB.updateDocument('buyerProfiles', buyerId, {
              filter: filter
            });

            console.log(`✅ [SIGNUP-PHONE] Generated filter with ${filter.nearbyCitiesCount} nearby cities for realtor in ${city}, ${state}`);
          } catch (error) {
            console.error('⚠️ [SIGNUP-PHONE] Failed to generate nearby cities filter for realtor:', error);
          }
        })();
      }

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

    console.error('❌ [SIGNUP-PHONE] Error:', errorMessage);
    console.error('❌ [SIGNUP-PHONE] Stack:', errorStack);

    await logError('Failed to create account via phone auth', {
      action: 'phone_signup_error',
      metadata: { errorMessage, errorStack: errorStack.substring(0, 500) }
    }, error as Error);

    return NextResponse.json(
      { error: `Failed to create account: ${errorMessage}` },
      { status: 500 }
    );
  }
}
