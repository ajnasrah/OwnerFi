import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { expandSearchToNearbyCities, enhancePropertyWithNearbyCities } from '@/lib/property-enhancement';
import { PropertyListing } from "@/lib/property-schema";

/**
 * SIMILAR PROPERTIES API
 * 
 * Returns properties similar to a given property by:
 * 1. Finding all cities within 30-mile radius of the property
 * 2. Searching for properties in those nearby cities
 * 3. Filtering by similar price range, bedrooms, and bathrooms
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
    const propertyId = searchParams.get('propertyId');
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const listPrice = parseFloat(searchParams.get('listPrice') || '0');
    const bedrooms = parseInt(searchParams.get('bedrooms') || '0');
    const bathrooms = parseFloat(searchParams.get('bathrooms') || '0');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!city || !state) {
      return NextResponse.json({ 
        error: 'City and state are required' 
      }, { status: 400 });
    }


    // Get all cities within 30-mile radius
    const searchCities = expandSearchToNearbyCities(city, state, 30);

    // PERFORMANCE FIX: Query only active properties in the same state, ordered by monthlyPayment
    // This reduces from loading ALL properties (1000s) to only relevant ones (100-200)
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('state', '==', state), // Only properties in same state
      orderBy('monthlyPayment', 'asc'),
      firestoreLimit(200) // Get more than needed for filtering by city/price/beds/baths
    );

    const snapshot = await getDocs(propertiesQuery);
    
    const similarProperties = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as PropertyListing & { id: string }))
      .filter((property: PropertyListing & { id: string }) => {
        // Exclude the original property
        if (property.id === propertyId) return false;

        // isActive and state already filtered in query
        
        // Check if property city is in our nearby cities list
        const propertyCity = property.city?.split(',')[0].trim();
        const cityMatch = searchCities.some(searchCity => 
          propertyCity?.toLowerCase() === searchCity.toLowerCase()
        );
        
        if (!cityMatch) return false;
        
        // Similar price range (within 20% of original price)
        const priceMatch = listPrice === 0 || (
          property.listPrice >= listPrice * 0.8 && 
          property.listPrice <= listPrice * 1.2
        );
        
        // Similar bedrooms (exact match or within 1)
        const bedroomMatch = bedrooms === 0 || (
          Math.abs(property.bedrooms - bedrooms) <= 1
        );
        
        // Similar bathrooms (within 0.5)
        const bathroomMatch = bathrooms === 0 || (
          Math.abs(property.bathrooms - bathrooms) <= 0.5
        );
        
        return priceMatch && bedroomMatch && bathroomMatch;
      })
      // Sort by monthly payment (most affordable first)
      .sort((a, b) => (a.monthlyPayment || 0) - (b.monthlyPayment || 0))
      .slice(0, limit)
      // Enhance each property with nearby cities data
      .map(property => enhancePropertyWithNearbyCities(property));


    return NextResponse.json({
      originalProperty: { city, state, listPrice, bedrooms, bathrooms },
      searchRadius: 30,
      searchCities: searchCities,
      totalFound: similarProperties.length,
      properties: similarProperties
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to find similar properties',
      properties: []
    }, { status: 500 });
  }
}