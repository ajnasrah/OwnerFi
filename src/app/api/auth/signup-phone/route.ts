import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { unifiedDb } from '@/lib/unified-db';
import { logInfo, logError } from '@/lib/logger';
import { formatPhoneNumber } from '@/lib/firebase-phone-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      phone,
      firstName,
      lastName,
      email,
      role,
      // Buyer specific
      city,
      state,
      maxMonthlyPayment,
      maxDownPayment,
      // Realtor specific
      company,
      licenseNumber,
      primaryCity
    } = body;

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

    // 🔧 Normalize phone to E.164 format (+1XXXXXXXXXX)
    const normalizedPhone = formatPhoneNumber(phone);
    console.log(`📱 [SIGNUP-PHONE] Phone normalized: ${phone} → ${normalizedPhone}`);

    // 🔄 CHECK FOR EXISTING USER: Don't create duplicates!
    const existingEmailUser = await unifiedDb.users.findByEmail(email.toLowerCase());
    const existingPhoneUser = await unifiedDb.users.findByPhone(normalizedPhone);

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
      console.log('✅ [SIGNUP-PHONE] No existing user - creating new account');

      newUser = await unifiedDb.users.create({
        name: `${firstName} ${lastName}`.trim(),
        email: email.toLowerCase().trim(),
        phone: normalizedPhone,
        role,
        password: '' // Empty password for phone-auth users
      });

      console.log('✅ [SIGNUP-PHONE] Created new user account:', newUser.id);
    }

    // Create role-specific profile
    if (role === 'buyer') {
      if (!db) {
        return NextResponse.json(
          { error: 'Database not initialized' },
          { status: 500 }
        );
      }

      const buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const buyerData = {
        id: buyerId,
        userId: newUser.id,
        firstName,
        lastName,
        email: email.toLowerCase().trim(),
        phone: normalizedPhone,

        // Location - empty until user fills settings
        preferredCity: '',
        preferredState: '',
        city: '',
        state: '',
        searchRadius: 25,

        // Budget - zero until user fills settings
        maxMonthlyPayment: 0,
        maxDownPayment: 0,

        // Communication preferences
        languages: ['English'],
        emailNotifications: true,
        smsNotifications: true,

        // System fields - profile NOT complete yet
        profileComplete: false,
        isActive: true,

        // Property interaction arrays
        matchedPropertyIds: [],
        likedPropertyIds: [],
        passedPropertyIds: [],

        // Lead selling fields
        isAvailableForPurchase: false,
        leadPrice: 1,

        // Activity tracking
        lastActiveAt: serverTimestamp(),

        // Metadata
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'buyerProfiles', buyerId), buyerData);

      // Sync to GHL
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
        maxMonthlyPayment: buyerData.maxMonthlyPayment,
        maxDownPayment: buyerData.maxDownPayment,
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

      // Create service area (placeholder for now - they can update later)
      const serviceArea = {
        primaryCity: {
          name: primaryCity === 'Setup Required' ? 'Setup Required' : primaryCity,
          state: 'Setup Required',
          stateCode: 'XX',
          placeId: 'setup-required',
          coordinates: { lat: 0, lng: 0 },
          formattedAddress: 'Setup Required'
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

        // Location - empty until user fills settings
        preferredCity: '',
        preferredState: '',
        city: '',
        state: '',
        searchRadius: 25,

        // Budget - zero until user fills settings
        maxMonthlyPayment: 0,
        maxDownPayment: 0,

        // Communication preferences
        languages: ['English'],
        emailNotifications: true,
        smsNotifications: true,

        // System fields - profile NOT complete yet
        profileComplete: false,
        isActive: true,

        // Property interaction arrays
        matchedPropertyIds: [],
        likedPropertyIds: [],
        passedPropertyIds: [],

        // Lead selling fields
        isAvailableForPurchase: false,
        leadPrice: 1,

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

  } catch (error) {
    await logError('Failed to create account via phone auth', {
      action: 'phone_signup_error'
    }, error as Error);

    console.error('Phone signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
