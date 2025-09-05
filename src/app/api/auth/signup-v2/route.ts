// REBUILT user registration with atomic transactions
// Fixes orphaned user/profile records and data inconsistency

import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { FirebaseDB } from '@/lib/firebase-db';
import { BuyerProfile, RealtorProfile, normalizeState, formatCityState } from '@/lib/firebase-models';
import { logError, logInfo } from '@/lib/logger';

interface SignupRequest {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  password: string;
  phone: string;
  role: 'buyer' | 'realtor';
  
  // Buyer-specific fields
  languages?: string[];
  preferredCity?: string;
  preferredState?: string;
  maxMonthlyPayment?: number;
  maxDownPayment?: number;
  searchRadius?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  
  // Realtor-specific fields
  company?: string;
  licenseNumber?: string;
  licenseState?: string;
  primaryCity?: string;
  primaryState?: string;
  serviceRadius?: number;
  serviceStates?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: SignupRequest = await request.json();
    
    // Comprehensive validation
    const validationError = validateSignupData(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await FirebaseDB.findUserByEmail(body.email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(body.password, 12);

    // Prepare user data
    const userData = {
      email: body.email.toLowerCase().trim(),
      name: body.name.trim(),
      password: hashedPassword,
      role: body.role
    };

    // Prepare profile data based on role
    let profileData: any;
    
    if (body.role === 'buyer') {
      profileData = {
        userId: '', // Will be set in transaction
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email.toLowerCase().trim(),
        phone: body.phone.trim(),
        preferredCity: body.preferredCity?.trim() || '',
        preferredState: normalizeState(body.preferredState || ''),
        searchRadius: body.searchRadius || 25,
        maxMonthlyPayment: body.maxMonthlyPayment || 0,
        maxDownPayment: body.maxDownPayment || 0,
        minBedrooms: body.minBedrooms || undefined,
        minBathrooms: body.minBathrooms || undefined,
        languages: body.languages || ['English'],
        emailNotifications: true,
        smsNotifications: false,
        profileComplete: false, // Will be set to true after setup
        isActive: true
      };
    } else {
      // Realtor
      profileData = {
        userId: '', // Will be set in transaction
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email.toLowerCase().trim(),
        phone: body.phone.trim(),
        company: body.company?.trim() || '',
        licenseNumber: body.licenseNumber?.trim() || undefined,
        licenseState: normalizeState(body.licenseState || ''),
        primaryCity: body.primaryCity?.trim() || '',
        primaryState: normalizeState(body.primaryState || ''),
        serviceRadius: body.serviceRadius || 25,
        serviceStates: body.serviceStates || [],
        serviceCities: body.primaryCity && body.primaryState ? 
          [formatCityState(body.primaryCity, body.primaryState)] : [],
        languages: ['English'], // Default, can be updated in settings
        credits: 3, // Trial credits
        isOnTrial: true,
        trialStartDate: new Date(),
        trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        profileComplete: false, // Will be set to true after setup
        isActive: true,
        avgResponseTimeHours: 4,
        successRate: 75,
        specializations: ['owner-financing']
      };
    }

    // Create user + profile atomically
    const result = await FirebaseDB.createUserWithProfile({
      email: userData.email,
      name: userData.name,
      password: userData.password,
      role: body.role,
      profileData
    });

    // Create trial subscription for realtors
    if (body.role === 'realtor') {
      await FirebaseDB.createDocument('realtorSubscriptions', {
        realtorId: result.profile.id,
        plan: 'trial',
        status: 'active',
        monthlyPrice: 0,
        creditsPerMonth: 3,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
    }

    await logInfo(`Created ${body.role} account with atomic transaction`, {
      action: `${body.role}_signup_atomic`,
      userId: result.user.id,
      profileId: result.profile.id,
      email: body.email
    });

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      userId: result.user.id,
      profileId: result.profile.id,
      redirectTo: body.role === 'buyer' ? '/dashboard/setup' : '/realtor/setup'
    });

  } catch (error) {
    await logError('Atomic signup failed', error as Error, {
      action: 'signup_atomic_error'
    });

    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}

function validateSignupData(data: SignupRequest): string | null {
  if (!data.email || !data.name || !data.password || !data.firstName || !data.lastName || !data.phone) {
    return 'Missing required fields';
  }

  if (data.password.length < 6) {
    return 'Password must be at least 6 characters';
  }

  if (!['buyer', 'realtor'].includes(data.role)) {
    return 'Invalid user role';
  }

  // Role-specific validation
  if (data.role === 'buyer') {
    if (!data.preferredCity || !data.preferredState) {
      return 'City and state are required for buyers';
    }
    if (!data.maxMonthlyPayment || data.maxMonthlyPayment <= 0) {
      return 'Valid monthly payment budget is required';
    }
    if (!data.maxDownPayment || data.maxDownPayment < 0) {
      return 'Down payment amount is required';
    }
  } else {
    // Realtor
    if (!data.company) {
      return 'Company name is required for realtors';
    }
    if (!data.primaryCity || !data.primaryState) {
      return 'Primary service city and state are required for realtors';
    }
  }

  return null;
}