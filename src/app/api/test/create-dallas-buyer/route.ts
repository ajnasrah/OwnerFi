import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Create a Dallas buyer for testing the "4 properties" scenario
 */
export async function POST() {
  try {
    // Create user first
    const userId = `dallas-test-user-${Date.now()}`;
    const buyerId = `dallas-test-buyer-${Date.now()}`;
    
    const user = {
      id: userId,
      email: `dallas.buyer.${Date.now()}@test.com`,
      name: 'Dallas Test Buyer',
      role: 'buyer',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'users', userId), user);
    
    // Create buyer profile with Dallas search criteria  
    // Set criteria to find exactly 4 properties
    const buyer = {
      id: buyerId,
      userId: userId,
      firstName: 'Dallas',
      lastName: 'TestBuyer',
      email: user.email,
      phone: '214-555-0123',
      preferredCity: 'Dallas',
      preferredState: 'TX',
      searchRadius: 25,
      maxMonthlyPayment: 2000,  // High enough to capture all Dallas properties
      maxDownPayment: 40000,    // High enough to capture all Dallas properties  
      minBedrooms: 3,           // Most Dallas properties should have 3+ bedrooms
      minBathrooms: 2,          // Most Dallas properties should have 2+ bathrooms
      languages: ['English'],
      emailNotifications: true,
      smsNotifications: false,
      profileComplete: true,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'buyerProfiles', buyerId), buyer);
    
    return NextResponse.json({
      success: true,
      message: 'Dallas test buyer created successfully',
      buyer: {
        id: buyerId,
        name: `${buyer.firstName} ${buyer.lastName}`,
        email: buyer.email,
        phone: buyer.phone,
        location: `${buyer.preferredCity}, ${buyer.preferredState}`,
        budget: `$${buyer.maxMonthlyPayment}/month, $${buyer.maxDownPayment} down`,
        preferences: `${buyer.minBedrooms}+ bedrooms, ${buyer.minBathrooms}+ bathrooms`
      }
    });
    
  } catch (error) {
    console.error('Failed to create Dallas buyer:', error);
    return NextResponse.json(
      { error: 'Failed to create Dallas buyer', details: (error as Error).message },
      { status: 500 }
    );
  }
}