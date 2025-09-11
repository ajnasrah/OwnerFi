import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCitiesWithinRadius } from '@/lib/cities';
import { PropertyListing } from "@/lib/property-schema";

/**
 * BUYER NEARBY PROPERTIES API
 * 
 * Shows buyers what properties are available in cities AROUND their search city
 * This helps buyers discover options in surrounding areas they might not have considered
 */

export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const centerCity = searchParams.get('city');
    const state = searchParams.get('state'); 
    const maxMonthlyPayment = parseFloat(searchParams.get('maxMonthlyPayment') || '5000');
    const maxDownPayment = parseFloat(searchParams.get('maxDownPayment') || '100000');
    const radiusMiles = parseInt(searchParams.get('radius') || '30');
    const minProperties = parseInt(searchParams.get('minProperties') || '3');
    
    if (!centerCity || !state) {
      return NextResponse.json({ 
        error: 'Missing required parameters: city, state' 
      }, { status: 400 });
    }


    // Get all cities within radius using existing fast database
    const nearbyCities = getCitiesWithinRadius(centerCity, state, radiusMiles);
    

    // Get all properties and group by city
    const snapshot = await getDocs(collection(db, 'properties'));
    const propertiesByCity: Record<string, PropertyListing[]> = {};
    
    snapshot.docs.forEach(doc => {
      const property = { id: doc.id, ...doc.data() } as PropertyListing & { id: string };
      
      if (property.isActive === false) return;
      
      const propertyCity = property.city?.split(',')[0].trim();
      const propertyState = property.state;
      
      // Check if this property is in one of our nearby cities
      const isInNearbyCity = nearbyCities.some(nearbyCity => 
        propertyCity?.toLowerCase() === nearbyCity.name.toLowerCase() &&
        propertyState === nearbyCity.state
      );
      
      if (isInNearbyCity) {
        // Filter by budget
        const monthlyMatch = property.monthlyPayment <= maxMonthlyPayment;
        const downMatch = property.downPaymentAmount <= maxDownPayment;
        
        if (monthlyMatch && downMatch) {
          if (!propertiesByCity[propertyCity]) {
            propertiesByCity[propertyCity] = [];
          }
          propertiesByCity[propertyCity].push(property);
        }
      }
    });

    // Filter cities that have at least minProperties (default 3)
    const citiesWithSufficientProperties = Object.entries(propertiesByCity)
      .filter(([cityName, properties]) => properties.length >= minProperties)
      .map(([cityName, properties]) => ({
        cityName,
        state: properties[0]?.state || state,
        propertyCount: properties.length,
        properties: properties
          .sort((a, b) => a.monthlyPayment - b.monthlyPayment) // Sort by affordability
          .slice(0, 10), // Limit to 10 properties per city for response size
        avgMonthlyPayment: Math.round(properties.reduce((sum, p) => sum + p.monthlyPayment, 0) / properties.length),
        avgDownPayment: Math.round(properties.reduce((sum, p) => sum + p.downPaymentAmount, 0) / properties.length)
      }))
      .sort((a, b) => b.propertyCount - a.propertyCount); // Cities with most properties first

    
    // Also include cities with fewer properties for context
    const citiesWithFewProperties = Object.entries(propertiesByCity)
      .filter(([cityName, properties]) => properties.length > 0 && properties.length < minProperties)
      .map(([cityName, properties]) => ({
        cityName,
        state: properties[0]?.state || state,
        propertyCount: properties.length,
        properties: properties.slice(0, 3), // Show all for smaller lists
        avgMonthlyPayment: Math.round(properties.reduce((sum, p) => sum + p.monthlyPayment, 0) / properties.length),
        avgDownPayment: Math.round(properties.reduce((sum, p) => sum + p.downPaymentAmount, 0) / properties.length)
      }))
      .sort((a, b) => b.propertyCount - a.propertyCount);

    return NextResponse.json({
      searchCenter: {
        city: centerCity,
        state: state,
        radius: radiusMiles
      },
      searchCriteria: {
        maxMonthlyPayment,
        maxDownPayment,
        minPropertiesPerCity: minProperties
      },
      totalCitiesSearched: nearbyCities.length,
      citiesWithSufficientProperties: {
        count: citiesWithSufficientProperties.length,
        cities: citiesWithSufficientProperties
      },
      citiesWithFewProperties: {
        count: citiesWithFewProperties.length,
        cities: citiesWithFewProperties
      },
      summary: {
        totalCitiesWithProperties: citiesWithSufficientProperties.length + citiesWithFewProperties.length,
        totalProperties: Object.values(propertiesByCity).flat().length,
        recommendation: citiesWithSufficientProperties.length > 0 
          ? `Consider expanding your search to include ${citiesWithSufficientProperties.map(c => c.cityName).slice(0, 3).join(', ')}`
          : 'Try increasing your budget or expanding your search radius'
      }
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to search nearby properties',
      details: (error as Error).message
    }, { status: 500 });
  }
}