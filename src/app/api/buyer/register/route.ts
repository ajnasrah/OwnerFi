import { NextRequest, NextResponse } from 'next/server';
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firestoreHelpers } from '@/lib/firestore';
import { logError, logInfo } from '@/lib/logger';
import { validateBuyerRegistration } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = validateBuyerRegistration(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }
    
    const {
      firstName,
      lastName,
      email,
      phone,
      minPrice,
      maxPrice,
      minBedrooms,
      minBathrooms,
      minSquareFeet,
      preferredCity,
      preferredState,
      searchRadius,
      maxDownPayment,
      maxMonthlyPayment
    } = body;

    // Check if user already exists
    const existingUsersQuery = query(
      collection(db, 'users'),
      where('email', '==', email)
    );
    const existingUsers = await getDocs(existingUsersQuery);
    
    if (!existingUsers.empty) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Create user
    const userId = firestoreHelpers.generateId();
    await setDoc(doc(db, 'users', userId), {
      id: userId,
      email,
      role: 'buyer',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Create buyer profile
    const buyerId = firestoreHelpers.generateId();
    await setDoc(doc(db, 'buyerProfiles', buyerId), {
      id: buyerId,
      userId,
      firstName,
      lastName,
      email,
      phone,
      maxMonthlyPayment: maxMonthlyPayment || maxPrice * 0.01, // Estimate if not provided
      maxDownPayment,
      preferredCity,
      preferredState,
      searchRadius: searchRadius || 25,
      minBedrooms: minBedrooms || 1,
      minBathrooms: minBathrooms || 1,
      minPrice: minPrice || 0,
      maxPrice: maxPrice || 0,
      minSquareFeet: minSquareFeet || 0,
      profileComplete: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await logInfo('Buyer registration completed', {
      action: 'buyer_register',
      metadata: {
        userId,
        buyerId,
        preferredCity,
        preferredState,
        maxPrice
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Registration successful',
      userId,
      buyerId
    });

  } catch (error) {
    await logError('Buyer registration failed', error, {
      action: 'buyer_register_error'
    });

    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}