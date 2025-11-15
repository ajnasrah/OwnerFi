/**
 * Tests RentCast RENT estimate accuracy vs Zillow Rent Zestimate
 *
 * Run with: npx tsx scripts/test-rentcast-rent-accuracy.ts
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
  zillowRentEstimate: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFoot?: number;
  homeType?: string;
}

interface RentCastRentResponse {
  rent: number;
  rentRangeLow: number;
  rentRangeHigh: number;
}

interface ComparisonResult {
  property: PropertySample;
  rentCastRent: number | null;
  zillowRent: number;
  difference: number;
  percentDifference: number;
  rentCastRange?: { low: number; high: number };
  error?: string;
}

async function getRentCastRentEstimate(property: PropertySample): Promise<RentCastRentResponse | null> {
  const apiKey = process.env.RENTCAST_API_KEY;

  if (!apiKey) {
    console.error('❌ RENTCAST_API_KEY not found in environment variables!');
    return null;
  }

  try {
    const params = new URLSearchParams({
      address: property.fullAddress,
    });

    if (property.bedrooms) params.append('bedrooms', property.bedrooms.toString());
    if (property.bathrooms) params.append('bathrooms', property.bathrooms.toString());
    if (property.squareFoot) params.append('squareFootage', property.squareFoot.toString());
    if (property.homeType) params.append('propertyType', property.homeType);

    const url = `https://api.rentcast.io/v1/avm/rent/long-term?${params.toString()}`;

    console.log(`   📡 Calling RentCast Rent API for: ${property.fullAddress}`);

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
      rent: data.rent,
      rentRangeLow: data.rentRangeLow,
      rentRangeHigh: data.rentRangeHigh,
    };

  } catch (error: any) {
    console.error(`   ❌ RentCast API error: ${error.message}`);
    return null;
  }
}

async function testRentCastRentAccuracy() {
  console.log('🏠 Testing RentCast RENT Estimate Accuracy vs Zillow Rent Zestimate\n');
  console.log('================================================\n');

  console.log('📋 Fetching sample properties with Rent Zestimates...');

  const propertiesSnapshot = await db
    .collection('zillow_imports')
    .limit(100)
    .get();

  if (propertiesSnapshot.empty) {
    console.log('❌ No properties found!');
    return;
  }

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
        zillowRentEstimate: data.rentEstimate || 0,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        squareFoot: data.squareFoot,
        homeType: data.homeType || data.buildingType,
      };
    })
    .filter(p => p.zillowRentEstimate > 0 && p.fullAddress)
    .slice(0, 50);

  if (sampleProperties.length === 0) {
    console.log('❌ No properties found with Rent Zestimates!');
    return;
  }

  console.log(`✅ Found ${sampleProperties.length} properties to test\n`);

  const results: ComparisonResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < sampleProperties.length; i++) {
    const property = sampleProperties[i];

    console.log(`\n[${i + 1}/${sampleProperties.length}] Testing: ${property.fullAddress}`);
    console.log(`   🏠 Zillow Rent Zestimate: $${property.zillowRentEstimate.toLocaleString()}/mo`);
    console.log(`   🏷️  Sale Price: $${property.price.toLocaleString()}`);

    const rentCastData = await getRentCastRentEstimate(property);

    if (rentCastData) {
      const difference = rentCastData.rent - property.zillowRentEstimate;
      const percentDiff = (difference / property.zillowRentEstimate) * 100;

      console.log(`   💵 RentCast Rent Estimate: $${rentCastData.rent.toLocaleString()}/mo`);
      console.log(`   📊 Difference: $${Math.abs(difference).toLocaleString()} (${Math.abs(percentDiff).toFixed(1)}%)`);

      if (percentDiff > 0) {
        console.log(`   📈 RentCast is ${percentDiff.toFixed(1)}% HIGHER`);
      } else {
        console.log(`   📉 RentCast is ${Math.abs(percentDiff).toFixed(1)}% LOWER`);
      }

      results.push({
        property,
        rentCastRent: rentCastData.rent,
        zillowRent: property.zillowRentEstimate,
        difference,
        percentDifference: percentDiff,
        rentCastRange: {
          low: rentCastData.rentRangeLow,
          high: rentCastData.rentRangeHigh,
        },
      });
      successCount++;
    } else {
      console.log(`   ❌ RentCast API failed`);
      results.push({
        property,
        rentCastRent: null,
        zillowRent: property.zillowRentEstimate,
        difference: 0,
        percentDifference: 0,
        error: 'API call failed',
      });
      failCount++;
    }

    if (i < sampleProperties.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n\n📊 ============ RENT ACCURACY ANALYSIS ============\n');

  const successfulResults = results.filter(r => r.rentCastRent !== null);

  console.log(`Total Properties Tested: ${sampleProperties.length}`);
  console.log(`✅ Successful API Calls: ${successCount}`);
  console.log(`❌ Failed API Calls: ${failCount}`);
  console.log(`📈 Success Rate: ${((successCount / sampleProperties.length) * 100).toFixed(1)}%\n`);

  if (successfulResults.length > 0) {
    const avgDifference = successfulResults.reduce((sum, r) => sum + Math.abs(r.difference), 0) / successfulResults.length;
    const avgPercentDiff = successfulResults.reduce((sum, r) => sum + Math.abs(r.percentDifference), 0) / successfulResults.length;

    console.log(`💵 Average Absolute Difference: $${avgDifference.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo`);
    console.log(`📊 Average Percent Difference: ${avgPercentDiff.toFixed(1)}%\n`);

    const sortedDiffs = successfulResults.map(r => Math.abs(r.percentDifference)).sort((a, b) => a - b);
    const medianPercentDiff = sortedDiffs[Math.floor(sortedDiffs.length / 2)];
    console.log(`📍 Median Percent Difference: ${medianPercentDiff.toFixed(1)}%\n`);

    const within5Percent = successfulResults.filter(r => Math.abs(r.percentDifference) <= 5).length;
    const within10Percent = successfulResults.filter(r => Math.abs(r.percentDifference) <= 10).length;
    const within15Percent = successfulResults.filter(r => Math.abs(r.percentDifference) <= 15).length;
    const within20Percent = successfulResults.filter(r => Math.abs(r.percentDifference) <= 20).length;

    console.log('🎯 Accuracy Distribution:');
    console.log(`   Within 5%:  ${within5Percent}/${successCount} (${(within5Percent/successCount*100).toFixed(1)}%)`);
    console.log(`   Within 10%: ${within10Percent}/${successCount} (${(within10Percent/successCount*100).toFixed(1)}%)`);
    console.log(`   Within 15%: ${within15Percent}/${successCount} (${(within15Percent/successCount*100).toFixed(1)}%)`);
    console.log(`   Within 20%: ${within20Percent}/${successCount} (${(within20Percent/successCount*100).toFixed(1)}%)`);

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

    console.log('\n\n💡 ============ RECOMMENDATION ============\n');

    if (avgPercentDiff < 10) {
      console.log('✅ EXCELLENT ACCURACY! RentCast rent estimates are very close to Zillow.');
      console.log('   Recommended: Use RentCast for rent estimates.');
    } else if (avgPercentDiff < 15) {
      console.log('✅ GOOD ACCURACY! RentCast rent estimates are reasonably close to Zillow.');
      console.log('   Recommended: Safe to use, provides good rental analysis.');
    } else if (avgPercentDiff < 25) {
      console.log('⚠️  MODERATE ACCURACY. RentCast rent estimates vary from Zillow.');
      console.log('   Recommended: Use with caution for rental analysis.');
    } else {
      console.log('❌ LOW ACCURACY. RentCast rent estimates differ significantly from Zillow.');
      console.log('   Recommended: Consider other sources for rent data.');
    }
  }

  console.log('\n\n✅ Test complete!\n');
  const totalUsed = 15 + successCount; // Previous value test + this rent test
  console.log(`📊 Total API calls used: ${totalUsed} / 50 free calls this month`);
  console.log(`   Remaining: ${50 - totalUsed} calls\n`);
}

testRentCastRentAccuracy().catch(console.error);
