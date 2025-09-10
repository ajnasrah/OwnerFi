import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PropertyListing } from '@/lib/property-schema';

export async function GET(request: NextRequest) {
  try {
    const propertiesSnapshot = await getDocs(
      collection(db, 'properties')
    );
    
    const properties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PropertyListing));

    return NextResponse.json({
      total: properties.length,
      properties: properties.slice(0, 10), // Show first 10
      sample: properties.length > 0 ? {
        city: properties[0].city,
        listPrice: properties[0].listPrice,
        bedrooms: properties[0].bedrooms,
        bathrooms: properties[0].bathrooms,
        state: properties[0].state
      } : null
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}