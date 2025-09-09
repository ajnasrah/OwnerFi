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
 * Add 3 more Dallas properties to make exactly 4 total for testing
 */
export async function POST() {
  try {
    const dallasProperties = [
      {
        id: `dallas-test-1-${Date.now()}`,
        address: '1234 Oak Street',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201',
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1800,
        listPrice: 285000,
        downPaymentAmount: 28500,
        monthlyPayment: 1450,
        interestRate: 7.0,
        termYears: 20,
        description: 'Beautiful 3BR/2BA home in Dallas',
        photos: [],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      {
        id: `dallas-test-2-${Date.now()}`,
        address: '5678 Elm Avenue',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75202',
        bedrooms: 4,
        bathrooms: 3,
        squareFeet: 2200,
        listPrice: 350000,
        downPaymentAmount: 35000,
        monthlyPayment: 1800,
        interestRate: 7.0,
        termYears: 20,
        description: 'Spacious 4BR/3BA family home in Dallas',
        photos: [],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      {
        id: `dallas-test-3-${Date.now()}`,
        address: '9012 Maple Drive',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75203',
        bedrooms: 3,
        bathrooms: 2.5,
        squareFeet: 1650,
        listPrice: 295000,
        downPaymentAmount: 29500,
        monthlyPayment: 1520,
        interestRate: 7.0,
        termYears: 20,
        description: 'Charming 3BR/2.5BA home in Dallas',
        photos: [],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    ];
    
    const createdProperties = [];
    
    for (const property of dallasProperties) {
      await setDoc(doc(db, 'properties', property.id), property);
      createdProperties.push({
        id: property.id,
        address: property.address,
        monthlyPayment: property.monthlyPayment,
        downPaymentAmount: property.downPaymentAmount,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Added ${createdProperties.length} Dallas properties`,
      properties: createdProperties,
      note: 'With existing Dallas property, total should now be 4 properties'
    });
    
  } catch (error) {
    console.error('Failed to add Dallas properties:', error);
    return NextResponse.json(
      { error: 'Failed to add Dallas properties', details: (error as Error).message },
      { status: 500 }
    );
  }
}