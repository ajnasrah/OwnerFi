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

async function analyzeMissingImages() {
  console.log('\n🖼️  ANALYZING MISSING IMAGES\n');
  console.log('=' .repeat(70));

  try {
    const snapshot = await db.collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .get();

    console.log(`\n📊 Total properties: ${snapshot.size}\n`);

    let withImages = 0;
    let withoutImages = 0;
    let csvImportsWithImages = 0;
    let csvImportsWithoutImages = 0;
    let zillowScrapesWithImages = 0;
    let zillowScrapesWithoutImages = 0;

    const propertiesWithoutImages: any[] = [];
    const imageFieldAnalysis = {
      hasFirstPropertyImage: 0,
      hasImageUrl: 0,
      hasPropertyImages: 0,
      hasImageUrls: 0,
      hasAnyImageField: 0,
      hasNoImageFields: 0,
    };

    snapshot.forEach(doc => {
      const data = doc.data();

      // Check all possible image fields
      const firstPropertyImage = data.firstPropertyImage;
      const imageUrl = data.imageUrl;
      const propertyImages = data.propertyImages;
      const imageUrls = data.imageUrls;

      const hasAnyImage = firstPropertyImage || imageUrl ||
                         (propertyImages && propertyImages.length > 0) ||
                         (imageUrls && imageUrls.length > 0);

      // Count which fields exist
      if (firstPropertyImage) imageFieldAnalysis.hasFirstPropertyImage++;
      if (imageUrl) imageFieldAnalysis.hasImageUrl++;
      if (propertyImages && propertyImages.length > 0) imageFieldAnalysis.hasPropertyImages++;
      if (imageUrls && imageUrls.length > 0) imageFieldAnalysis.hasImageUrls++;

      if (hasAnyImage) {
        imageFieldAnalysis.hasAnyImageField++;
        withImages++;

        if (data.source === 'CSV Import') {
          csvImportsWithImages++;
        } else {
          zillowScrapesWithImages++;
        }
      } else {
        imageFieldAnalysis.hasNoImageFields++;
        withoutImages++;

        if (data.source === 'CSV Import') {
          csvImportsWithoutImages++;
        } else {
          zillowScrapesWithoutImages++;
        }

        propertiesWithoutImages.push({
          id: doc.id,
          address: data.fullAddress || data.address,
          city: data.city,
          state: data.state,
          price: data.price,
          source: data.source || 'Zillow Scrape',
          zillowUrl: data.zillowUrl,
        });
      }
    });

    console.log('=' .repeat(70));
    console.log('\n📊 IMAGE STATISTICS:\n');
    console.log(`Properties WITH images:     ${withImages} (${((withImages / snapshot.size) * 100).toFixed(1)}%)`);
    console.log(`Properties WITHOUT images:  ${withoutImages} (${((withoutImages / snapshot.size) * 100).toFixed(1)}%)`);

    console.log('\n📊 BY SOURCE:\n');
    console.log('CSV Imports:');
    console.log(`  With images:    ${csvImportsWithImages}`);
    console.log(`  Without images: ${csvImportsWithoutImages}`);

    console.log('\nZillow Scrapes:');
    console.log(`  With images:    ${zillowScrapesWithImages}`);
    console.log(`  Without images: ${zillowScrapesWithoutImages}`);

    console.log('\n📊 IMAGE FIELD USAGE:\n');
    console.log(`firstPropertyImage:  ${imageFieldAnalysis.hasFirstPropertyImage} properties`);
    console.log(`imageUrl:            ${imageFieldAnalysis.hasImageUrl} properties`);
    console.log(`propertyImages:      ${imageFieldAnalysis.hasPropertyImages} properties`);
    console.log(`imageUrls:           ${imageFieldAnalysis.hasImageUrls} properties`);

    // Show sample of properties without images
    if (propertiesWithoutImages.length > 0) {
      console.log('\n' + '='.repeat(70));
      console.log('\n🚨 PROPERTIES WITHOUT IMAGES (showing first 20):\n');

      propertiesWithoutImages.slice(0, 20).forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.address}`);
        console.log(`   City: ${prop.city}, ${prop.state}`);
        console.log(`   Price: $${prop.price?.toLocaleString() || 'N/A'}`);
        console.log(`   Source: ${prop.source}`);
        if (prop.zillowUrl) {
          console.log(`   Zillow URL: ${prop.zillowUrl}`);
        }
        console.log('');
      });

      if (propertiesWithoutImages.length > 20) {
        console.log(`... and ${propertiesWithoutImages.length - 20} more\n`);
      }
    }

    // Analysis and recommendations
    console.log('=' .repeat(70));
    console.log('\n💡 ANALYSIS & RECOMMENDATIONS:\n');

    const missingPercentage = (withoutImages / snapshot.size) * 100;

    if (missingPercentage > 30) {
      console.log('🚨 CRITICAL: Over 30% of properties are missing images!');
    } else if (missingPercentage > 10) {
      console.log('⚠️  WARNING: Over 10% of properties are missing images');
    } else {
      console.log('✅ Good: Less than 10% of properties are missing images');
    }

    console.log('\nRecommended Actions:');

    if (csvImportsWithoutImages > 0) {
      console.log(`\n1. CSV Imports (${csvImportsWithoutImages} missing images):`);
      console.log('   - Check if CSV file has "Image link" column populated');
      console.log('   - Re-scrape these properties from Zillow to get images');
      console.log('   - Update CSV with image URLs and re-import');
    }

    if (zillowScrapesWithoutImages > 0) {
      console.log(`\n2. Zillow Scrapes (${zillowScrapesWithoutImages} missing images):`);
      console.log('   - Check if Zillow scraper is extracting image URLs');
      console.log('   - Some Zillow listings may not have images');
      console.log('   - Re-scrape these properties to get latest images');
    }

    console.log('\n3. Immediate Fixes:');
    console.log('   - Run image scraping script for properties without images');
    console.log('   - Add placeholder images for properties that never had photos');
    console.log('   - Update scraper to ensure image extraction is working');

    console.log('\n' + '='.repeat(70));

    // Save list of properties without images
    const fs = require('fs');
    const outputPath = path.join(__dirname, '..', 'properties-without-images.json');
    fs.writeFileSync(outputPath, JSON.stringify(propertiesWithoutImages, null, 2));
    console.log(`\n💾 Saved list to: properties-without-images.json\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

analyzeMissingImages()
  .then(() => {
    console.log('✅ Analysis complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
