import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PropertyListing } from "@/lib/property-schema";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxMonthly = Number(searchParams.get('maxMonthly') || '25000');
    const maxDown = Number(searchParams.get('maxDown') || '250000');

    // Get ALL properties
    const snapshot = await getDocs(collection(db, 'properties'));
    const allProperties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PropertyListing & { id: string }));
    
    // Dallas properties (exact match)
    const dallasProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();
      return propertyCity?.toLowerCase() === 'dallas' && 
             property.state === 'TX' &&
             property.isActive !== false;
    });

    // Dallas properties within budget
    const dallasBudgetProperties = dallasProperties.filter((property: PropertyListing & { id: string }) => {
      return property.monthlyPayment <= maxMonthly &&
             property.downPaymentAmount <= maxDown;
    });

    // Properties with Dallas in nearby cities
    const nearbyDallasProperties = allProperties.filter((property: PropertyListing & { id: string }) => {
      const propertyCity = property.city?.split(',')[0].trim();
      
      // Must be different city but same state
      if (propertyCity?.toLowerCase() === 'dallas') return false;
      if (property.state !== 'TX') return false;
      
      // Must have Dallas in nearbyCities array
      return property.nearbyCities && 
        Array.isArray(property.nearbyCities) &&
        property.nearbyCities.some((nearbyCity: string) => 
          nearbyCity.toLowerCase() === 'dallas'
        ) &&
        property.isActive !== false &&
        property.monthlyPayment <= maxMonthly &&
        property.downPaymentAmount <= maxDown;
    });

    return NextResponse.json({
      totalProperties: allProperties.length,
      dallas: {
        total: dallasProperties.length,
        withinBudget: dallasBudgetProperties.length,
        examples: dallasBudgetProperties.slice(0, 3).map(p => ({
          id: p.id,
          address: p.address,
          monthlyPayment: p.monthlyPayment,
          downPaymentAmount: p.downPaymentAmount,
          price: p.price
        }))
      },
      nearby: {
        total: nearbyDallasProperties.length,
        examples: nearbyDallasProperties.slice(0, 3).map(p => ({
          id: p.id,
          city: p.city,
          address: p.address,
          nearbyCities: p.nearbyCities
        }))
      },
      searchCriteria: {
        maxMonthly,
        maxDown
      }
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to analyze Dallas properties',
      details: error 
    }, { status: 500 });
  }
}