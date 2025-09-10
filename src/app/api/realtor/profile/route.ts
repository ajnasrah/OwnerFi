import { NextRequest, NextResponse } from 'next/server';
import { logError, logInfo } from '@/lib/logger';
import { getSessionWithRole } from '@/lib/auth-utils';
import { firestoreHelpers } from '@/lib/firestore';
import { RealtorProfile } from '@/lib/firebase-models';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // Enforce realtor role only
    const session = await getSessionWithRole('realtor');
    
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
      company,
      licenseNumber,
      licenseState,
      primaryCity,
      primaryState,
      serviceRadius,
      serviceStates,
      serviceCities,
      email
    } = body;

    // Validation
    if (!firstName || !lastName || !phone || !company) {
      return NextResponse.json(
        { error: 'Missing required fields: name, phone, and company/brokerage' },
        { status: 400 }
      );
    }

    await logInfo('Creating realtor profile', {
      action: 'realtor_profile_create',
      userId: session.user.id,
      userType: 'realtor',
      metadata: { 
        licenseState,
        serviceStates: serviceStates?.length || 0,
        company: company || 'Independent'
      }
    });

    // Check if profile already exists
    const existingProfiles = await adminDb.collection('realtors').where('userId', '==', session.user.id!).get();

    const realtorData = {
      userId: session.user.id!,
      firstName,
      lastName,
      email: email || session.user.email!,
      phone,
      company,
      licenseNumber: licenseNumber || null,
      licenseState: licenseState || null,
      primaryCity: primaryCity || null,
      primaryState: primaryState || null,
      serviceRadius: serviceRadius || 25,
      serviceStates: serviceStates || [],
      serviceCities: serviceCities || [],
      isActive: true,
      updatedAt: new Date()
    };

    if (existingProfiles.empty) {
      // Create new realtor profile
      const realtorId = firestoreHelpers.generateId();
      const now = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 day trial

      await adminDb.collection('realtors').doc(realtorId).set({
        ...realtorData,
        id: realtorId,
        credits: 3, // 3 free trial credits
        isOnTrial: true,
        trialStartDate: now,
        trialEndDate: trialEndDate,
        profileComplete: true,
        createdAt: new Date()
      });

      // Create trial subscription record
      const subscriptionId = firestoreHelpers.generateId();
      await adminDb.collection('realtorSubscriptions').doc(subscriptionId).set({
        id: subscriptionId,
        realtorId: realtorId,
        plan: 'trial',
        status: 'active',
        monthlyPrice: 0,
        creditsPerMonth: 3,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndDate,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await logInfo('Created new realtor profile with trial', {
        action: 'realtor_profile_create',
        userId: session.user.id,
        userType: 'realtor',
        metadata: {
          realtorId,
          trialEndDate: trialEndDate.toISOString(),
          credits: 3
        }
      });
    } else {
      // Update existing profile
      const existingDoc = existingProfiles.docs[0];
      await adminDb.collection('realtors').doc(existingDoc.id).update(realtorData);
      
      await logInfo('Updated realtor profile', {
        action: 'realtor_profile_update',
        userId: session.user.id,
        userType: 'realtor'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Realtor profile saved successfully'
    });

  } catch (error) {
    // Handle role validation errors
    if ((error as Error).message.includes('Access denied') || (error as Error).message.includes('Not authenticated')) {
      return NextResponse.json(
        { error: 'Access denied. Realtor access required.' },
        { status: 403 }
      );
    }

    await logError('Failed to save realtor profile', {
      action: 'realtor_profile_error'
    }, error);

    return NextResponse.json(
      { error: 'Failed to save profile. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Enforce realtor role only
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get realtor profile
    const realtorDocs = await adminDb.collection('realtors').where('userId', '==', session.user.id!).get();

    if (realtorDocs.empty) {
      return NextResponse.json({ profile: null });
    }

    const realtorDoc = realtorDocs.docs[0];
    const profile = { id: realtorDoc.id, ...realtorDoc.data() } as RealtorProfile;

    // Get subscription information
    const subscriptionDocs = await adminDb.collection('realtorSubscriptions').where('realtorId', '==', realtorDoc.id).get();
    
    let subscription = null;
    if (!subscriptionDocs.empty) {
      const subDoc = subscriptionDocs.docs[0];
      const subData = subDoc.data();
      subscription = {
        plan: subData.plan,
        status: subData.status,
        monthlyPrice: subData.monthlyPrice,
        currentPeriodEnd: subData.currentPeriodEnd?.toDate?.()?.toISOString() || subData.currentPeriodEnd
      };
    }

    // Convert Firestore timestamps to ISO strings for frontend
    const profileData = {
      ...profile,
      trialStartDate: profile.trialStartDate?.toDate?.()?.toISOString() || profile.trialStartDate,
      trialEndDate: profile.trialEndDate?.toDate?.()?.toISOString() || profile.trialEndDate,
      createdAt: profile.createdAt?.toDate?.()?.toISOString() || profile.createdAt,
      updatedAt: profile.updatedAt?.toDate?.()?.toISOString() || profile.updatedAt,
      subscription
    };

    return NextResponse.json({ profile: profileData });

  } catch (error) {
    // Handle role validation errors
    if ((error as Error).message.includes('Access denied') || (error as Error).message.includes('Not authenticated')) {
      return NextResponse.json(
        { error: 'Access denied. Realtor access required.' },
        { status: 403 }
      );
    }

    await logError('Failed to fetch realtor profile', {
      action: 'realtor_profile_fetch_error'
    }, error);

    return NextResponse.json(
      { error: 'Failed to load profile. Please try again.' },
      { status: 500 }
    );
  }
}