import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
export async function GET() {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // Check for Dallas properties with different variations
    const dallasVariations = [
      'Dallas',
      'Dallas, TX', 
      'dallas',
      'DALLAS',
      'Dallas TX'
    ];

    const results = {};
    
    for (const cityName of dallasVariations) {
      const snapshot = await 
        query(adminDb.collection('properties'.get(), where('city', '==', cityName))
      );
      
      if (snapshot.docs.length > 0) {
        results[cityName] = snapshot.docs.map(doc => ({
          id: doc.id,
          address: doc.data().address,
          city: doc.data().city,
          state: doc.data().state,
          monthlyPayment: doc.data().monthlyPayment,
          downPaymentAmount: doc.data().downPaymentAmount,
          listPrice: doc.data().listPrice
        }));
      }
    }

    // Also check for properties that contain "Dallas" 
    const allSnapshot = await adminDb.collection('properties').get();
    const dallasLike = allSnapshot.docs
      .filter(doc => doc.data().city?.toLowerCase().includes('dallas'))
      .map(doc => ({
        id: doc.id,
        address: doc.data().address,
        city: doc.data().city,
        state: doc.data().state,
        monthlyPayment: doc.data().monthlyPayment,
        downPaymentAmount: doc.data().downPaymentAmount
      }));

    return NextResponse.json({
      exactMatches: results,
      dallasLikeProperties: dallasLike,
      totalPropertiesInDB: allSnapshot.docs.length
    });
  } catch (error) {
    return NextResponse.json({ error: error.message });
  }
}