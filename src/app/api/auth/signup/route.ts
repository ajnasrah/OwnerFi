import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Dynamic imports to avoid build-time Firebase initialization
  const { hash } = await import('bcryptjs');
  const { unifiedDb } = await import('@/lib/unified-db');
  const { logError, logInfo } = await import('@/lib/logger');
  try {
    const body = await request.json();
    const { name, firstName, lastName, email, password, phone, userType, languages } = body;

    // Use name if provided, otherwise combine firstName + lastName
    const fullName = name || `${firstName || ''} ${lastName || ''}`.trim();

    // Validation
    if (!fullName || !email || !password || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password, and phone are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await unifiedDb.users.findByEmail(email.toLowerCase());
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user account - Stripe customer will be created on first payment
    const newUser = await unifiedDb.users.create({
      name: fullName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone?.trim(),
      role: userType || 'buyer'
    });

    // Auto-create buyer profile skeleton to avoid orphaned users
    if ((userType || 'buyer') === 'buyer') {
      const { db } = await import('@/lib/firebase');
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { syncBuyerToGHL } = await import('@/lib/gohighlevel-api');

      if (db) {
        const buyerId = `buyer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const buyerData = {
          id: buyerId,
          userId: newUser.id,
          firstName: firstName || fullName.split(' ')[0] || '',
          lastName: lastName || fullName.split(' ').slice(1).join(' ') || '',
          email: email.toLowerCase().trim(),
          phone: phone?.trim() || '',

          // Empty location fields - to be filled in setup
          preferredCity: '',
          preferredState: '',
          city: '',
          state: '',
          searchRadius: 25,

          // Empty budget fields - to be filled in setup
          maxMonthlyPayment: 0,
          maxDownPayment: 0,

          // Communication preferences
          languages: languages || ['English'],
          emailNotifications: true,
          smsNotifications: true,

          // System fields
          profileComplete: false, // Mark incomplete until setup is done
          isActive: true,

          // Property interaction arrays
          matchedPropertyIds: [],
          likedPropertyIds: [],
          passedPropertyIds: [],

          // Lead selling fields
          isAvailableForPurchase: false, // Don't sell incomplete profiles
          leadPrice: 1,

          // Activity tracking
          lastActiveAt: serverTimestamp(),

          // Metadata
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, 'buyerProfiles', buyerId), buyerData);

        // Send new buyer to GHL webhook immediately
        syncBuyerToGHL({
          id: buyerId,
          userId: newUser.id,
          firstName: buyerData.firstName,
          lastName: buyerData.lastName,
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
            logInfo('New buyer synced to GoHighLevel on signup', {
              action: 'buyer_signup_ghl_sync',
              metadata: { buyerId, email: buyerData.email }
            });
          } else {
            logError('Failed to sync new buyer to GoHighLevel', {
              action: 'buyer_signup_ghl_sync_failed',
              metadata: { buyerId, error: result.error }
            });
          }
        }).catch(error => {
          logError('Error syncing new buyer to GoHighLevel', {
            action: 'buyer_signup_ghl_sync_error',
            metadata: { buyerId }
          }, error);
        });
      }
    }

    await logInfo('Created new buyer account', {
      action: 'buyer_signup',
      userId: newUser.id,
      userType: userType || 'buyer',
      metadata: {
        phone: phone.trim(),
        languages: languages || ['English']
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      userId: newUser.id,
      redirectTo: (userType || 'buyer') === 'buyer' ? '/auth/setup' : '/realtor-dashboard'
    });

  } catch (error) {
    await logError('Failed to create buyer account', {
      action: 'buyer_signup_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}