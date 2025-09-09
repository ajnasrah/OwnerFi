import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
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
      const snapshot = await getDocs(
        query(collection(db, 'properties'), where('city', '==', cityName))
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
    const allSnapshot = await getDocs(collection(db, 'properties'));
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