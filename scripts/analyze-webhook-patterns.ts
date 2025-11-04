import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('Missing Firebase credentials in environment variables');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = getFirestore(app);

// The 5 properties we just sent
const TEST_PROPERTIES = [
  { id: '0QHeRknFHBHgsQSjNKkI', address: '716 N Joplin Ave, Tulsa, OK 74115', result: 'FAILED' },
  { id: '0fETyGfWVqW2gmvqXPnt', address: '1517 Chapman St, Houston, TX 77009', result: 'FAILED' },
  { id: '0wfOOQJpYg8poXwgRmVs', address: '2050 Egret Ave, New Braunfels, TX 78132', result: 'SUCCESS' },
  { id: '15HpTQjJktjRnx6TtwMj', address: '305 N Forest Ave, Tyler, TX 75702', result: 'FAILED' },
  { id: '1rqiP2bNQAqVM3Rgm9Oa', address: '908 Evesham Ave, Toledo, OH 43607', result: 'SUCCESS' },
];

async function analyzeWebhookPatterns() {
  console.log('🔍 ANALYZING WEBHOOK SUCCESS/FAILURE PATTERNS\n');
  console.log('='.repeat(80));
  console.log('\n📊 Test Results:');
  console.log('   ✅ Successful: 2/5 (40%)');
  console.log('   ❌ Failed: 3/5 (60%)');
  console.log('\n' + '='.repeat(80) + '\n');

  const successProperties = [];
  const failedProperties = [];

  // Fetch all 5 properties and compare
  for (const testProp of TEST_PROPERTIES) {
    const doc = await db.collection('zillow_imports').doc(testProp.id).get();
    if (!doc.exists) {
      console.log(`⚠️  Property ${testProp.id} not found in Firebase`);
      continue;
    }

    const data = doc.data();
    const propData = {
      id: testProp.id,
      address: testProp.address,
      result: testProp.result,
      // Core fields
      zpid: data.zpid,
      price: data.price,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      squareFoot: data.squareFoot,
      yearBuilt: data.yearBuilt,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      // Contact info
      agentName: data.agentName,
      agentPhone: data.agentPhoneNumber,
      agentEmail: data.agentEmail,
      brokerName: data.brokerName,
      brokerPhone: data.brokerPhoneNumber,
      // Description
      descriptionLength: data.description?.length || 0,
      descriptionHasSpecialChars: /[^\x00-\x7F]/.test(data.description || ''),
      // Images
      hasImage: !!data.firstPropertyImage,
      imageCount: data.photoCount || 0,
      // Financial
      estimate: data.estimate,
      hoa: data.hoa,
      annualTaxAmount: data.annualTaxAmount,
      // Metadata
      source: data.source,
      scrapedAt: data.scrapedAt?.toDate?.() || data.scrapedAt,
      originalSentAt: data.ghlSentAt?.toDate?.() || data.ghlSentAt,
      // URL
      url: data.url,
      hdpUrl: data.hdpUrl,
    };

    if (testProp.result === 'SUCCESS') {
      successProperties.push(propData);
    } else {
      failedProperties.push(propData);
    }
  }

  // Print detailed comparison
  console.log('✅ SUCCESSFUL PROPERTIES (2):\n');
  successProperties.forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}`);
    console.log(`   ZPID: ${prop.zpid}`);
    console.log(`   Price: $${prop.price?.toLocaleString()}`);
    console.log(`   Size: ${prop.bedrooms}bd/${prop.bathrooms}ba, ${prop.squareFoot} sqft`);
    console.log(`   Built: ${prop.yearBuilt}`);
    console.log(`   Location: ${prop.city}, ${prop.state} ${prop.zipCode}`);
    console.log(`   Agent: ${prop.agentName} (${prop.agentPhone})`);
    console.log(`   Broker: ${prop.brokerName} (${prop.brokerPhone || 'N/A'})`);
    console.log(`   Description: ${prop.descriptionLength} chars, Special chars: ${prop.descriptionHasSpecialChars}`);
    console.log(`   Images: ${prop.imageCount} photos, Has primary: ${prop.hasImage}`);
    console.log(`   Estimate: $${prop.estimate?.toLocaleString() || 'N/A'}`);
    console.log(`   HOA: $${prop.hoa || 0}`);
    console.log(`   Annual Tax: $${prop.annualTaxAmount?.toLocaleString() || 'N/A'}`);
    console.log(`   Originally sent: ${prop.originalSentAt}`);
    console.log('');
  });

  console.log('\n' + '='.repeat(80) + '\n');
  console.log('❌ FAILED PROPERTIES (3):\n');
  failedProperties.forEach((prop, i) => {
    console.log(`${i + 1}. ${prop.address}`);
    console.log(`   ZPID: ${prop.zpid}`);
    console.log(`   Price: $${prop.price?.toLocaleString()}`);
    console.log(`   Size: ${prop.bedrooms}bd/${prop.bathrooms}ba, ${prop.squareFoot} sqft`);
    console.log(`   Built: ${prop.yearBuilt}`);
    console.log(`   Location: ${prop.city}, ${prop.state} ${prop.zipCode}`);
    console.log(`   Agent: ${prop.agentName} (${prop.agentPhone})`);
    console.log(`   Broker: ${prop.brokerName} (${prop.brokerPhone || 'N/A'})`);
    console.log(`   Description: ${prop.descriptionLength} chars, Special chars: ${prop.descriptionHasSpecialChars}`);
    console.log(`   Images: ${prop.imageCount} photos, Has primary: ${prop.hasImage}`);
    console.log(`   Estimate: $${prop.estimate?.toLocaleString() || 'N/A'}`);
    console.log(`   HOA: $${prop.hoa || 0}`);
    console.log(`   Annual Tax: $${prop.annualTaxAmount?.toLocaleString() || 'N/A'}`);
    console.log(`   Originally sent: ${prop.originalSentAt}`);
    console.log('');
  });

  // Analyze patterns
  console.log('\n' + '='.repeat(80));
  console.log('🔬 PATTERN ANALYSIS\n');

  // Compare price ranges
  const successPrices = successProperties.map(p => p.price);
  const failedPrices = failedProperties.map(p => p.price);
  console.log('💰 Price Comparison:');
  console.log(`   Success avg: $${Math.round(successPrices.reduce((a, b) => a + b, 0) / successPrices.length).toLocaleString()}`);
  console.log(`   Failed avg:  $${Math.round(failedPrices.reduce((a, b) => a + b, 0) / failedPrices.length).toLocaleString()}`);
  console.log(`   Success range: $${Math.min(...successPrices).toLocaleString()} - $${Math.max(...successPrices).toLocaleString()}`);
  console.log(`   Failed range:  $${Math.min(...failedPrices).toLocaleString()} - $${Math.max(...failedPrices).toLocaleString()}`);

  // Compare states
  console.log('\n🗺️  State Distribution:');
  const successStates = successProperties.map(p => p.state);
  const failedStates = failedProperties.map(p => p.state);
  console.log(`   Success: ${successStates.join(', ')}`);
  console.log(`   Failed:  ${failedStates.join(', ')}`);

  // Compare phone numbers
  console.log('\n📞 Phone Number Patterns:');
  successProperties.forEach(p => {
    console.log(`   ✅ ${p.address.substring(0, 30)}... → ${p.agentPhone}`);
  });
  failedProperties.forEach(p => {
    console.log(`   ❌ ${p.address.substring(0, 30)}... → ${p.agentPhone}`);
  });

  // Check for phone duplicates
  console.log('\n🔄 Duplicate Phone Check:');
  const allPhones = [...successProperties, ...failedProperties].map(p => p.agentPhone);
  const phoneCounts = allPhones.reduce((acc, phone) => {
    acc[phone] = (acc[phone] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const duplicates = Object.entries(phoneCounts).filter(([phone, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('   ⚠️  DUPLICATES FOUND:');
    duplicates.forEach(([phone, count]) => {
      console.log(`      ${phone}: appears ${count} times`);
    });
  } else {
    console.log('   ✅ No duplicate phone numbers');
  }

  // Compare description lengths
  console.log('\n📝 Description Length:');
  const successDescLengths = successProperties.map(p => p.descriptionLength);
  const failedDescLengths = failedProperties.map(p => p.descriptionLength);
  console.log(`   Success avg: ${Math.round(successDescLengths.reduce((a, b) => a + b, 0) / successDescLengths.length)} chars`);
  console.log(`   Failed avg:  ${Math.round(failedDescLengths.reduce((a, b) => a + b, 0) / failedDescLengths.length)} chars`);

  // Check estimate (Zestimate)
  console.log('\n🏠 Zestimate Presence:');
  const successWithEstimate = successProperties.filter(p => p.estimate && p.estimate > 0);
  const failedWithEstimate = failedProperties.filter(p => p.estimate && p.estimate > 0);
  console.log(`   Success with Zestimate: ${successWithEstimate.length}/${successProperties.length}`);
  console.log(`   Failed with Zestimate:  ${failedWithEstimate.length}/${failedProperties.length}`);

  // Check agent/broker differences
  console.log('\n👤 Agent/Broker Analysis:');
  console.log('   Success:');
  successProperties.forEach(p => {
    const usedBroker = !p.agentPhone || p.agentPhone === p.brokerPhone;
    console.log(`      ${p.address.substring(0, 30)}... → ${usedBroker ? 'Broker phone' : 'Agent phone'}`);
  });
  console.log('   Failed:');
  failedProperties.forEach(p => {
    const usedBroker = !p.agentPhone || p.agentPhone === p.brokerPhone;
    console.log(`      ${p.address.substring(0, 30)}... → ${usedBroker ? 'Broker phone' : 'Agent phone'}`);
  });

  // Check when originally sent
  console.log('\n⏰ Original Send Time:');
  successProperties.forEach(p => {
    console.log(`   ✅ ${p.address.substring(0, 30)}... → ${p.originalSentAt}`);
  });
  failedProperties.forEach(p => {
    console.log(`   ❌ ${p.address.substring(0, 30)}... → ${p.originalSentAt}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 HYPOTHESIS:');
  console.log('\nBased on the analysis above, possible reasons for failures:');
  console.log('   1. Phone number already exists in GHL → Duplicate rejection');
  console.log('   2. Contact/Agent name already exists → Duplicate merging');
  console.log('   3. Properties were sent at same time → Race condition');
  console.log('   4. Specific data validation rules in GHL workflow');
  console.log('   5. Price range filtering in GHL automation');
  console.log('\nNext step: Check GHL for duplicate contacts with these phone numbers:');
  failedProperties.forEach(p => {
    console.log(`   • ${p.agentPhone} (${p.agentName})`);
  });
  console.log('');
}

analyzeWebhookPatterns()
  .then(() => {
    console.log('✅ Analysis completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
