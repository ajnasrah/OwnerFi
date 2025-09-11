import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PropertyListing } from '@/lib/property-schema';

/**
 * PROPERTY SEARCH WITH NEARBY FUNCTIONALITY
 * 
 * When user searches "Miami" → Shows:
 * 1. Miami properties (normal)
 * 2. Properties from nearby cities with "Nearby" tag
 */
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const searchCity = searchParams.get('city');
    const searchState = searchParams.get('state');
    const maxMonthlyPayment = parseFloat(searchParams.get('maxMonthlyPayment') || '5000');
    const maxDownPayment = parseFloat(searchParams.get('maxDownPayment') || '100000');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    if (!searchCity || !searchState) {
      return NextResponse.json({ 
        error: 'Missing required parameters: city, state' 
      }, { status: 400 });
    }


    // Get all properties
    const snapshot = await getDocs(collection(db, 'properties'));
    const allProperties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PropertyListing));
    
    // 1. DIRECT MATCHES: Properties IN the search city
    const directProperties = allProperties.filter(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      return propertyCity?.toLowerCase() === searchCity.toLowerCase() && 
             property.state === searchState &&
             property.isActive !== false &&
             property.monthlyPayment <= maxMonthlyPayment &&
             property.downPaymentAmount <= maxDownPayment;
    });
    
    // 2. NEARBY MATCHES: Properties FROM other cities that consider search city nearby
    const nearbyProperties = allProperties.filter(property => {
      const propertyCity = property.city?.split(',')[0].trim();
      
      // Must be different city
      if (propertyCity?.toLowerCase() === searchCity.toLowerCase()) return false;
      
      // Must have search city in nearbyCities array
      const considersSearchCityNearby = property.nearbyCities && 
        Array.isArray(property.nearbyCities) &&
        property.nearbyCities.some((nearbyCity: string) => 
          nearbyCity.toLowerCase() === searchCity.toLowerCase()
        );
      
      return considersSearchCityNearby &&
             property.state === searchState &&
             property.isActive !== false &&
             property.monthlyPayment <= maxMonthlyPayment &&
             property.downPaymentAmount <= maxDownPayment;
    });

    // 3. COMBINE AND FORMAT FOR DASHBOARD
    const dashboardResults = [
      // Direct properties (no tag)
      ...directProperties.map(property => ({
        ...property,
        resultType: 'direct',
        displayTag: null,
        tagColor: null,
        sortOrder: 1, // Show direct matches first
        matchExplanation: `Located in ${searchCity}`
      })),
      
      // Nearby properties (with "Nearby" tag)
      ...nearbyProperties.map(property => ({
        ...property,
        resultType: 'nearby',
        displayTag: 'Nearby',
        tagColor: 'blue', // For UI styling
        sortOrder: 2, // Show nearby matches second
        matchExplanation: `Near ${searchCity} (in ${property.city?.split(',')[0].trim()})`
      }))
    ]
    .sort((a, b) => {
      // First sort by type (direct vs nearby), then by monthly payment
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.monthlyPayment - b.monthlyPayment;
    })
    .slice(0, limit);


    return NextResponse.json({
      searchQuery: {
        city: searchCity,
        state: searchState,
        budget: { maxMonthlyPayment, maxDownPayment }
      },
      results: {
        direct: {
          count: directProperties.length,
          description: `Properties located in ${searchCity}`
        },
        nearby: {
          count: nearbyProperties.length,
          description: `Properties in nearby cities (within 30 miles of ${searchCity})`
        },
        total: dashboardResults.length
      },
      properties: dashboardResults,
      uiInstructions: {
        directProperties: 'Display normally without tags',
        nearbyProperties: 'Display with blue "Nearby" tag on image/card',
        sortOrder: 'Direct properties first, then nearby properties, sorted by monthly payment within each group'
      },
      systemStatus: {
        workflowSupported: dashboardResults.length > directProperties.length,
        dataReady: true,
        reverseLookupWorking: nearbyProperties.length > 0,
        readyForDashboardIntegration: true
      }
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Search failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}