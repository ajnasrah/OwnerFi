import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Test reverse lookup: Find properties that have "Miami" in their nearbyCities field
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchCity = searchParams.get('city') || 'Miami';
    const searchState = searchParams.get('state') || 'FL';
    
    console.log(`🔍 REVERSE LOOKUP TEST: Finding properties that consider "${searchCity}" as nearby`);
    
    // Get all properties
    const snapshot = await getDocs(collection(db, 'properties'));
    const allProperties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Find properties that have searchCity in their nearbyCities array
    const propertiesWithCityAsNearby = allProperties.filter(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      
      // Skip if it's the same city (we want different cities that consider this city nearby)
      if (propertyCity?.toLowerCase() === searchCity.toLowerCase()) return false;
      
      // Check if this property has searchCity in its nearbyCities array
      return property.nearbyCities && 
             Array.isArray(property.nearbyCities) &&
             property.nearbyCities.some((nearbyCity: string) => 
               nearbyCity.toLowerCase() === searchCity.toLowerCase()
             ) &&
             property.state === searchState; // CRITICAL: Must be same state
    });
    
    console.log(`📊 Found ${propertiesWithCityAsNearby.length} properties that consider ${searchCity} as nearby`);
    
    // Group by the property's actual city
    const propertiesByActualCity: Record<string, Record<string, unknown>[]> = {};
    propertiesWithCityAsNearby.forEach(property => {
      const actualCity = property.city?.split(',')[0].trim();
      if (!propertiesByActualCity[actualCity]) {
        propertiesByActualCity[actualCity] = [];
      }
      propertiesByActualCity[actualCity].push(property);
    });
    
    const citiesThatConsiderTargetNearby = Object.entries(propertiesByActualCity)
      .map(([cityName, properties]) => ({
        cityName,
        propertyCount: properties.length,
        sampleProperties: properties.slice(0, 3).map(p => ({
          id: p.id,
          address: p.address,
          monthlyPayment: p.monthlyPayment,
          downPaymentAmount: p.downPaymentAmount
        }))
      }))
      .sort((a, b) => b.propertyCount - a.propertyCount);
    
    return NextResponse.json({
      reverseSearch: {
        searchedFor: `${searchCity}, ${searchState}`,
        concept: 'Find properties that consider this city as nearby'
      },
      results: {
        totalPropertiesConsideringCityNearby: propertiesWithCityAsNearby.length,
        totalCitiesWithProperties: Object.keys(propertiesByActualCity).length,
        citiesThatConsiderTargetNearby
      },
      sampleProperties: propertiesWithCityAsNearby.slice(0, 10).map(property => ({
        id: property.id,
        address: property.address,
        actualCity: property.city?.split(',')[0].trim(),
        state: property.state,
        monthlyPayment: property.monthlyPayment,
        downPaymentAmount: property.downPaymentAmount,
        hasTargetCityInNearby: property.nearbyCities?.includes(searchCity),
        nearbyCitiesCount: property.nearbyCities?.length || 0,
        wouldShowAsNearby: true
      })),
      reverseLookupFunctionality: {
        supported: propertiesWithCityAsNearby.length > 0,
        dataStructureReady: true,
        reverseLookupQuery: `Find properties where nearbyCities array contains "${searchCity}"`,
        recommendation: propertiesWithCityAsNearby.length > 0
          ? 'System ready - can show nearby properties with tags'
          : 'Need more property data for nearby results'
      }
    });
    
  } catch (error) {
    console.error('Reverse lookup test error:', error);
    return NextResponse.json({ 
      error: 'Reverse lookup test failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}