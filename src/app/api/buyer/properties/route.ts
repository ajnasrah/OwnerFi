import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * BUYER PROPERTY API WITH NEARBY CITIES
 * 
 * Shows properties that match buyer's simple criteria:
 * 1. DIRECT: Properties in the exact search city
 * 2. NEARBY: Properties from nearby cities (within 30 miles) 
 * 3. Budget filters: Monthly payment <= budget, Down payment <= budget
 * 
 * Uses pre-computed nearbyCities data for fast nearby property discovery.
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get buyer's search criteria from URL params
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const maxMonthlyPayment = searchParams.get('maxMonthlyPayment');
    const maxDownPayment = searchParams.get('maxDownPayment');
    const pageSize = parseInt(searchParams.get('limit') || '20');
    
    if (!city || !state || !maxMonthlyPayment || !maxDownPayment) {
      return NextResponse.json({ 
        error: 'Missing required parameters: city, state, maxMonthlyPayment, maxDownPayment' 
      }, { status: 400 });
    }

    const maxMonthly = Number(maxMonthlyPayment);
    const maxDown = Number(maxDownPayment);
    const searchCity = city.split(',')[0].trim();
    const searchState = state;

    console.log(`🔍 BUYER SEARCH WITH NEARBY: ${searchCity}, Monthly: $${maxMonthly}, Down: $${maxDown}`);

    // Get ALL properties
    const snapshot = await getDocs(collection(db, 'properties'));
    const allProperties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
    
    // 1. DIRECT MATCHES: Properties IN the search city AND state
    const directProperties = allProperties.filter(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      return propertyCity?.toLowerCase() === searchCity.toLowerCase() && 
             property.state === searchState &&
             property.isActive !== false &&
             property.monthlyPayment <= maxMonthly &&
             property.downPaymentAmount <= maxDown;
    });
    
    // 2. NEARBY MATCHES: Properties FROM other cities IN SAME STATE that consider search city nearby
    const nearbyProperties = allProperties.filter(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      
      // Must be different city but SAME STATE
      if (propertyCity?.toLowerCase() === searchCity.toLowerCase()) return false;
      if (property.state !== searchState) return false;
      
      // Must have search city in nearbyCities array
      const considersSearchCityNearby = property.nearbyCities && 
        Array.isArray(property.nearbyCities) &&
        property.nearbyCities.some((nearbyCity: string) => 
          nearbyCity.toLowerCase() === searchCity.toLowerCase()
        );
      
      return considersSearchCityNearby &&
             property.isActive !== false &&
             property.monthlyPayment <= maxMonthly &&
             property.downPaymentAmount <= maxDown;
    });

    // 3. COMBINE AND FORMAT FOR BUYER DASHBOARD
    const allResults = [
      // Direct properties (no tag)
      ...directProperties.map(property => ({
        ...property,
        resultType: 'direct',
        displayTag: null,
        sortOrder: 1,
        matchReason: `Located in ${searchCity}`
      })),
      
      // Nearby properties (with "Nearby" tag)
      ...nearbyProperties.map(property => ({
        ...property,
        resultType: 'nearby', 
        displayTag: 'Nearby',
        sortOrder: 2,
        matchReason: `Near ${searchCity} (in ${property.city?.split(',')[0].trim()})`
      }))
    ]
    .sort((a, b) => {
      // First sort by type (direct vs nearby), then by monthly payment
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.monthlyPayment - b.monthlyPayment;
    })
    .slice(0, pageSize);

    console.log(`✅ FOUND ${directProperties.length} direct + ${nearbyProperties.length} nearby = ${allResults.length} total properties`);

    return NextResponse.json({
      properties: allResults,
      total: allResults.length,
      breakdown: {
        direct: directProperties.length,
        nearby: nearbyProperties.length
      },
      searchCriteria: {
        city: searchCity,
        maxMonthlyPayment: maxMonthly,
        maxDownPayment: maxDown
      }
    });

  } catch (error) {
    console.error('🚨 Buyer properties error:', error);
    return NextResponse.json({ 
      error: 'Failed to load properties',
      properties: [],
      total: 0 
    }, { status: 500 });
  }
}