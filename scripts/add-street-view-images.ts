import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing Firebase credentials');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

/**
 * Generate Google Street View image URL from address
 */
function getStreetViewImageByAddress(address: string): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error('❌ GOOGLE_MAPS_API_KEY not found in environment');
    return '';
  }

  const encodedAddress = encodeURIComponent(address);

  // High quality settings: 800x500, 90 degree FOV, slight pitch for better view
  return `https://maps.googleapis.com/maps/api/streetview?` +
    `size=800x500&` +
    `location=${encodedAddress}&` +
    `heading=0&` +
    `fov=90&` +
    `pitch=10&` +
    `key=${apiKey}`;
}

async function addStreetViewImages() {
  console.log('\n🏠 ADDING GOOGLE STREET VIEW IMAGES\n');
  console.log('='.repeat(70));

  try {
    // Check for Google Maps API key
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      console.error('\n❌ GOOGLE_MAPS_API_KEY not configured in .env.local');
      console.error('   Please add: GOOGLE_MAPS_API_KEY=your_key_here\n');
      process.exit(1);
    }

    console.log('🔍 Finding properties without images...\n');

    const snapshot = await db.collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .get();

    console.log(`📊 Total properties checked: ${snapshot.size}\n`);

    // Find properties missing images
    const propertiesWithoutImages: Array<{
      id: string;
      address: string;
      city: string;
      state: string;
      source: string;
    }> = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const hasImage = data.firstPropertyImage || data.imageUrl ||
                      (data.propertyImages && data.propertyImages.length > 0) ||
                      (data.imageUrls && data.imageUrls.length > 0);

      if (!hasImage) {
        const address = data.fullAddress || data.address || data.streetAddress;
        if (address) {
          propertiesWithoutImages.push({
            id: doc.id,
            address,
            city: data.city || 'Unknown',
            state: data.state || 'Unknown',
            source: data.source || 'Unknown',
          });
        }
      }
    });

    console.log(`📊 Properties missing images: ${propertiesWithoutImages.length}\n`);

    if (propertiesWithoutImages.length === 0) {
      console.log('✅ All properties already have images!\n');
      return;
    }

    console.log('='.repeat(70));
    console.log('\n🖼️  GENERATING STREET VIEW IMAGES...\n');

    let successCount = 0;
    let failedCount = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (let i = 0; i < propertiesWithoutImages.length; i++) {
      const property = propertiesWithoutImages[i];

      try {
        // Generate Street View URL
        const streetViewUrl = getStreetViewImageByAddress(property.address);

        if (!streetViewUrl) {
          console.log(`   ❌ Failed to generate URL for: ${property.address}`);
          failedCount++;
          continue;
        }

        // Update property with Street View image
        const docRef = db.collection('zillow_imports').doc(property.id);
        batch.update(docRef, {
          firstPropertyImage: streetViewUrl,
          imageUrl: streetViewUrl,
          propertyImages: [streetViewUrl],
          imageUrls: [streetViewUrl],
          imageSource: 'Google Street View',
          updatedAt: new Date(),
        });

        batchCount++;
        successCount++;

        if ((i + 1) % 10 === 0) {
          console.log(`   ✓ Processed ${i + 1}/${propertiesWithoutImages.length}...`);
        }

        // Commit batch every 500 updates
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   💾 Committed batch of ${batchCount} updates`);
          batch = db.batch();
          batchCount = 0;
        }

      } catch (error) {
        console.error(`   ❌ Error processing ${property.address}:`, error);
        failedCount++;
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`   💾 Committed final batch of ${batchCount} updates`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n📊 RESULTS:\n');
    console.log(`Properties updated:  ${successCount}`);
    console.log(`Properties failed:   ${failedCount}`);
    console.log(`Total processed:     ${successCount + failedCount}`);

    if (successCount > 0) {
      console.log('\n✅ Street View images added successfully!\n');
      console.log('📸 All properties now have Google Street View images');
      console.log('   These are high-quality 800x500 images from Google Maps\n');
    }

    if (failedCount > 0) {
      console.log(`\n⚠️  Warning: ${failedCount} properties could not be updated`);
      console.log('   Check the errors above for details\n');
    }

    console.log('='.repeat(70));

    // Show sample of updated properties
    if (propertiesWithoutImages.length > 0) {
      console.log('\n📋 SAMPLE UPDATED PROPERTIES:\n');
      propertiesWithoutImages.slice(0, 5).forEach((prop, index) => {
        const url = getStreetViewImageByAddress(prop.address);
        console.log(`${index + 1}. ${prop.address}`);
        console.log(`   ${prop.city}, ${prop.state}`);
        console.log(`   ${url.substring(0, 80)}...\n`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

addStreetViewImages()
  .then(() => {
    console.log('\n✅ Script complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
