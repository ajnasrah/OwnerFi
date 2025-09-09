import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Test specific cities: Dallas, Memphis, Austin, Houston, San Antonio
 */
export async function GET() {
  try {
    const testCities = [
      { city: 'Dallas', state: 'TX', budget: { monthly: 2500, down: 50000 } },
      { city: 'Memphis', state: 'TN', budget: { monthly: 2000, down: 40000 } },
      { city: 'Austin', state: 'TX', budget: { monthly: 3000, down: 70000 } },
      { city: 'Houston', state: 'TX', budget: { monthly: 2800, down: 60000 } },
      { city: 'San Antonio', state: 'TX', budget: { monthly: 2200, down: 45000 } }
    ];
    
    console.log('🧪 Testing specific cities for nearby functionality...');
    
    // Get all properties
    const snapshot = await getDocs(collection(db, 'properties'));
    const allProperties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const results = [];
    
    for (const testCity of testCities) {
      console.log(`🔍 Testing: ${testCity.city}, ${testCity.state}`);
      
      // Direct properties in the city
      const directProperties = allProperties.filter(property => {
        const propertyCity = property.city?.split(',')[0].trim();
        return propertyCity?.toLowerCase() === testCity.city.toLowerCase() && 
               property.state === testCity.state &&
               property.isActive !== false &&
               property.monthlyPayment <= testCity.budget.monthly &&
               property.downPaymentAmount <= testCity.budget.down;
      });
      
      // Properties from nearby cities that consider this city nearby
      const nearbyProperties = allProperties.filter(property => {
        const propertyCity = property.city?.split(',')[0].trim();
        
        if (propertyCity?.toLowerCase() === testCity.city.toLowerCase()) return false;
        
        const considersTargetNearby = property.nearbyCities && 
          Array.isArray(property.nearbyCities) &&
          property.nearbyCities.some((nearbyCity: string) => 
            nearbyCity.toLowerCase() === testCity.city.toLowerCase()
          );
        
        return considersTargetNearby &&
               property.state === testCity.state &&
               property.isActive !== false &&
               property.monthlyPayment <= testCity.budget.monthly &&
               property.downPaymentAmount <= testCity.budget.down;
      });
      
      const totalProperties = directProperties.length + nearbyProperties.length;
      const hasExpandedResults = nearbyProperties.length > 0;
      
      results.push({
        city: testCity.city,
        state: testCity.state,
        budget: testCity.budget,
        direct: {
          count: directProperties.length,
          properties: directProperties.map(p => ({
            address: p.address,
            monthlyPayment: p.monthlyPayment,
            downPaymentAmount: p.downPaymentAmount,
            displayTag: null
          }))
        },
        nearby: {
          count: nearbyProperties.length,
          properties: nearbyProperties.map(p => ({
            address: p.address,
            actualCity: p.city?.split(',')[0].trim(),
            monthlyPayment: p.monthlyPayment,
            downPaymentAmount: p.downPaymentAmount,
            displayTag: 'Nearby'
          }))
        },
        total: totalProperties,
        expandedSearchWorking: hasExpandedResults,
        dashboardWillShow: `${directProperties.length} direct + ${nearbyProperties.length} nearby = ${totalProperties} properties`,
        verdict: totalProperties >= 3 
          ? '✅ EXCELLENT - 3+ properties available'
          : totalProperties > 0 
          ? '⚠️ LIMITED - Some properties available'
          : '❌ NO RESULTS - No properties in area'
      });
      
      console.log(`📊 ${testCity.city}: ${directProperties.length} direct + ${nearbyProperties.length} nearby = ${totalProperties} total`);
    }
    
    const summary = {
      totalCitiesTested: results.length,
      citiesWithExpandedResults: results.filter(r => r.expandedSearchWorking).length,
      citiesWithMultipleProperties: results.filter(r => r.total >= 3).length,
      avgPropertiesPerCity: Math.round(results.reduce((sum, r) => sum + r.total, 0) / results.length)
    };
    
    return NextResponse.json({
      testName: 'Specific Cities Nearby Functionality Test',
      summary,
      results,
      workflowStatus: {
        systemWorking: results.some(r => r.expandedSearchWorking),
        dataQuality: summary.citiesWithExpandedResults / summary.totalCitiesTested * 100,
        readyForDashboard: true,
        recommendedImplementation: 'Use /api/properties/search-with-nearby endpoint for dashboard searches'
      }
    });
    
  } catch (error) {
    console.error('Specific cities test error:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: (error as Error).message 
    }, { status: 500 });
  }
}