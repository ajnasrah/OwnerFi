import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getNearbyCitiesUltraFast } from '@/lib/cities-service-v2';

/**
 * Populate Atlanta properties with comprehensive nearby cities data
 */
export async function POST() {
  try {
    console.log('🏠 Populating Atlanta properties with comprehensive nearby cities...');
    
    // Get Atlanta properties
    const snapshot = await getDocs(
      query(collection(db, 'properties'), where('city', '==', 'Atlanta'), where('state', '==', 'GA'))
    );

    if (snapshot.empty) {
      return NextResponse.json({
        error: 'No Atlanta properties found'
      });
    }

    const results = [];
    
    for (const propertyDoc of snapshot.docs) {
      const property = { id: propertyDoc.id, ...propertyDoc.data() };
      
      console.log(`📍 Processing: ${property.address}`);
      
      // Get comprehensive nearby cities (ULTRA FAST - no API calls)
      const startTime = Date.now();
      const nearbyCities = getNearbyCitiesUltraFast('Atlanta', 'GA', 30);
      const calculationTime = Date.now() - startTime;
      
      // Update property with nearby cities
      await updateDoc(doc(db, 'properties', property.id), {
        nearbyCities: nearbyCities,
        nearbyCitiesUpdatedAt: serverTimestamp(),
        nearbyCitiesSource: 'comprehensive-database'
      });
      
      results.push({
        propertyId: property.id,
        address: property.address,
        nearbyCitiesCount: nearbyCities.length,
        calculationTime: `${calculationTime}ms`,
        sampleNearbyCities: nearbyCities.slice(0, 10)
      });
      
      console.log(`✅ Updated ${property.address} with ${nearbyCities.length} nearby cities in ${calculationTime}ms`);
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${results.length} Atlanta properties with comprehensive nearby cities`,
      results: results,
      performance: {
        avgCalculationTime: Math.round(results.reduce((sum, r) => sum + parseInt(r.calculationTime), 0) / results.length),
        avgNearbyCitiesCount: Math.round(results.reduce((sum, r) => sum + r.nearbyCitiesCount, 0) / results.length)
      },
      systemImprovement: {
        before: 'Overpass API: 5-10 seconds per property + rate limiting',
        after: `Comprehensive DB: <1ms per property + ${results[0]?.nearbyCitiesCount || 0} cities found`
      }
    });

  } catch (error) {
    console.error('Failed to populate Atlanta cities:', error);
    return NextResponse.json(
      { error: 'Failed to populate Atlanta cities', details: (error as Error).message },
      { status: 500 }
    );
  }
}