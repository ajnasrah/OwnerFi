import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    // Get all properties to debug
    const allPropertiesSnapshot = await getDocs(collection(db, 'properties'));
    const allProperties = allPropertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Check specific cities
    const cities = ['Dallas', 'Austin', 'Houston', 'Fort Worth', 'San Antonio'];
    const cityCounts = {};
    
    for (const city of cities) {
      const citySnapshot = await getDocs(
        query(collection(db, 'properties'), where('city', '==', city), limit(5))
      );
      cityCounts[city] = citySnapshot.docs.length;
    }

    // Sample properties
    const sampleProperties = allProperties.slice(0, 3).map(p => ({
      id: p.id,
      address: p.address,
      city: p.city,
      state: p.state,
      listPrice: p.listPrice,
      monthlyPayment: p.monthlyPayment,
      downPaymentAmount: p.downPaymentAmount,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms
    }));

    return NextResponse.json({
      totalProperties: allProperties.length,
      cityCounts,
      sampleProperties,
      availableCities: [...new Set(allProperties.map(p => p.city))].sort()
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error.message,
      totalProperties: 0,
      cityCounts: {},
      sampleProperties: []
    });
  }
}