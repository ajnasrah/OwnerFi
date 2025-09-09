import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCitiesWithinRadius } from '@/lib/cities';

/**
 * Test Atlanta buyer scenario - should see 3+ properties in surrounding areas
 */
export async function GET() {
  try {
    // Atlanta buyer search criteria
    const buyerCriteria = {
      centerCity: 'Atlanta',
      state: 'GA',
      maxMonthlyPayment: 2000,  // High enough to capture all Atlanta properties
      maxDownPayment: 30000,   // High enough to capture all Atlanta properties
      radiusMiles: 30
    };

    console.log(`🏠 ATLANTA BUYER TEST: Searching ${buyerCriteria.centerCity} + surrounding areas`);

    // Get cities within 30 miles of Atlanta
    const nearbyCities = getCitiesWithinRadius(buyerCriteria.centerCity, buyerCriteria.state, buyerCriteria.radiusMiles);
    const searchCities = [buyerCriteria.centerCity, ...nearbyCities.map(c => c.name)];
    
    console.log(`📍 Searching in cities: ${searchCities.join(', ')}`);

    // Get all properties and filter
    const snapshot = await getDocs(collection(db, 'properties'));
    
    const matchingProperties = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(property => {
        if (property.isActive === false) return false;
        if (property.state !== buyerCriteria.state) return false;
        
        const propertyCity = property.city?.split(',')[0].trim();
        const cityMatch = searchCities.some(searchCity => 
          propertyCity?.toLowerCase() === searchCity.toLowerCase()
        );
        
        if (!cityMatch) return false;
        
        const monthlyMatch = property.monthlyPayment <= buyerCriteria.maxMonthlyPayment;
        const downMatch = property.downPaymentAmount <= buyerCriteria.maxDownPayment;
        
        console.log(`🏠 ${propertyCity}: $${property.monthlyPayment}/$${property.downPaymentAmount} - Match: ${monthlyMatch && downMatch}`);
        
        return monthlyMatch && downMatch;
      })
      .sort((a, b) => a.monthlyPayment - b.monthlyPayment);

    // Group by city for display
    const propertiesByCity: Record<string, any[]> = {};
    matchingProperties.forEach(property => {
      const city = property.city?.split(',')[0].trim();
      if (!propertiesByCity[city]) {
        propertiesByCity[city] = [];
      }
      propertiesByCity[city].push({
        id: property.id,
        address: property.address,
        monthlyPayment: property.monthlyPayment,
        downPaymentAmount: property.downPaymentAmount,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms
      });
    });

    const citiesWithProperties = Object.entries(propertiesByCity).map(([cityName, properties]) => ({
      cityName,
      propertyCount: properties.length,
      properties
    }));

    const totalProperties = matchingProperties.length;
    const meetsRequirement = totalProperties >= 3;

    return NextResponse.json({
      buyerProfile: {
        name: 'Atlanta Test Buyer',
        searchCity: buyerCriteria.centerCity,
        state: buyerCriteria.state,
        budget: `$${buyerCriteria.maxMonthlyPayment}/month, $${buyerCriteria.maxDownPayment} down`,
        searchRadius: buyerCriteria.radiusMiles
      },
      searchResults: {
        totalCitiesSearched: searchCities.length,
        totalPropertiesFound: totalProperties,
        meetsRequirement: meetsRequirement,
        requirementText: 'Should see at least 3 properties in surrounding areas'
      },
      citiesWithProperties,
      allMatchingProperties: matchingProperties,
      verdict: meetsRequirement 
        ? `✅ SUCCESS! Buyer sees ${totalProperties} properties in surrounding areas`
        : `❌ FAIL: Only ${totalProperties} properties found, need at least 3`
    });

  } catch (error) {
    console.error('🚨 Atlanta buyer test error:', error);
    return NextResponse.json({ 
      error: 'Atlanta buyer test failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}