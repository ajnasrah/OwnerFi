import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Automatically generate and save Google Street View images for ALL properties
 * Run this periodically or when new properties are added
 */

export async function POST() {
  try {
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!googleApiKey) {
      return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
    }

    console.log('🔄 Starting automatic Street View image generation for all properties...');

    // Get ALL properties without imageUrl
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true)
    );
    const propertiesSnapshot = await getDocs(propertiesQuery);
    
    const propertiesNeedingImages = propertiesSnapshot.docs.filter(doc => 
      !doc.data().imageUrl || doc.data().imageType !== 'street_view'
    );

    console.log(`📋 Found ${propertiesNeedingImages.length} properties needing Street View images`);

    const results = {
      total: propertiesNeedingImages.length,
      successful: 0,
      failed: 0,
      details: []
    };

    // Process each property
    for (const propertyDoc of propertiesNeedingImages) {
      const propertyData = propertyDoc.data();
      const propertyId = propertyDoc.id;
      
      try {
        // Build property address
        const address = `${propertyData.address}, ${propertyData.city}, ${propertyData.state} ${propertyData.zipCode}`;
        const encodedAddress = encodeURIComponent(address);
        
        // Generate Google Street View URL
        const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodedAddress}&fov=80&heading=70&pitch=-10&key=${googleApiKey}`;

        // Test if the Street View image exists (Google returns default image if no street view available)
        const testResponse = await fetch(streetViewUrl);
        
        if (testResponse.ok) {
          // Save the Street View URL to property database
          await updateDoc(doc(db, 'properties', propertyId), {
            imageUrl: streetViewUrl,
            imageType: 'street_view',
            imageGeneratedAt: serverTimestamp(),
            address: propertyData.address, // Ensure address is clean
            updatedAt: serverTimestamp()
          });

          console.log(`✅ Generated and saved Street View for: ${address}`);
          
          results.successful++;
          results.details.push({
            propertyId,
            address,
            status: 'success',
            imageUrl: streetViewUrl
          });
        } else {
          console.log(`❌ Street View not available for: ${address}`);
          results.failed++;
          results.details.push({
            propertyId,
            address,
            status: 'no_street_view',
            error: 'Street View not available for this address'
          });
        }

        // Rate limiting - don't overwhelm Google API
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`❌ Failed to process property ${propertyId}:`, error);
        results.failed++;
        results.details.push({
          propertyId,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log(`✅ Street View generation complete: ${results.successful} successful, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      message: 'Street View image generation completed',
      results: results
    });

  } catch (error) {
    console.error('Auto Street View generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Street View images' },
      { status: 500 }
    );
  }
}