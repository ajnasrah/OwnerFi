import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { expandSearchToNearbyCitiesAPI } from '@/lib/property-enhancement';

/**
 * Test Dallas area search using nearby cities functionality
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxMonthlyPayment = parseFloat(searchParams.get('maxMonthlyPayment') || '2000');
    const maxDownPayment = parseFloat(searchParams.get('maxDownPayment') || '40000');
    
    // Get all cities within 30-mile radius of Dallas
    const searchCities = await expandSearchToNearbyCitiesAPI('Dallas', 'TX', 30);
    
    console.log(`🔍 DALLAS AREA SEARCH: Searching in ${searchCities.length} cities`);
    console.log(`Cities: ${searchCities.slice(0, 10).join(', ')}...`);

    // Get all properties and filter
    const snapshot = await getDocs(collection(db, 'properties'));
    
    const properties = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(property => {
        // Check if property city is in our Dallas area cities list
        const propertyCity = property.city?.split(',')[0].trim();
        const cityMatch = searchCities.some(searchCity => 
          propertyCity?.toLowerCase() === searchCity.toLowerCase()
        );
        
        if (!cityMatch) return false;
        
        // Budget filtering
        const monthlyMatch = property.monthlyPayment <= maxMonthlyPayment;
        const downMatch = property.downPaymentAmount <= maxDownPayment;
        const activeMatch = property.isActive !== false;
        
        console.log(`🏠 ${propertyCity}: Monthly ${property.monthlyPayment} <= ${maxMonthlyPayment}? ${monthlyMatch}, Down ${property.downPaymentAmount} <= ${maxDownPayment}? ${downMatch}, Active? ${activeMatch}`);
        
        return monthlyMatch && downMatch && activeMatch;
      })
      .sort((a, b) => a.monthlyPayment - b.monthlyPayment);

    console.log(`✅ FOUND ${properties.length} properties in Dallas metro area`);

    // Return detailed results
    const results = properties.map(property => ({
      id: property.id,
      address: property.address,
      city: property.city,
      state: property.state,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      listPrice: property.listPrice,
      monthlyPayment: property.monthlyPayment,
      downPaymentAmount: property.downPaymentAmount,
      description: property.description
    }));

    return NextResponse.json({
      searchType: 'Dallas Metro Area (30-mile radius)',
      searchCriteria: {
        maxMonthlyPayment,
        maxDownPayment
      },
      searchCities: searchCities.slice(0, 10), // Show first 10 cities
      totalCitiesSearched: searchCities.length,
      totalFound: results.length,
      properties: results,
      message: `Found ${results.length} properties naturally in Dallas metro area`
    });

  } catch (error) {
    console.error('🚨 Dallas area search error:', error);
    return NextResponse.json({ 
      error: 'Failed to search Dallas area',
      details: (error as Error).message
    }, { status: 500 });
  }
}