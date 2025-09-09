import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Check what properties exist in Dallas metropolitan area
 */
export async function GET() {
  try {
    // Dallas area cities within 30 miles
    const dallasAreaCities = [
      'Dallas', 'Irving', 'Plano', 'Garland', 'Richardson', 'Arlington', 
      'Grand Prairie', 'Mesquite', 'Carrollton', 'Frisco', 'McKinney',
      'Lewisville', 'Allen', 'The Colony', 'Rowlett', 'Wylie'
    ];
    
    const snapshot = await getDocs(collection(db, 'properties'));
    
    const dallasAreaProperties = [];
    const cityCounts = {};
    
    snapshot.docs.forEach(doc => {
      const property = { id: doc.id, ...doc.data() };
      
      if (property.state === 'TX') {
        const city = property.city?.split(',')[0].trim();
        
        // Check if this city is in Dallas metro area
        const isInDallasArea = dallasAreaCities.some(dallasCity => 
          city?.toLowerCase() === dallasCity.toLowerCase()
        );
        
        if (isInDallasArea) {
          dallasAreaProperties.push({
            id: property.id,
            address: property.address,
            city: property.city,
            state: property.state,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            listPrice: property.listPrice,
            monthlyPayment: property.monthlyPayment,
            downPaymentAmount: property.downPaymentAmount,
            isActive: property.isActive
          });
          
          // Count by city
          cityCounts[city] = (cityCounts[city] || 0) + 1;
        }
      }
    });
    
    // Sort properties by monthly payment
    dallasAreaProperties.sort((a, b) => (a.monthlyPayment || 0) - (b.monthlyPayment || 0));
    
    return NextResponse.json({
      totalDallasAreaProperties: dallasAreaProperties.length,
      cityCounts,
      searchedCities: dallasAreaCities,
      properties: dallasAreaProperties.slice(0, 20), // Show first 20
      note: `Found properties in ${Object.keys(cityCounts).length} cities within Dallas metro area`
    });
    
  } catch (error) {
    console.error('Failed to check Dallas area properties:', error);
    return NextResponse.json(
      { error: 'Failed to check Dallas area properties', details: (error as Error).message },
      { status: 500 }
    );
  }
}