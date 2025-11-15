/**
 * Tests RentCast API accuracy by comparing with existing Zillow Zestimates
 *
 * Run with: npx tsx scripts/test-rentcast-accuracy.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    }),
  });
}

const db = getFirestore();

interface PropertySample {
  id: string;
  fullAddress: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  zillowEstimate: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFoot?: number;
  homeType?: string;
}

interface RentCastResponse {
  price: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  latitude?: number;
  longitude?: number;
}

interface ComparisonResult {
  property: PropertySample;
  rentCastEstimate: number | null;
  zillowEstimate: number;
  difference: number;
  percentDifference: number;
  rentCastRange?: { low: number; high: number };
  error?: string;
}

async function getRentCastEstimate(property: PropertySample): Promise<RentCastResponse | null> {
  const apiKey = process.env.RENTCAST_API_KEY;

  if (!apiKey) {
    console.error('❌ RENTCAST_API_KEY not found in environment variables!');
    console.log('\nTo get a RentCast API key:');
    console.log('1. Visit https://app.rentcast.io/app/api');
    console.log('2. Sign up for free account (50 API calls/month)');
    console.log('3. Copy your API key');
    console.log('4. Add to .env.local: RENTCAST_API_KEY=your_key_here\n');
    return null;
  }

  try {
    // Build query parameters
    const params = new URLSearchParams({
      address: property.fullAddress,
    });

    // Add optional parameters if available
    if (property.bedrooms) params.append('bedrooms', property.bedrooms.toString());
    if (property.bathrooms) params.append('bathrooms', property.bathrooms.toString());
    if (property.squareFoot) params.append('squareFootage', property.squareFoot.toString());
    if (property.homeType) params.append('propertyType', property.homeType);

    const url = `https://api.rentcast.io/v1/avm/value?${params.toString()}`;

    console.log(`   📡 Calling RentCast API for: ${property.fullAddress}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      price: data.price,
      priceRangeLow: data.priceRangeLow,
      priceRangeHigh: data.priceRangeHigh,
      latitude: data.latitude,
      longitude: data.longitude,
    };

  } catch (error: any) {
    console.error(`   ❌ RentCast API error: ${error.message}`);
    return null;
  }
}

async function testRentCastAccuracy() {
  console.log('🧪 Testing RentCast API Accuracy vs Zillow Zestimates\n');
  console.log('================================================\n');

  // Get sample of properties WITH Zestimates (for comparison)
  console.log('📋 Fetching sample properties with Zestimates...');

  const propertiesSnapshot = await db
    .collection('zillow_imports')
    .limit(100) // Fetch more to filter later
    .get();

  if (propertiesSnapshot.empty) {
    console.log('❌ No properties found!');
    return;
  }

  // Filter for properties with both estimate and price
  const sampleProperties: PropertySample[] = propertiesSnapshot.docs
    .map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        fullAddress: data.fullAddress || '',
        city: data.city || '',
        state: data.state || '',
        zipCode: data.zipCode || '',
        price: data.price || 0,
        zillowEstimate: data.estimate || 0,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        squareFoot: data.squareFoot,
        homeType: data.homeType || data.buildingType,
      };
    })
    .filter(p => p.zillowEstimate > 0 && p.price > 0 && p.fullAddress) // Filter after fetching
    .slice(0, 50); // Take first 50

  if (sampleProperties.length === 0) {
    console.log('❌ No properties found with both Zestimate and price!');
    return;
  }

  console.log(`✅ Found ${sampleProperties.length} properties to test\n`);

  // Test each property
  const results: ComparisonResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < sampleProperties.length; i++) {
    const property = sampleProperties[i];

    console.log(`\n[${i + 1}/${sampleProperties.length}] Testing: ${property.fullAddress}`);
    console.log(`   💰 Zillow Zestimate: $${property.zillowEstimate.toLocaleString()}`);
    console.log(`   🏷️  Listing Price: $${property.price.toLocaleString()}`);

    const rentCastData = await getRentCastEstimate(property);

    if (rentCastData) {
      const difference = rentCastData.price - property.zillowEstimate;
      const percentDiff = (difference / property.zillowEstimate) * 100;

      console.log(`   🏠 RentCast Estimate: $${rentCastData.price.toLocaleString()}`);
      console.log(`   📊 Difference: $${Math.abs(difference).toLocaleString()} (${Math.abs(percentDiff).toFixed(1)}%)`);

      if (percentDiff > 0) {
        console.log(`   📈 RentCast is ${percentDiff.toFixed(1)}% HIGHER`);
      } else {
        console.log(`   📉 RentCast is ${Math.abs(percentDiff).toFixed(1)}% LOWER`);
      }

      results.push({
        property,
        rentCastEstimate: rentCastData.price,
        zillowEstimate: property.zillowEstimate,
        difference,
        percentDifference: percentDiff,
        rentCastRange: {
          low: rentCastData.priceRangeLow,
          high: rentCastData.priceRangeHigh,
        },
      });
      successCount++;
    } else {
      console.log(`   ❌ RentCast API failed`);
      results.push({
        property,
        rentCastEstimate: null,
        zillowEstimate: property.zillowEstimate,
        difference: 0,
        percentDifference: 0,
        error: 'API call failed',
      });
      failCount++;
    }

    // Small delay to avoid rate limiting
    if (i < sampleProperties.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Calculate aggregate statistics
  console.log('\n\n📊 ============ ACCURACY ANALYSIS ============\n');

  const successfulResults = results.filter(r => r.rentCastEstimate !== null);

  console.log(`Total Properties Tested: ${sampleProperties.length}`);
  console.log(`✅ Successful API Calls: ${successCount}`);
  console.log(`❌ Failed API Calls: ${failCount}`);
  console.log(`📈 Success Rate: ${((successCount / sampleProperties.length) * 100).toFixed(1)}%\n`);

  if (successfulResults.length > 0) {
    // Average difference
    const avgDifference = successfulResults.reduce((sum, r) => sum + Math.abs(r.difference), 0) / successfulResults.length;
    const avgPercentDiff = successfulResults.reduce((sum, r) => sum + Math.abs(r.percentDifference), 0) / successfulResults.length;

    console.log(`💵 Average Absolute Difference: $${avgDifference.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    console.log(`📊 Average Percent Difference: ${avgPercentDiff.toFixed(1)}%\n`);

    // Median difference
    const sortedDiffs = successfulResults.map(r => Math.abs(r.percentDifference)).sort((a, b) => a - b);
    const medianPercentDiff = sortedDiffs[Math.floor(sortedDiffs.length / 2)];
    console.log(`📍 Median Percent Difference: ${medianPercentDiff.toFixed(1)}%\n`);

    // Count within ranges
    const within5Percent = successfulResults.filter(r => Math.abs(r.percentDifference) <= 5).length;
    const within10Percent = successfulResults.filter(r => Math.abs(r.percentDifference) <= 10).length;
    const within15Percent = successfulResults.filter(r => Math.abs(r.percentDifference) <= 15).length;
    const within20Percent = successfulResults.filter(r => Math.abs(r.percentDifference) <= 20).length;

    console.log('🎯 Accuracy Distribution:');
    console.log(`   Within 5%:  ${within5Percent}/${successCount} (${(within5Percent/successCount*100).toFixed(1)}%)`);
    console.log(`   Within 10%: ${within10Percent}/${successCount} (${(within10Percent/successCount*100).toFixed(1)}%)`);
    console.log(`   Within 15%: ${within15Percent}/${successCount} (${(within15Percent/successCount*100).toFixed(1)}%)`);
    console.log(`   Within 20%: ${within20Percent}/${successCount} (${(within20Percent/successCount*100).toFixed(1)}%)`);

    // Find best and worst matches
    const bestMatch = successfulResults.reduce((best, r) =>
      Math.abs(r.percentDifference) < Math.abs(best.percentDifference) ? r : best
    );
    const worstMatch = successfulResults.reduce((worst, r) =>
      Math.abs(r.percentDifference) > Math.abs(worst.percentDifference) ? r : worst
    );

    console.log(`\n✅ Best Match: ${bestMatch.property.fullAddress}`);
    console.log(`   Difference: ${Math.abs(bestMatch.percentDifference).toFixed(1)}%`);
    console.log(`\n❌ Worst Match: ${worstMatch.property.fullAddress}`);
    console.log(`   Difference: ${Math.abs(worstMatch.percentDifference).toFixed(1)}%`);

    // Recommendation
    console.log('\n\n💡 ============ RECOMMENDATION ============\n');

    if (avgPercentDiff < 10) {
      console.log('✅ EXCELLENT ACCURACY! RentCast estimates are very close to Zillow.');
      console.log('   Recommended: Use RentCast as fallback for missing Zestimates.');
    } else if (avgPercentDiff < 15) {
      console.log('✅ GOOD ACCURACY! RentCast estimates are reasonably close to Zillow.');
      console.log('   Recommended: Safe to use as fallback, but monitor variance.');
    } else if (avgPercentDiff < 25) {
      console.log('⚠️  MODERATE ACCURACY. RentCast estimates vary from Zillow.');
      console.log('   Recommended: Use with caution, adjust cash deal threshold if needed.');
    } else {
      console.log('❌ LOW ACCURACY. RentCast estimates differ significantly from Zillow.');
      console.log('   Recommended: Consider other API providers or manual review.');
    }

    console.log('\n   For 80% cash deal filter:');
    console.log(`   - Zillow 80% threshold variance: ${(avgPercentDiff * 0.8).toFixed(1)}%`);
    console.log(`   - This is ${(avgPercentDiff * 0.8) < 5 ? 'ACCEPTABLE' : 'SIGNIFICANT'} for cash deal detection`);
  }

  console.log('\n\n✅ Test complete!\n');
  console.log(`📊 API calls used: ${successCount} / 50 free calls this month`);
  console.log(`   Remaining: ${50 - successCount} calls\n`);
}

testRentCastAccuracy().catch(console.error);
