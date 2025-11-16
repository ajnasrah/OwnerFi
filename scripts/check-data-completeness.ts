import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

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

async function checkDataCompleteness() {
  console.log('\n📊 COMPREHENSIVE DATA COMPLETENESS CHECK\n');
  console.log('='.repeat(70));

  try {
    const snapshot = await db.collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .get();

    console.log(`\n📊 Total properties: ${snapshot.size}\n`);

    const stats = {
      total: snapshot.size,
      missingFields: {
        price: 0,
        address: 0,
        city: 0,
        state: 0,
        zipCode: 0,
        bedrooms: 0,
        bathrooms: 0,
        squareFeet: 0,
        images: 0,
        description: 0,
      },
      zeroValues: {
        price: 0,
        bedrooms: 0,
        bathrooms: 0,
        squareFeet: 0,
      },
      complete: 0,
      incomplete: 0,
    };

    const incompleteProperties: any[] = [];
    const missingPrices: any[] = [];
    const missingImages: any[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const issues: string[] = [];

      // Check essential fields
      const hasPrice = data.price && data.price > 0;
      const hasAddress = data.fullAddress || data.address || data.streetAddress;
      const hasCity = data.city;
      const hasState = data.state;
      const hasZip = data.zipCode;
      const hasBeds = data.bedrooms != null && data.bedrooms >= 0;
      const hasBaths = data.bathrooms != null && data.bathrooms >= 0;
      const hasSquareFeet = data.squareFoot || data.squareFeet;
      const hasImages = data.firstPropertyImage || data.imageUrl ||
                       (data.propertyImages && data.propertyImages.length > 0) ||
                       (data.imageUrls && data.imageUrls.length > 0);
      const hasDescription = data.description && data.description.length > 0;

      // Count missing fields
      if (!hasPrice || data.price === 0) {
        stats.missingFields.price++;
        issues.push('Missing price');
        missingPrices.push({
          id: doc.id,
          address: hasAddress || 'No address',
          source: data.source || 'Unknown',
        });
      }
      if (!hasAddress) {
        stats.missingFields.address++;
        issues.push('Missing address');
      }
      if (!hasCity) {
        stats.missingFields.city++;
        issues.push('Missing city');
      }
      if (!hasState) {
        stats.missingFields.state++;
        issues.push('Missing state');
      }
      if (!hasZip) {
        stats.missingFields.zipCode++;
        issues.push('Missing zip');
      }
      if (!hasBeds) {
        stats.missingFields.bedrooms++;
        issues.push('Missing bedrooms');
      }
      if (!hasBaths) {
        stats.missingFields.bathrooms++;
        issues.push('Missing bathrooms');
      }
      if (!hasSquareFeet) {
        stats.missingFields.squareFeet++;
        issues.push('Missing square feet');
      }
      if (!hasImages) {
        stats.missingFields.images++;
        issues.push('Missing images');
        missingImages.push({
          id: doc.id,
          address: hasAddress || 'No address',
          source: data.source || 'Unknown',
          zillowUrl: data.zillowUrl,
        });
      }
      if (!hasDescription) {
        stats.missingFields.description++;
        issues.push('Missing description');
      }

      // Count zero values
      if (data.price === 0) stats.zeroValues.price++;
      if (data.bedrooms === 0) stats.zeroValues.bedrooms++;
      if (data.bathrooms === 0) stats.zeroValues.bathrooms++;
      if ((data.squareFoot || data.squareFeet) === 0) stats.zeroValues.squareFeet++;

      // Determine if property is complete
      const isComplete = hasPrice && hasAddress && hasCity && hasState &&
                        hasZip && hasBeds && hasBaths && hasImages;

      if (isComplete) {
        stats.complete++;
      } else {
        stats.incomplete++;
        incompleteProperties.push({
          id: doc.id,
          address: hasAddress || 'No address',
          city: hasCity || 'No city',
          state: hasState || 'No state',
          price: data.price || 0,
          source: data.source || 'Unknown',
          issues: issues.join(', '),
        });
      }
    });

    // Display results
    console.log('='.repeat(70));
    console.log('\n📊 DATA COMPLETENESS REPORT:\n');

    const completePercent = (stats.complete / stats.total) * 100;
    const incompletePercent = (stats.incomplete / stats.total) * 100;

    console.log(`Complete properties:    ${stats.complete} (${completePercent.toFixed(1)}%)`);
    console.log(`Incomplete properties:  ${stats.incomplete} (${incompletePercent.toFixed(1)}%)`);

    console.log('\n📊 MISSING FIELDS:\n');
    console.log(`Price:         ${stats.missingFields.price} (${((stats.missingFields.price / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Images:        ${stats.missingFields.images} (${((stats.missingFields.images / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Address:       ${stats.missingFields.address} (${((stats.missingFields.address / stats.total) * 100).toFixed(1)}%)`);
    console.log(`City:          ${stats.missingFields.city} (${((stats.missingFields.city / stats.total) * 100).toFixed(1)}%)`);
    console.log(`State:         ${stats.missingFields.state} (${((stats.missingFields.state / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Zip Code:      ${stats.missingFields.zipCode} (${((stats.missingFields.zipCode / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Bedrooms:      ${stats.missingFields.bedrooms} (${((stats.missingFields.bedrooms / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Bathrooms:     ${stats.missingFields.bathrooms} (${((stats.missingFields.bathrooms / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Square Feet:   ${stats.missingFields.squareFeet} (${((stats.missingFields.squareFeet / stats.total) * 100).toFixed(1)}%)`);
    console.log(`Description:   ${stats.missingFields.description} (${((stats.missingFields.description / stats.total) * 100).toFixed(1)}%)`);

    console.log('\n📊 ZERO VALUES (might be missing data):\n');
    console.log(`Price = $0:         ${stats.zeroValues.price}`);
    console.log(`Bedrooms = 0:       ${stats.zeroValues.bedrooms}`);
    console.log(`Bathrooms = 0:      ${stats.zeroValues.bathrooms}`);
    console.log(`Square Feet = 0:    ${stats.zeroValues.squareFeet}`);

    // Show critical issues
    console.log('\n' + '='.repeat(70));
    console.log('\n🚨 CRITICAL ISSUES:\n');

    if (missingPrices.length > 0) {
      console.log(`❌ ${missingPrices.length} properties missing prices\n`);
      console.log('Sample (first 10):');
      missingPrices.slice(0, 10).forEach((prop, index) => {
        console.log(`  ${index + 1}. ${prop.address} (${prop.source})`);
      });
      if (missingPrices.length > 10) {
        console.log(`  ... and ${missingPrices.length - 10} more`);
      }
      console.log('');
    }

    if (missingImages.length > 0) {
      console.log(`❌ ${missingImages.length} properties missing images\n`);
      console.log('Sample (first 10):');
      missingImages.slice(0, 10).forEach((prop, index) => {
        console.log(`  ${index + 1}. ${prop.address} (${prop.source})`);
        if (prop.zillowUrl) {
          console.log(`      Zillow: ${prop.zillowUrl}`);
        }
      });
      if (missingImages.length > 10) {
        console.log(`  ... and ${missingImages.length - 10} more`);
      }
      console.log('');
    }

    // Recommendations
    console.log('='.repeat(70));
    console.log('\n💡 RECOMMENDATIONS:\n');

    if (stats.missingFields.price > 0) {
      console.log(`🔧 FIX MISSING PRICES (${stats.missingFields.price} properties):`);
      console.log('   - Re-scrape from Zillow to get current prices');
      console.log('   - Check CSV file for price data');
      console.log('   - Consider removing properties with no price\n');
    }

    if (stats.missingFields.images > 0) {
      console.log(`🔧 FIX MISSING IMAGES (${stats.missingFields.images} properties):`);
      console.log('   - Run image scraping for properties without images');
      console.log('   - Check if image URLs are being extracted correctly');
      console.log('   - Verify image URLs are not broken\n');
    }

    if (stats.incomplete > stats.total * 0.1) {
      console.log('⚠️  WARNING: More than 10% of properties have incomplete data');
      console.log('   - Review scraping process');
      console.log('   - Validate CSV import data');
      console.log('   - Consider data cleanup script\n');
    }

    console.log('='.repeat(70));

    // Save detailed reports
    const outputDir = path.join(__dirname, '..');
    fs.writeFileSync(
      path.join(outputDir, 'incomplete-properties.json'),
      JSON.stringify(incompleteProperties, null, 2)
    );
    fs.writeFileSync(
      path.join(outputDir, 'missing-prices.json'),
      JSON.stringify(missingPrices, null, 2)
    );
    fs.writeFileSync(
      path.join(outputDir, 'missing-images.json'),
      JSON.stringify(missingImages, null, 2)
    );

    console.log('\n💾 Saved detailed reports:');
    console.log('   - incomplete-properties.json');
    console.log('   - missing-prices.json');
    console.log('   - missing-images.json\n');

    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkDataCompleteness()
  .then(() => {
    console.log('\n✅ Data completeness check complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
