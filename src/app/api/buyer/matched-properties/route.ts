import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mockBuyers } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || 'Memphis';
    const radius = parseInt(searchParams.get('radius') || '25');
    const maxMonthly = searchParams.get('maxMonthly') ? parseInt(searchParams.get('maxMonthly')!) : null;
    const maxDown = searchParams.get('maxDown') ? parseInt(searchParams.get('maxDown')!) : null;
    const minBedrooms = searchParams.get('minBedrooms') ? parseInt(searchParams.get('minBedrooms')!) : null;
    const minBathrooms = searchParams.get('minBathrooms') ? parseInt(searchParams.get('minBathrooms')!) : null;
    
    // Simple filtering based on city for now
    // In real app, would use lat/lng distance calculations
    const cityMapping: { [key: string]: string[] } = {
      'Memphis': ['Memphis', 'Southaven', 'West Memphis', 'Forest City', 'Collierville'],
      'Nashville': ['Nashville', 'Franklin', 'Murfreesboro', 'Hendersonville'],
      'Jackson': ['Jackson'],
      'Atlanta': ['Atlanta'],
      'Houston': ['Houston'],
      'Tampa': ['Tampa']
    };
    
    // Fetch properties from Firebase
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('status', '==', 'active')
    );
    
    const propertiesSnapshot = await getDocs(propertiesQuery);
    const allProperties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const allowedCities = cityMapping[city] || [city];
    let filteredProperties = allProperties.filter((property: any) => {
      // City filter
      if (!allowedCities.includes(property.city)) return false;
      
      // Budget filters - properties must be WITHIN user's budget
      if (maxMonthly && property.monthlyPayment > maxMonthly) return false;
      if (maxDown && property.downPaymentAmount > maxDown) return false;
      
      // Bedroom filter - property must have AT LEAST this many bedrooms
      if (minBedrooms && property.bedrooms < minBedrooms) return false;
      
      // Bathroom filter - property must have AT LEAST this many bathrooms  
      if (minBathrooms && property.bathrooms < minBathrooms) return false;
      
      return true;
    });
    
    // If no properties match all criteria, show city matches only (ignore budget/bed/bath filters)
    if (filteredProperties.length === 0) {
      console.log(`No properties match all criteria for ${city}, showing city matches only`);
      filteredProperties = allProperties.filter((property: any) => 
        allowedCities.includes(property.city)
      );
      
      // If still no matches, show all as ultimate fallback
      if (filteredProperties.length === 0) {
        console.log(`No properties found for ${city}, showing all properties as fallback`);
        filteredProperties = allProperties;
      }
    }
    
    return NextResponse.json({
      properties: filteredProperties,
      summary: {
        totalMatches: filteredProperties.length,
        searchCenter: `${city}, TN`,
        searchRadius: radius,
      }
    });

  } catch (error) {
    console.error('Failed to fetch matched properties:', error);

    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}