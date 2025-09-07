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
 * One-time script to populate all properties with imageUrls
 * Generates Google Street View images and saves them permanently to database
 */

export async function POST() {
  try {
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!googleApiKey) {
      return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 });
    }

    console.log('🔄 Populating properties with permanent Street View images...');

    // Get ALL properties without imageUrl
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true)
    );
    const propertiesSnapshot = await getDocs(propertiesQuery);
    
    const propertiesWithoutImages = propertiesSnapshot.docs.filter(doc => 
      !doc.data().imageUrl
    );

    console.log(`📋 Found ${propertiesWithoutImages.length} properties without images`);

    let successful = 0;
    let failed = 0;

    // Process ALL properties and save permanent imageUrls
    for (const propertyDoc of propertiesWithoutImages) {
      const propertyData = propertyDoc.data();
      
      try {
        // Generate Google Street View URL
        const address = `${propertyData.address}, ${propertyData.city}, ${propertyData.state} ${propertyData.zipCode}`;
        const encodedAddress = encodeURIComponent(address);
        
        // Create permanent Street View URL
        const streetViewImageUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodedAddress}&fov=80&heading=70&pitch=-5&key=${googleApiKey}`;

        // SAVE to database permanently
        await updateDoc(propertyDoc.ref, {
          imageUrl: streetViewImageUrl,
          imageType: 'street_view_generated',
          imageGeneratedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        console.log(`✅ Saved permanent image for: ${propertyData.address}, ${propertyData.city}`);
        successful++;

        // Rate limiting to avoid hitting Google API limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Failed to save image for property:`, error);
        failed++;
      }
    }

    console.log(`🎉 Image population complete! ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: 'Property images populated successfully',
      totalProcessed: propertiesWithoutImages.length,
      successful: successful,
      failed: failed
    });

  } catch (error) {
    console.error('Property image population error:', error);
    return NextResponse.json(
      { error: 'Failed to populate property images' },
      { status: 500 }
    );
  }
}

// GET endpoint to check status
export async function GET() {
  try {
    // Count properties with and without images
    const allPropertiesSnapshot = await getDocs(query(
      collection(db, 'properties'),
      where('isActive', '==', true)
    ));
    
    const total = allPropertiesSnapshot.docs.length;
    const withImages = allPropertiesSnapshot.docs.filter(doc => doc.data().imageUrl).length;
    const withoutImages = total - withImages;

    return NextResponse.json({
      total: total,
      withImages: withImages,
      withoutImages: withoutImages,
      percentageComplete: Math.round((withImages / total) * 100)
    });

  } catch (error) {
    console.error('Image status check error:', error);
    return NextResponse.json({ error: 'Failed to check image status' }, { status: 500 });
  }
}