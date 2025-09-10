import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCityCoordinates } from '@/lib/cities';
import { ExtendedSession } from '@/types/session';
import { PropertyListing } from '@/lib/property-schema';
import { adminDb } from '@/lib/firebase-admin';

/**
 * ADMIN ONLY: Populate nearbyCities field for all properties
 * This ensures every property has cities within 30-mile radius for similar property searches
 */
export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // Admin access control
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Get all properties
    const propertiesSnapshot = await adminDb.collection('properties').get();
    const properties = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PropertyListing & { id: string }));

    let processed = 0;
    let updated = 0;
    let errors = 0;
    const results = [];

    console.log(`🏠 Processing ${properties.length} properties to populate nearbyCities...`);

    for (const property of properties) {
      processed++;
      
      try {
        // Skip if already has nearbyCities
        if (property.nearbyCities && Array.isArray(property.nearbyCities) && property.nearbyCities.length > 0) {
          console.log(`✅ ${property.address} already has ${property.nearbyCities.length} nearby cities`);
          results.push({
            id: property.id,
            address: property.address,
            status: 'skipped',
            reason: 'already populated',
            nearbyCitiesCount: property.nearbyCities.length
          });
          continue;
        }

        const cityName = property.city?.split(',')[0].trim();
        const stateName = property.state;

        if (!cityName || !stateName) {
          console.warn(`⚠️ Missing city/state for ${property.address}`);
          results.push({
            id: property.id,
            address: property.address,
            status: 'error',
            reason: 'missing city or state'
          });
          errors++;
          continue;
        }

        // Get coordinates for the property city
        const cityCoords = getCityCoordinates(cityName, stateName);
        if (!cityCoords) {
          console.warn(`⚠️ No coordinates found for ${cityName}, ${stateName}`);
          results.push({
            id: property.id,
            address: property.address,
            city: cityName,
            state: stateName,
            status: 'error',
            reason: 'coordinates not found'
          });
          errors++;
          continue;
        }

        // Call the comprehensive within-radius API
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
        const response = await fetch(`${baseUrl}/api/cities/within-radius?lat=${cityCoords.lat}&lng=${cityCoords.lng}&radius=30`);
        
        if (!response.ok) {
          throw new Error(`API call failed: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Extract unique city names (excluding the property's own city)
        const nearbyCities = data.cities
          .map((city: any) => city.name)
          .filter((name: string) => name && name.trim().length > 0)
          .filter((name: string) => name.toLowerCase() !== cityName.toLowerCase())
          .filter((name: string, index: number, arr: string[]) => arr.indexOf(name) === index) // unique only
          .slice(0, 50); // Limit to 50 nearby cities to keep data manageable

        // Update the property with nearbyCities
        await adminDb.collection('properties').doc(property.id).update({
          nearbyCities: nearbyCities,
          nearbyCitiesUpdatedAt: new Date()
        });

        updated++;
        console.log(`✅ Updated ${property.address} with ${nearbyCities.length} nearby cities`);
        
        results.push({
          id: property.id,
          address: property.address,
          city: cityName,
          state: stateName,
          status: 'updated',
          nearbyCitiesCount: nearbyCities.length,
          sampleCities: nearbyCities.slice(0, 5)
        });

        // Add delay to avoid overwhelming the Overpass API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing ${property.address}:`, error);
        results.push({
          id: property.id,
          address: property.address,
          status: 'error',
          reason: (error as Error).message
        });
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} properties: ${updated} updated, ${errors} errors`,
      summary: {
        total: processed,
        updated: updated,
        errors: errors,
        skipped: processed - updated - errors
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