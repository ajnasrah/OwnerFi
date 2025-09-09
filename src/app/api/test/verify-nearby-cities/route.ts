import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { populateNearbyCitiesForProperty } from '@/lib/property-enhancement';

/**
 * Test endpoint to verify and populate nearbyCities for all properties
 */
export async function GET() {
  try {
    // Get all properties
    const propertiesSnapshot = await getDocs(collection(db, 'properties'));
    const properties = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let alreadyPopulated = 0;
    let needsPopulation = 0;
    const sampleResults = [];

    console.log(`🔍 Checking ${properties.length} properties for nearbyCities field...`);

    for (const property of properties.slice(0, 10)) { // Check first 10 for testing
      
      const hasNearbyCities = property.nearbyCities && Array.isArray(property.nearbyCities) && property.nearbyCities.length > 0;
      
      if (hasNearbyCities) {
        alreadyPopulated++;
        sampleResults.push({
          id: property.id,
          address: property.address,
          city: property.city,
          state: property.state,
          status: 'populated',
          nearbyCitiesCount: property.nearbyCities.length,
          sampleNearbyCities: property.nearbyCities.slice(0, 5)
        });
      } else {
        needsPopulation++;
        sampleResults.push({
          id: property.id,
          address: property.address,
          city: property.city,
          state: property.state,
          status: 'needs_population',
          nearbyCitiesCount: 0
        });
      }
    }

    return NextResponse.json({
      totalProperties: properties.length,
      sampleChecked: Math.min(properties.length, 10),
      summary: {
        alreadyPopulated,
        needsPopulation,
        percentagePopulated: Math.round((alreadyPopulated / Math.min(properties.length, 10)) * 100)
      },
      sampleResults: sampleResults,
      message: needsPopulation > 0 
        ? `${needsPopulation} properties need nearby cities populated`
        : 'All properties have nearby cities populated'
    });

  } catch (error) {
    console.error('Failed to verify nearby cities:', error);
    return NextResponse.json(
      { error: 'Failed to verify nearby cities', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST to populate nearbyCities for properties that don't have it
 */
export async function POST() {
  try {
    // Get all properties that don't have nearbyCities
    const propertiesSnapshot = await getDocs(collection(db, 'properties'));
    const properties = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const results = [];

    for (const property of properties.slice(0, 5)) { // Limit to 5 for testing
      
      const hasNearbyCities = property.nearbyCities && Array.isArray(property.nearbyCities) && property.nearbyCities.length > 0;
      
      if (hasNearbyCities) {
        skipped++;
        continue;
      }

      try {
        const cityName = property.city?.split(',')[0].trim();
        const stateName = property.state;

        if (!cityName || !stateName) {
          errors++;
          continue;
        }

        // Populate nearby cities
        const nearbyCities = await populateNearbyCitiesForProperty(cityName, stateName, 30);
        
        // Update property
        await updateDoc(doc(db, 'properties', property.id), {
          nearbyCities: nearbyCities,
          nearbyCitiesUpdatedAt: serverTimestamp()
        });

        updated++;
        results.push({
          id: property.id,
          address: property.address,
          city: cityName,
          state: stateName,
          nearbyCitiesCount: nearbyCities.length,
          sampleCities: nearbyCities.slice(0, 5)
        });

        // Add delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error updating ${property.address}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} properties with nearby cities`,
      summary: {
        updated,
        skipped,
        errors
      },
      results: results
    });

  } catch (error) {
    console.error('Failed to populate nearby cities:', error);
    return NextResponse.json(
      { error: 'Failed to populate nearby cities', details: (error as Error).message },
      { status: 500 }
    );
  }
}