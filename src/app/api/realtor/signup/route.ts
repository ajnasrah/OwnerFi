// SINGLE REALTOR SIGNUP API - Everything in one endpoint
// Creates user account + validates city + finds nearby cities + saves to Firebase

import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { FirebaseDB } from '@/lib/firebase-db';
import { 
  RealtorRegistrationRequest, 
  RealtorRegistrationResponse,
  RealtorDataHelper,
  isValidEmail,
  isValidPhone,
  formatPhone
} from '@/lib/realtor-models';
import { Timestamp } from 'firebase/firestore';
import { logInfo, logError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RealtorRegistrationRequest;
    
    // Validate required fields
    const validation = validateRealtorRegistration(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { 
      firstName, 
      lastName, 
      phone, 
      email, 
      password, 
      primaryCityQuery,
      company,
      licenseNumber 
    } = body;

    // Check if user already exists
    const existingUser = await FirebaseDB.findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Check if city setup is required
    const requiresSetup = primaryCityQuery === 'Setup Required';
    
    let serviceArea;
    if (requiresSetup) {
      // Create placeholder service area that requires setup
      serviceArea = {
        primaryCity: {
          name: 'Setup Required',
          state: 'Setup Required',
          stateCode: 'XX',
          placeId: 'setup-required',
          coordinates: { lat: 0, lng: 0 },
          formattedAddress: 'Setup Required'
        },
        nearbyCities: [],
        radiusMiles: 30,
        totalCitiesServed: 0,
        lastUpdated: Timestamp.now(),
        // setupRequired: true
      };
    } else {
      // Parse city manually (for existing functionality)
      const cityParts = primaryCityQuery.split(',');
      const cityName = cityParts[0]?.trim() || primaryCityQuery;
      const statePart = cityParts[1]?.trim();
      
      if (!cityName || !statePart) {
        return NextResponse.json(
          { error: 'Please provide both city and state in the format: City, State' },
          { status: 400 }
        );
      }
      
      serviceArea = {
        primaryCity: {
          name: cityName,
          state: statePart,
          stateCode: statePart.length === 2 ? statePart : statePart.substring(0, 2).toUpperCase(),
          placeId: 'manual-' + Date.now(),
          coordinates: { lat: 0, lng: 0 },
          formattedAddress: `${cityName}, ${statePart}, USA`
        },
        nearbyCities: [],
        radiusMiles: 30,
        totalCitiesServed: 1,
        lastUpdated: Timestamp.now()
      };
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create realtor data structure
    const realtorData = RealtorDataHelper.createRealtorData(
      firstName,
      lastName,
      formatPhone(phone),
      email,
      serviceArea,
      company,
      licenseNumber
    );

    // Create user using existing auth system
    const user = await FirebaseDB.createUser({
      email,
      name: `${firstName} ${lastName}`,
      role: 'realtor',
      password: hashedPassword
    });

    // Update user document with phone and embedded realtor data
    await FirebaseDB.updateDocument('users', user.id, {
      phone: formatPhone(phone),
      realtorData,
      updatedAt: Timestamp.now()
    });

    // Log successful registration
    await logInfo('Realtor registered successfully', {
      action: 'realtor_registration',
      userId: user.id,
      metadata: {
        email,
        primaryCity: serviceArea.primaryCity.name,
        nearbyCitiesCount: serviceArea.nearbyCities.length,
        totalCitiesServed: serviceArea.totalCitiesServed
      }
    });

    const response: RealtorRegistrationResponse = {
      success: true,
      userId: user.id,
      realtorData,
      serviceArea
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    // Registration error
    await logError('Realtor registration failed', {
      action: 'realtor_registration_error'
    }, error as Error);

    return NextResponse.json(
      { 
        error: 'Registration failed. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Comprehensive validation for realtor registration
function validateRealtorRegistration(data: unknown): { isValid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Invalid request data' };
  }

  const dataRecord = data as Record<string, unknown>;

  // Required fields
  const required = ['firstName', 'lastName', 'phone', 'email', 'password', 'primaryCityQuery'];
  for (const field of required) {
    if (!dataRecord[field] || typeof dataRecord[field] !== 'string' || (dataRecord[field] as string).trim().length === 0) {
      return { isValid: false, error: `${field} is required` };
    }
  }

  // Validate email
  if (!isValidEmail(dataRecord.email as string)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  // Validate phone
  if (!isValidPhone(dataRecord.phone as string)) {
    return { isValid: false, error: 'Please enter a valid phone number' };
  }

  // Validate password
  if ((dataRecord.password as string).length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters long' };
  }

  // Validate name lengths
  if ((dataRecord.firstName as string).length > 50 || (dataRecord.lastName as string).length > 50) {
    return { isValid: false, error: 'Names must be less than 50 characters' };
  }

  // Validate optional fields if provided
  if (dataRecord.company && (dataRecord.company as string).length > 100) {
    return { isValid: false, error: 'Company name must be less than 100 characters' };
  }

  if (dataRecord.licenseNumber && (dataRecord.licenseNumber as string).length > 50) {
    return { isValid: false, error: 'License number must be less than 50 characters' };
  }

  return { isValid: true };
}