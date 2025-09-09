import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCitiesWithinRadius } from '@/lib/cities';

/**
 * Find cities that have multiple properties to ensure buyers see 3+ options
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const centerCity = searchParams.get('city') || 'Dallas';
    const state = searchParams.get('state') || 'TX';
    const radiusMiles = parseInt(searchParams.get('radius') || '30');
    const minProperties = parseInt(searchParams.get('minProperties') || '3');
    
    console.log(`🌍 ANALYZING: Cities around ${centerCity}, ${state} within ${radiusMiles} miles`);

    // Get all cities within radius
    const nearbyCities = getCitiesWithinRadius(centerCity, state, radiusMiles);
    
    // Get all properties and group by city
    const snapshot = await getDocs(collection(db, 'properties'));
    const propertiesByCity: Record<string, any[]> = {};
    
    snapshot.docs.forEach(doc => {
      const property = { id: doc.id, ...doc.data() };
      
      if (property.isActive === false) return;
      
      const propertyCity = property.city?.split(',')[0].trim();
      const propertyState = property.state;
      
      if (propertyState === state) {
        if (!propertiesByCity[propertyCity]) {
          propertiesByCity[propertyCity] = [];
        }
        propertiesByCity[propertyCity].push({
          id: property.id,
          address: property.address,
          monthlyPayment: property.monthlyPayment,
          downPaymentAmount: property.downPaymentAmount,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms
        });
      }
    });

    // Analyze which cities have sufficient properties
    const cityAnalysis = Object.entries(propertiesByCity)
      .map(([cityName, properties]) => {
        const isNearby = nearbyCities.some(nc => nc.name.toLowerCase() === cityName.toLowerCase());
        const isCenter = cityName.toLowerCase() === centerCity.toLowerCase();
        
        return {
          cityName,
          state,
          propertyCount: properties.length,
          isNearbyCity: isNearby,
          isCenterCity: isCenter,
          distanceCategory: isCenter ? 'center' : isNearby ? 'nearby' : 'distant',
          properties: properties.sort((a, b) => a.monthlyPayment - b.monthlyPayment).slice(0, 5),
          avgMonthlyPayment: Math.round(properties.reduce((sum, p) => sum + p.monthlyPayment, 0) / properties.length)
        };
      })
      .sort((a, b) => b.propertyCount - a.propertyCount);

    // Cities that meet the minimum property requirement
    const qualifyingCities = cityAnalysis.filter(city => city.propertyCount >= minProperties);
    
    // Cities within radius specifically  
    const nearbyCitiesWithProperties = cityAnalysis.filter(city => 
      (city.isNearbyCity || city.isCenterCity) && city.propertyCount > 0
    );

    return NextResponse.json({
      analysis: {
        centerCity,
        state,
        radiusMiles,
        minPropertiesRequired: minProperties
      },
      results: {
        totalCitiesInState: cityAnalysis.length,
        citiesWithinRadius: nearbyCities.length,
        citiesWithAnyProperties: cityAnalysis.filter(c => c.propertyCount > 0).length,
        citiesWithMinProperties: qualifyingCities.length
      },
      qualifyingCities: qualifyingCities.slice(0, 10),
      nearbyCitiesWithProperties: nearbyCitiesWithProperties.slice(0, 20),
      allCitiesByPropertyCount: cityAnalysis.slice(0, 15),
      recommendation: {
        bestCityForBuyers: qualifyingCities.length > 0 ? qualifyingCities[0].cityName : 'None found',
        shouldExpandRadius: qualifyingCities.length < 3,
        alternativeCities: nearbyCitiesWithProperties.filter(c => c.propertyCount >= Math.max(1, minProperties - 1)).slice(0, 5)
      }
    });

  } catch (error) {
    console.error('🚨 City analysis error:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze cities',
      details: (error as Error).message
    }, { status: 500 });
  }
}