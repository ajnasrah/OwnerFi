import { NextRequest, NextResponse } from 'next/server';
import UnifiedMatchingService from '@/lib/unified-matching-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || 'Memphis';
    const state = searchParams.get('state') || 'TN';
    const radius = parseInt(searchParams.get('radius') || '40');
    const maxMonthly = parseInt(searchParams.get('maxMonthly') || '5000');
    const maxDown = parseInt(searchParams.get('maxDown') || '100000');
    const minBedrooms = searchParams.get('minBedrooms') ? parseInt(searchParams.get('minBedrooms')!) : undefined;
    const minBathrooms = searchParams.get('minBathrooms') ? parseInt(searchParams.get('minBathrooms')!) : undefined;
    const minPrice = searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!) : undefined;
    
    // Build buyer location (for anonymous searches, we need to calculate cities)
    const buyerLocation = {
      centerCity: city,
      centerState: state,
      searchRadius: radius,
      serviceCities: [city] // For now, just use center city. In real app, this would be pre-calculated
    };

    // Use unified service to find properties for buyer
    const matchingProperties = await UnifiedMatchingService.findPropertiesForBuyer(
      buyerLocation,
      { maxMonthlyPayment: maxMonthly, maxDownPayment: maxDown, minPrice, maxPrice },
      { minBedrooms, minBathrooms }
    );

    // Format response
    const properties = matchingProperties.map(property => ({
      id: property.id,
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      squareFeet: property.squareFeet,
      listPrice: property.listPrice,
      downPaymentAmount: property.downPaymentAmount,
      monthlyPayment: property.monthlyPayment,
      interestRate: property.interestRate,
      termYears: property.termYears,
      imageUrl: property.imageUrl,
      description: property.description,
      distance: 0, // Would calculate if needed
      matchScore: 85 // Default good match score
    }));

    return NextResponse.json({
      properties,
      totalMatches: properties.length,
      exactCityMatches: properties.filter(p => p.city.toLowerCase() === city.toLowerCase()).length,
      nearbyMatches: properties.filter(p => p.city.toLowerCase() !== city.toLowerCase()).length,
      searchCriteria: {
        city,
        state,
        radius,
        maxMonthly,
        maxDown,
        minBedrooms,
        minBathrooms
      }
    });

  } catch (error) {
    console.error('Buyer matched properties error:', error);
    return NextResponse.json(
      { error: 'Failed to find matching properties' },
      { status: 500 }
    );
  }
}