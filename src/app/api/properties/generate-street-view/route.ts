import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
/**
 * Generate Google Street View images for properties without imageUrl
 * Cache the generated URLs in the database
 */

export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    const { propertyId } = await request.json();
    
    if (!propertyId) {
      return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });
    }

    // Get property data
    const propertyDocs = await adminDb.collection('properties').where('__name__', '==', propertyId).get();

    if (propertyDocs.empty) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const propertyData = propertyDocs.docs[0].data();
    
    // Check if property already has an imageUrl
    if (propertyData.imageUrl) {
      return NextResponse.json({ 
        imageUrl: propertyData.imageUrl,
        cached: true 
      });
    }

    // Generate Google Street View image URL
    const address = `${propertyData.address}, ${propertyData.city}, ${propertyData.state} ${propertyData.zipCode}`;
    const encodedAddress = encodeURIComponent(address);
    
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleApiKey) {
      throw new Error('Google Maps API key not configured');
    }

    // Google Street View Static API URL
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodedAddress}&fov=80&heading=70&pitch=0&key=${googleApiKey}`;

    console.log(`🏠 Generated Street View image for: ${address}`);

    // Update property with the generated imageUrl to cache it
    await adminDb.collection('properties').doc(propertyId).update({
      imageUrl: streetViewUrl,
      imageGeneratedAt: new Date().toISOString(),
      imageType: 'street_view'
    });

    console.log(`✅ Cached Street View image URL for property ${propertyId}`);

    return NextResponse.json({
      imageUrl: streetViewUrl,
      address: address,
      cached: false,
      message: 'Street View image generated and cached'
    });

  } catch (error) {
    console.error('Street View generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Street View image' },
      { status: 500 }
    );
  }
}

// Batch generate images for all properties without imageUrl
export async function GET() {
  try {
    console.log('🔄 Starting batch Street View image generation...');

    // Get all properties without imageUrl
    const propertiesSnapshot = await adminDb.collection('properties').where('isActive', '==', true).get();
    
    const propertiesWithoutImages = propertiesSnapshot.docs.filter(doc => 
      !doc.data().imageUrl
    );

    console.log(`📋 Found ${propertiesWithoutImages.length} properties without images`);

    const results = [];
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!googleApiKey) {
      return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
    }

    // Process in small batches to avoid API limits
    for (let i = 0; i < Math.min(propertiesWithoutImages.length, 20); i++) {
      const propertyDoc = propertiesWithoutImages[i];
      const propertyData = propertyDoc.data();
      
      try {
        const address = `${propertyData.address}, ${propertyData.city}, ${propertyData.state} ${propertyData.zipCode}`;
        const encodedAddress = encodeURIComponent(address);
        
        const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodedAddress}&fov=80&heading=70&pitch=0&key=${googleApiKey}`;

        // Update property with Street View URL
        await updateDoc(propertyDoc.ref, {
          imageUrl: streetViewUrl,
          imageGeneratedAt: new Date().toISOString(),
          imageType: 'street_view'
        });

        results.push({
          propertyId: propertyDoc.id,
          address: address,
          imageUrl: streetViewUrl,
          success: true
        });

        console.log(`✅ Generated image for: ${address}`);

        // Small delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Failed to generate image for property ${propertyDoc.id}:`, error);
        results.push({
          propertyId: propertyDoc.id,
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    });

  } catch (error) {
    console.error('Batch Street View generation error:', error);
    return NextResponse.json({ error: 'Failed to generate Street View images' }, { status: 500 });
  }
}