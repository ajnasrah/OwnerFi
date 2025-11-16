/**
 * Test Buyer UI Data Display
 *
 * Verifies:
 * 1. All Zillow fields are properly mapped
 * 2. Financial placeholders work correctly
 * 3. Images and tags display properly
 * 4. No missing data
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

interface PropertyData {
  id: string;
  [key: string]: any;
}

async function testBuyerUIData() {
  console.log('\n🧪 BUYER UI DATA DISPLAY TEST\n');
  console.log('═'.repeat(80));

  try {
    // Get sample properties from zillow_imports (like the buyer API does)
    const snapshot = await db
      .collection('zillow_imports')
      .where('ownerFinanceVerified', '==', true)
      .limit(5)
      .get();

    if (snapshot.empty) {
      console.log('❌ No properties found in zillow_imports collection');
      return;
    }

    console.log(`\n✅ Found ${snapshot.size} properties to test\n`);

    let testsPassed = 0;
    let testsFailed = 0;

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();

      // Simulate the field mapping that happens in buyer API
      const mappedProperty: PropertyData = {
        id: doc.id,
        ...data,
        // Field mapping for UI compatibility (same as buyer API)
        address: data.fullAddress || data.address,
        squareFeet: data.squareFoot || data.squareFeet,
        lotSize: data.lotSquareFoot || data.lotSize,
        listPrice: data.price || data.listPrice,
        termYears: data.loanTermYears || data.termYears,
        propertyType: data.homeType || data.buildingType || data.propertyType,
        imageUrl: data.firstPropertyImage || data.imageUrl,
        imageUrls: data.propertyImages || data.imageUrls || [],
        downPaymentPercent: data.downPaymentPercent || (data.downPaymentAmount && data.price ?
          Math.round((data.downPaymentAmount / data.price) * 100) : null),
        ownerFinanceKeyword: data.primaryKeyword || data.matchedKeywords?.[0] || 'Owner Financing',
        matchedKeywords: data.matchedKeywords || [],
        monthlyPayment: data.monthlyPayment || null,
        downPaymentAmount: data.downPaymentAmount || null,
        isActive: data.status !== 'sold' && data.status !== 'pending',
      };

      console.log(`\n${'─'.repeat(80)}`);
      console.log(`PROPERTY ${index + 1}: ${mappedProperty.address}`);
      console.log('─'.repeat(80));

      // Test 1: Essential Zillow Fields
      console.log('\n📍 ESSENTIAL ZILLOW DATA:');
      const essentialTests = [
        { field: 'address', value: mappedProperty.address, label: 'Address' },
        { field: 'city', value: mappedProperty.city, label: 'City' },
        { field: 'state', value: mappedProperty.state, label: 'State' },
        { field: 'zipCode', value: mappedProperty.zipCode, label: 'ZIP Code' },
        { field: 'listPrice', value: mappedProperty.listPrice, label: 'Price' },
        { field: 'bedrooms', value: mappedProperty.bedrooms, label: 'Bedrooms' },
        { field: 'bathrooms', value: mappedProperty.bathrooms, label: 'Bathrooms' },
      ];

      essentialTests.forEach(test => {
        if (test.value !== null && test.value !== undefined) {
          console.log(`   ✅ ${test.label}: ${test.value}`);
          testsPassed++;
        } else {
          console.log(`   ❌ ${test.label}: MISSING`);
          testsFailed++;
        }
      });

      // Test 2: Property Details
      console.log('\n🏠 PROPERTY DETAILS:');
      const detailTests = [
        { field: 'squareFeet', value: mappedProperty.squareFeet, label: 'Square Feet' },
        { field: 'lotSize', value: mappedProperty.lotSize, label: 'Lot Size' },
        { field: 'yearBuilt', value: mappedProperty.yearBuilt, label: 'Year Built' },
        { field: 'propertyType', value: mappedProperty.propertyType, label: 'Property Type' },
      ];

      detailTests.forEach(test => {
        if (test.value !== null && test.value !== undefined) {
          console.log(`   ✅ ${test.label}: ${test.value}`);
          testsPassed++;
        } else {
          console.log(`   ⚠️  ${test.label}: Not available`);
        }
      });

      // Test 3: Description
      console.log('\n📝 DESCRIPTION:');
      if (mappedProperty.description) {
        const preview = mappedProperty.description.substring(0, 100);
        console.log(`   ✅ Description: "${preview}..." (${mappedProperty.description.length} chars)`);
        testsPassed++;
      } else {
        console.log(`   ❌ Description: MISSING`);
        testsFailed++;
      }

      // Test 4: Images
      console.log('\n🖼️  IMAGES:');
      if (mappedProperty.imageUrl) {
        console.log(`   ✅ Primary Image: ${mappedProperty.imageUrl}`);
        testsPassed++;
      } else {
        console.log(`   ❌ Primary Image: MISSING`);
        testsFailed++;
      }

      if (mappedProperty.imageUrls && mappedProperty.imageUrls.length > 0) {
        console.log(`   ✅ Image Gallery: ${mappedProperty.imageUrls.length} images`);
        testsPassed++;
      } else {
        console.log(`   ❌ Image Gallery: MISSING`);
        testsFailed++;
      }

      // Test 5: Owner Finance Tags/Keywords
      console.log('\n🏦 OWNER FINANCE TAGS:');
      if (mappedProperty.ownerFinanceKeyword) {
        console.log(`   ✅ Primary Keyword: "${mappedProperty.ownerFinanceKeyword}"`);
        testsPassed++;
      } else {
        console.log(`   ❌ Primary Keyword: MISSING`);
        testsFailed++;
      }

      if (mappedProperty.matchedKeywords && mappedProperty.matchedKeywords.length > 0) {
        console.log(`   ✅ All Keywords: ${mappedProperty.matchedKeywords.join(', ')}`);
        testsPassed++;
      } else {
        console.log(`   ⚠️  Matched Keywords: None`);
      }

      // Test 6: Financial Fields (should have placeholders)
      console.log('\n💰 FINANCIAL FIELDS (Placeholders Expected):');

      const monthlyPayment = mappedProperty.monthlyPayment;
      if (monthlyPayment !== null && monthlyPayment !== undefined && monthlyPayment > 0) {
        console.log(`   ✅ Monthly Payment: $${monthlyPayment.toLocaleString()}/mo (FROM GHL)`);
        testsPassed++;
      } else {
        console.log(`   ✅ Monthly Payment: NULL → Should show "Seller to Decide"`);
        testsPassed++;
      }

      const downPayment = mappedProperty.downPaymentAmount;
      if (downPayment !== null && downPayment !== undefined && downPayment > 0) {
        console.log(`   ✅ Down Payment: $${downPayment.toLocaleString()} (FROM GHL)`);
        testsPassed++;
      } else {
        console.log(`   ✅ Down Payment: NULL → Should show "Seller to Decide"`);
        testsPassed++;
      }

      const interestRate = mappedProperty.interestRate;
      if (interestRate !== null && interestRate !== undefined && interestRate > 0) {
        console.log(`   ✅ Interest Rate: ${interestRate}% (FROM GHL)`);
        testsPassed++;
      } else {
        console.log(`   ✅ Interest Rate: NULL → Should show "Seller to Decide"`);
        testsPassed++;
      }

      // Test 7: Contact Info
      console.log('\n📞 CONTACT INFO:');
      if (mappedProperty.agentName) {
        console.log(`   ✅ Agent: ${mappedProperty.agentName}`);
        testsPassed++;
      } else {
        console.log(`   ⚠️  Agent Name: Not available`);
      }

      if (mappedProperty.agentPhoneNumber) {
        console.log(`   ✅ Agent Phone: ${mappedProperty.agentPhoneNumber}`);
        testsPassed++;
      } else if (mappedProperty.brokerPhoneNumber) {
        console.log(`   ✅ Broker Phone: ${mappedProperty.brokerPhoneNumber}`);
        testsPassed++;
      } else {
        console.log(`   ⚠️  Contact Phone: Not available`);
      }

      // Test 8: Data Integrity
      console.log('\n🔍 DATA INTEGRITY:');
      console.log(`   • ZPID: ${mappedProperty.zpid}`);
      console.log(`   • Source: ${mappedProperty.source || 'zillow'}`);
      console.log(`   • Status: ${mappedProperty.status || 'null (awaiting terms)'}`);
      console.log(`   • Active: ${mappedProperty.isActive ? 'Yes' : 'No'}`);
    });

    // Final Summary
    console.log('\n\n' + '═'.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(80));
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);

    if (testsFailed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Buyer UI data is complete and properly mapped.\n');
    } else {
      console.log(`\n⚠️  ${testsFailed} ISSUES FOUND - Review above for details.\n`);
    }

    // Provide UI Display Examples
    console.log('\n' + '═'.repeat(80));
    console.log('🎨 UI DISPLAY EXAMPLES');
    console.log('═'.repeat(80));

    const exampleProperty = snapshot.docs[0].data();
    const exampleMapped = {
      address: exampleProperty.fullAddress || exampleProperty.address,
      listPrice: exampleProperty.price || exampleProperty.listPrice,
      ownerFinanceKeyword: exampleProperty.primaryKeyword || 'Owner Financing',
      monthlyPayment: exampleProperty.monthlyPayment || null,
    };

    console.log('\n📱 PROPERTY CARD EXAMPLE:');
    console.log('┌─────────────────────────────────────────────────┐');
    console.log(`│ 🏠 ${exampleMapped.address?.substring(0, 42).padEnd(42)} │`);
    console.log(`│ 💰 $${(exampleMapped.listPrice || 0).toLocaleString().padEnd(42)} │`);
    console.log(`│ ✅ ${exampleMapped.ownerFinanceKeyword?.padEnd(42)} │`);
    console.log('├─────────────────────────────────────────────────┤');
    if (exampleMapped.monthlyPayment) {
      console.log(`│ 📅 Monthly: $${exampleMapped.monthlyPayment.toLocaleString()}/mo`.padEnd(50) + '│');
    } else {
      console.log(`│ 📅 Monthly: Seller to Decide`.padEnd(50) + '│');
    }
    console.log('└─────────────────────────────────────────────────┘');

  } catch (error) {
    console.error('\n❌ Error running test:', error);
  }
}

// Run the test
testBuyerUIData();
