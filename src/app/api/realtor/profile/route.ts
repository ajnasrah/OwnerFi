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
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id!)
    );
    const existingProfiles = await getDocs(realtorsQuery);

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
      updatedAt: serverTimestamp()
    };

    if (existingProfiles.empty) {
      // Create new realtor profile
      const realtorId = firestoreHelpers.generateId();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 day trial

      await setDoc(doc(db, 'realtors', realtorId), {
        ...realtorData,
        id: realtorId,
        credits: 3, // 3 free trial credits
        isOnTrial: true,
        trialStartDate: serverTimestamp(),
        trialEndDate: trialEndDate,
        profileComplete: true,
        createdAt: serverTimestamp()
      });

      // Create trial subscription record
      const subscriptionId = firestoreHelpers.generateId();
      await setDoc(doc(db, 'realtorSubscriptions', subscriptionId), {
        id: subscriptionId,
        realtorId: realtorId,
        plan: 'trial',
        status: 'active',
        monthlyPrice: 0,
        creditsPerMonth: 3,
        currentPeriodStart: serverTimestamp(),
        currentPeriodEnd: trialEndDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
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
      await updateDoc(doc(db, 'realtors', existingDoc.id), realtorData);
      
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

    await logError('Failed to save realtor profile', error, {
      action: 'realtor_profile_error'
    });

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
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id!)
    );
    const realtorDocs = await getDocs(realtorsQuery);

    if (realtorDocs.empty) {
      return NextResponse.json({ profile: null });
    }

    const realtorDoc = realtorDocs.docs[0];
    const profile = { id: realtorDoc.id, ...realtorDoc.data() };

    // Get subscription information
    const subscriptionsQuery = query(
      collection(db, 'realtorSubscriptions'),
      where('realtorId', '==', realtorDoc.id)
    );
    const subscriptionDocs = await getDocs(subscriptionsQuery);
    
    let subscription = null;
    if (!subscriptionDocs.empty) {
      const subDoc = subscriptionDocs.docs[0];
      subscription = {
        plan: subDoc.data().plan,
        status: subDoc.data().status,
        monthlyPrice: subDoc.data().monthlyPrice,
        currentPeriodEnd: subDoc.data().currentPeriodEnd
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

    await logError('Failed to fetch realtor profile', error, {
      action: 'realtor_profile_fetch_error'
    });

    return NextResponse.json(
      { error: 'Failed to load profile. Please try again.' },
      { status: 500 }
    );
  }
}