/**
 * Test Owner Financing Filter Against Real Database
 *
 * This script tests the owner financing filter against actual properties
 * in the zillow_imports collection to measure the success rate.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { filterPropertiesForOwnerFinancing, getFilterExplanation } from '../src/lib/owner-financing-filter';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
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

async function testOwnerFinancingFilter() {
  console.log('\n🔍 Testing Owner Financing Filter Against Database\n');
  console.log('='.repeat(70));

  try {
    // Fetch recent properties (up to 500)
    const snapshot = await db
      .collection('zillow_imports')
      .orderBy('importedAt', 'desc')
      .limit(500)
      .get();

    console.log(`\n📊 Fetched ${snapshot.size} properties from database\n`);

    // Convert to array
    const properties = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter for properties with contact info (like the actual route does)
    const withContact = properties.filter(
      (p: any) => p.agentPhoneNumber || p.brokerPhoneNumber
    );

    console.log(`📞 Properties with contact info: ${withContact.length}`);
    console.log(`📞 Properties without contact: ${properties.length - withContact.length}\n`);

    // Apply owner financing filter
    const { filtered, stats } = filterPropertiesForOwnerFinancing(withContact);

    // Calculate success rate
    const successRate = (stats.withOwnerFinancing / stats.total) * 100;

    console.log('='.repeat(70));
    console.log('🏦 OWNER FINANCING FILTER RESULTS');
    console.log('='.repeat(70));
    console.log(`\nTotal properties analyzed: ${stats.total}`);
    console.log(`\n✅ WITH owner financing: ${stats.withOwnerFinancing} (${successRate.toFixed(1)}%)`);
    console.log(`❌ WITHOUT owner financing: ${stats.withoutOwnerFinancing} (${((stats.withoutOwnerFinancing / stats.total) * 100).toFixed(1)}%)`);
    console.log(`📝 No description: ${stats.noDescription} (${((stats.noDescription / stats.total) * 100).toFixed(1)}%)`);
    console.log(`🚫 Explicitly rejected: ${stats.explicitlyRejected} (${((stats.explicitlyRejected / stats.total) * 100).toFixed(1)}%)`);

    console.log('\n' + '='.repeat(70));
    console.log(`🎯 SUCCESS RATE: ${successRate.toFixed(1)}%`);

    if (successRate >= 80) {
      console.log(`✅ SUCCESS RATE IS GOOD (>= 80%)`);
    } else {
      console.log(`⚠️  SUCCESS RATE IS TOO LOW (< 80%)`);
      console.log(`   Consider relaxing the filter or improving data quality`);
    }
    console.log('='.repeat(70));

    // Show sample properties that PASSED
    console.log('\n📋 SAMPLE PROPERTIES THAT PASSED (First 10):');
    console.log('='.repeat(70));
    filtered.slice(0, 10).forEach((prop: any, i: number) => {
      const address = prop.fullAddress || prop.streetAddress || 'Unknown';
      const explanation = getFilterExplanation(prop.description);
      console.log(`\n${i + 1}. ${address}`);
      console.log(`   ${explanation}`);

      // Show the matching text
      if (prop.description) {
        const patterns = [
          /owner\s*financ/i,
          /seller\s*financ/i,
          /owner\s*carry/i,
          /seller\s*carry/i,
          /financ.*available/i,
        ];

        for (const pattern of patterns) {
          const match = prop.description.match(pattern);
          if (match) {
            const matchIndex = prop.description.indexOf(match[0]);
            const start = Math.max(0, matchIndex - 50);
            const end = Math.min(prop.description.length, matchIndex + 100);
            const snippet = prop.description.slice(start, end).replace(/\s+/g, ' ');
            console.log(`   Context: "...${snippet}..."`);
            break;
          }
        }
      }
    });

    // Show sample properties that FAILED
    console.log('\n\n📋 SAMPLE PROPERTIES THAT FAILED (First 10):');
    console.log('='.repeat(70));
    const failed = withContact.filter((p: any) => {
      const result = filterPropertiesForOwnerFinancing([p]);
      return result.filtered.length === 0;
    }).slice(0, 10);

    failed.forEach((prop: any, i: number) => {
      const address = prop.fullAddress || prop.streetAddress || 'Unknown';
      const explanation = getFilterExplanation(prop.description);
      console.log(`\n${i + 1}. ${address}`);
      console.log(`   ${explanation}`);

      if (prop.description && prop.description.trim().length > 0) {
        const snippet = prop.description.slice(0, 200).replace(/\s+/g, ' ');
        console.log(`   Description: "${snippet}..."`);
      }
    });

    console.log('\n\n' + '='.repeat(70));
    console.log('✅ Test complete!');
    console.log('='.repeat(70) + '\n');

    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error testing filter:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testOwnerFinancingFilter();
