import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Test Dallas buyer search without authentication 
 * to verify the 4-property scenario
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || 'Dallas';
    const maxMonthlyPayment = parseFloat(searchParams.get('maxMonthlyPayment') || '2000');
    const maxDownPayment = parseFloat(searchParams.get('maxDownPayment') || '40000');
    
    console.log(`🔍 DALLAS SEARCH: ${city}, Monthly: $${maxMonthlyPayment}, Down: $${maxDownPayment}`);

    // Get ALL properties and filter in memory (same logic as buyer search)
    const snapshot = await getDocs(collection(db, 'properties'));
    
    // Extract just the city name (remove state if present)
    const searchCity = city.split(',')[0].trim();
    
    const properties = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(property => {
        const propertyCity = property.city?.split(',')[0].trim();
        const cityMatch = propertyCity?.toLowerCase() === searchCity.toLowerCase();
        const monthlyMatch = property.monthlyPayment <= maxMonthlyPayment;
        const downMatch = property.downPaymentAmount <= maxDownPayment;
        
        console.log(`🔍 Checking: ${propertyCity} vs ${searchCity}, Monthly: ${property.monthlyPayment} <= ${maxMonthlyPayment}, Down: ${property.downPaymentAmount} <= ${maxDownPayment}, Match: ${cityMatch && monthlyMatch && downMatch}`);
        
        return cityMatch && monthlyMatch && downMatch;
      })
      .sort((a, b) => a.monthlyPayment - b.monthlyPayment);

    console.log(`✅ FOUND ${properties.length} properties for Dallas buyer`);

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
      searchCriteria: {
        city,
        maxMonthlyPayment,
        maxDownPayment
      },
      totalFound: results.length,
      expectedCount: 4,
      success: results.length === 4,
      properties: results,
      message: results.length === 4 
        ? "🎉 SUCCESS! Dallas buyer finds exactly 4 properties as expected!"
        : `⚠️ Expected 4 properties, but found ${results.length}`
    });

  } catch (error) {
    console.error('🚨 Dallas search test error:', error);
    return NextResponse.json({ 
      error: 'Failed to test Dallas search',
      details: (error as Error).message
    }, { status: 500 });
  }
}