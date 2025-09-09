import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Check how many cities are actually stored in the nearbyCities field for properties
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || 'Atlanta';
    const state = searchParams.get('state') || 'GA';
    
    // Get properties in the specified city
    const snapshot = await getDocs(collection(db, 'properties'));
    
    const propertiesInCity = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(property => {
        const propertyCity = property.city?.split(',')[0].trim();
        return propertyCity?.toLowerCase() === city.toLowerCase() && 
               property.state === state;
      });

    const results = propertiesInCity.map(property => ({
      id: property.id,
      address: property.address,
      city: property.city,
      state: property.state,
      nearbyCities: property.nearbyCities || [],
      nearbyCitiesCount: property.nearbyCities?.length || 0,
      hasNearbyCities: !!(property.nearbyCities && property.nearbyCities.length > 0),
      nearbyCitiesUpdatedAt: property.nearbyCitiesUpdatedAt || 'Never',
      sampleNearbyCities: property.nearbyCities?.slice(0, 10) || []
    }));

    const summary = {
      totalProperties: results.length,
      propertiesWithNearbyCities: results.filter(p => p.hasNearbyCities).length,
      propertiesWithoutNearbyCities: results.filter(p => !p.hasNearbyCities).length,
      avgNearbyCitiesCount: results.length > 0 
        ? Math.round(results.reduce((sum, p) => sum + p.nearbyCitiesCount, 0) / results.length)
        : 0,
      maxNearbyCitiesCount: results.length > 0 
        ? Math.max(...results.map(p => p.nearbyCitiesCount))
        : 0,
      minNearbyCitiesCount: results.length > 0 
        ? Math.min(...results.map(p => p.nearbyCitiesCount))
        : 0
    };

    return NextResponse.json({
      searchCity: `${city}, ${state}`,
      summary,
      properties: results,
      analysis: {
        dataQuality: summary.propertiesWithNearbyCities / Math.max(summary.totalProperties, 1) * 100,
        recommendation: summary.propertiesWithoutNearbyCities > 0 
          ? `${summary.propertiesWithoutNearbyCities} properties need nearby cities populated`
          : 'All properties have nearby cities data'
      }
    });

  } catch (error) {
    console.error('🚨 Check nearby cities field error:', error);
    return NextResponse.json({ 
      error: 'Failed to check nearby cities field',
      details: (error as Error).message
    }, { status: 500 });
  }
}